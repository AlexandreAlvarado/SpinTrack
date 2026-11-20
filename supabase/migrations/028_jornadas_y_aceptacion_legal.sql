-- Revisión y aplicación MANUAL, sobre el esquema 001–027.
-- No ejecutar sobre Supabase remoto desde las pruebas. No incluye 029–031.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.version_legal_028 (
  id boolean primary key default true check (id),
  version text not null check (length(version) between 1 and 80)
);
insert into public.version_legal_028(id, version) values (true, '2026-11-19.1');

create table public.aceptaciones_legales_028 (
  usuario_id uuid not null references auth.users(id) on delete restrict,
  version text not null,
  aceptado_en timestamptz not null default clock_timestamp(),
  origen text not null check (origen in ('registro', 'sesion')),
  primary key (usuario_id, version)
);
alter table public.version_legal_028 enable row level security;
alter table public.aceptaciones_legales_028 enable row level security;
revoke all on public.version_legal_028, public.aceptaciones_legales_028
  from public, anon, authenticated, service_role;
grant select on public.version_legal_028 to anon, authenticated;
create policy version_publica_028 on public.version_legal_028
  for select to anon, authenticated using (true);
grant select on public.aceptaciones_legales_028 to authenticated;
create policy aceptacion_propia_028 on public.aceptaciones_legales_028
  for select to authenticated using (usuario_id = auth.uid());

create function public.estado_legal_028() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version', v.version, 'aceptada', exists (
    select 1 from public.aceptaciones_legales_028 a
    where a.usuario_id = auth.uid() and a.version = v.version
  )) from public.version_legal_028 v where id;
$$;

create function public.aceptar_terminos_028(p_version text, p_acepta boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare actual text;
begin
  if auth.uid() is null then
    raise exception 'Se requiere sesión' using errcode = '42501';
  end if;
  select version into actual from public.version_legal_028 where id for share;
  if actual is null or p_acepta is distinct from true or p_version is distinct from actual then
    raise exception 'Revisar y aceptar versión vigente' using errcode = '22023';
  end if;
  insert into public.aceptaciones_legales_028(usuario_id, version, origen)
    values (auth.uid(), actual, 'sesion')
    on conflict (usuario_id, version) do nothing;
end;
$$;

-- Solo INSERT: confirmar correo, renovar sesión o cambiar metadatos no dispara
-- estos controles. No se confía en roles, fechas o identidades del navegador.
create function public.validar_registro_legal_028() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actual text;
begin
  select version into actual from public.version_legal_028 where id for share;
  if actual is null or new.raw_user_meta_data->>'terminos_version' is distinct from actual
    or new.raw_user_meta_data->'terminos_aceptados' is distinct from 'true'::jsonb then
    raise exception 'Es obligatorio aceptar los términos vigentes' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.registrar_aceptacion_028() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actual text;
begin
  select version into actual from public.version_legal_028 where id for share;
  if actual is null or new.raw_user_meta_data->>'terminos_version' is distinct from actual
    or new.raw_user_meta_data->'terminos_aceptados' is distinct from 'true'::jsonb then
    raise exception 'Registro sin aceptación vigente' using errcode = '23514';
  end if;
  insert into public.aceptaciones_legales_028(usuario_id, version, origen)
    values (new.id, actual, 'registro');
  return new;
end;
$$;
create trigger validar_registro_legal_028 before insert on auth.users
  for each row execute function public.validar_registro_legal_028();
create trigger registrar_aceptacion_028 after insert on auth.users
  for each row execute function public.registrar_aceptacion_028();
revoke all on function public.estado_legal_028(), public.aceptar_terminos_028(text, boolean),
  public.validar_registro_legal_028(), public.registrar_aceptacion_028()
  from public, anon, authenticated, service_role;
grant execute on function public.estado_legal_028() to anon, authenticated;
grant execute on function public.aceptar_terminos_028(text, boolean) to authenticated;

alter table public.fechas add column archivada boolean not null default false;
create table public.jornadas_operaciones_028 (
  id bigint generated always as identity primary key,
  fecha_id bigint not null,
  actor_id uuid not null references public.perfiles(id),
  operacion text not null check (operacion in ('eliminar', 'archivar', 'despublicar')),
  ocurrido_en timestamptz not null default clock_timestamp(),
  resumen jsonb not null
);
create table public.jornadas_revisiones_028 (
  token uuid primary key default gen_random_uuid(),
  fecha_id bigint not null,
  actor_id uuid not null references public.perfiles(id),
  snapshot jsonb not null,
  vence_en timestamptz not null default clock_timestamp() + interval '15 minutes'
);
alter table public.jornadas_operaciones_028 enable row level security;
alter table public.jornadas_revisiones_028 enable row level security;
revoke all on public.jornadas_operaciones_028, public.jornadas_revisiones_028
  from public, anon, authenticated, service_role;
revoke all on sequence public.jornadas_operaciones_028_id_seq
  from public, anon, authenticated, service_role;
grant select on public.jornadas_operaciones_028 to authenticated;
create policy operaciones_admin_028 on public.jornadas_operaciones_028
  for select to authenticated using (public.es_administrador());

-- INSERT y las políticas de Administración de 001 se conservan. Se retira solo
-- el borrado directo y se excluyen ID, creado_en y archivada de la edición.
revoke delete, update on public.fechas from authenticated;
grant update (temporada_id, numero, fecha, comuna, recinto, estado)
  on public.fechas to authenticated;

-- Fotografía de dependencias transitivas, incluidas FK compuestas. El contenido
-- completo solo vive en una tabla temporal interna que se descarta al terminar.
-- La revisión conserva huellas SHA-256, recuentos implícitos y metadatos mínimos:
-- nunca nombres, correos, nacimientos, evidencias, motivos o actas completas.
create function public.snapshot_jornada_028(p_fecha bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  edge record;
  condition_sql text;
  added integer;
  total integer;
  answer jsonb;
begin
  drop table if exists pg_temp.jornada_filas_028;
  create temporary table jornada_filas_028(tabla oid not null, fila jsonb not null) on commit drop;
  create unique index on jornada_filas_028(tabla, md5(fila::text));
  insert into pg_temp.jornada_filas_028
    select 'public.fechas'::regclass, to_jsonb(f) from public.fechas f where id = p_fecha;
  if not found then
    raise exception 'Jornada inexistente' using errcode = 'P0002';
  end if;
  -- 026 guarda estas referencias en un array, sin FK a fechas.
  insert into pg_temp.jornada_filas_028
    select 'public.ranking_configuraciones_026'::regclass, to_jsonb(r)
    from public.ranking_configuraciones_026 r where p_fecha = any(r.fecha_ids);
  loop
    total := 0;
    for edge in
      select c.oid, c.conrelid, c.confrelid, c.conkey, c.confkey
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_class t on t.oid = c.conrelid
      join pg_catalog.pg_namespace n on n.oid = t.relnamespace
      where c.contype = 'f' and n.nspname = 'public' order by c.oid
    loop
      select string_agg(format('to_jsonb(child)->%L = parent.fila->%L', a.attname, b.attname),
        ' and ' order by k.i) into condition_sql
      from generate_subscripts(edge.conkey, 1) k(i)
      join pg_catalog.pg_attribute a on a.attrelid = edge.conrelid and a.attnum = edge.conkey[k.i]
      join pg_catalog.pg_attribute b on b.attrelid = edge.confrelid and b.attnum = edge.confkey[k.i];
      execute format(
        'insert into pg_temp.jornada_filas_028 select %s, to_jsonb(child) from %s child '
        'where exists (select 1 from pg_temp.jornada_filas_028 parent where parent.tabla = %s and %s) '
        'on conflict do nothing', edge.conrelid, edge.conrelid::regclass, edge.confrelid, condition_sql
      );
      get diagnostics added = row_count;
      total := total + added;
    end loop;
    exit when total = 0;
  end loop;
  select jsonb_object_agg(tabla, filas) into answer from (
    select c.relname tabla, jsonb_agg(
      jsonb_build_object('huella', encode(sha256(convert_to(r.fila::text, 'UTF8')), 'hex')) ||
      case c.relname
        when 'fechas' then jsonb_build_object('id', r.fila->'id', 'numero', r.fila->'numero',
          'fecha', r.fila->'fecha', 'estado', r.fila->'estado', 'archivada', r.fila->'archivada')
        when 'competencia_control_deportivo' then jsonb_build_object('estado_deportivo', r.fila->'estado_deportivo',
          'configuracion_aprobada', r.fila->'configuracion_aprobada')
        else '{}'::jsonb
      end order by r.fila::text
    ) filas
    from pg_temp.jornada_filas_028 r
    join pg_catalog.pg_class c on c.oid = r.tabla group by c.relname
  ) x;
  drop table pg_temp.jornada_filas_028;
  return answer;
end;
$$;

-- Lista cerrada: una dependencia nueva o cualquier evidencia deportiva protege.
create function public.protegida_jornada_028(p_snapshot jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case when p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object'
    or not (p_snapshot ? 'fechas') then true else
    exists (select 1 from jsonb_object_keys(p_snapshot) k where k not in
      ('fechas', 'competencias', 'competencia_control_deportivo',
       'competencia_formatos_sets', 'competencia_formato_final_021', 'mesas_jornada'))
    or exists (select 1 from jsonb_array_elements(coalesce(p_snapshot->'competencia_control_deportivo', '[]')) d
      where d->>'estado_deportivo' <> 'pendiente' or d->'configuracion_aprobada' = 'true'::jsonb)
    or exists (select 1 from jsonb_array_elements(p_snapshot->'fechas') d where d->>'estado' = 'finalizada')
  end;
$$;

-- FOR UPDATE sobre los padres impide nuevas referencias FK mientras se comprueba
-- y elimina. Solo se bloquean filas de esta jornada y las configuraciones borrables.
-- El único bloqueo de tabla es ranking_configuraciones_026: sus arrays no tienen FK.
create function public.bloquear_jornada_028(p_fecha bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Reintentar con una transacción nueva READ COMMITTED' using errcode = '25001';
  end if;
  perform 1 from public.fechas where id = p_fecha for update;
  if not found then raise exception 'Jornada inexistente' using errcode = 'P0002'; end if;
  -- Mismo orden que configurar_ranking_026: primero fechas, después ranking.
  lock table public.ranking_configuraciones_026 in share mode;
  perform 1 from public.competencias where fecha_id = p_fecha order by id for update;
  perform 1 from public.competencia_control_deportivo d
    join public.competencias c on c.id = d.competencia_id
    where c.fecha_id = p_fecha order by d.competencia_id for update of d;
  perform 1 from public.competencia_formatos_sets d
    join public.competencias c on c.id = d.competencia_id
    where c.fecha_id = p_fecha order by d.competencia_id, d.etapa for update of d;
  perform 1 from public.competencia_formato_final_021 d
    join public.competencias c on c.id = d.competencia_id
    where c.fecha_id = p_fecha order by d.competencia_id for update of d;
  perform 1 from public.mesas_jornada where fecha_id = p_fecha order by id for update;
end;
$$;

create function public.revisar_jornada_028(p_fecha bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare snap jsonb; ticket uuid;
begin
  if public.es_administrador() is distinct from true then
    raise exception 'Solo Administrador' using errcode = '42501';
  end if;
  snap := public.snapshot_jornada_028(p_fecha);
  delete from public.jornadas_revisiones_028 where vence_en < clock_timestamp();
  insert into public.jornadas_revisiones_028(fecha_id, actor_id, snapshot)
    values (p_fecha, auth.uid(), snap) returning token into ticket;
  return jsonb_build_object('token', ticket, 'jornada', (snap->'fechas'->0) - 'huella',
    'dependencias', (select jsonb_object_agg(key, jsonb_array_length(value)) from jsonb_each(snap)),
    'protegida', public.protegida_jornada_028(snap));
end;
$$;

-- Conservar edición de estado sin permitir despublicar una jornada protegida
-- mediante UPDATE directo. La RPC y la edición administrativa usan el mismo control.
create function public.validar_estado_jornada_028() returns trigger
language plpgsql security definer set search_path = '' as $$
declare snap jsonb;
begin
  if new.estado is distinct from old.estado
    and (new.estado = 'borrador' or old.estado = 'finalizada') then
    perform public.bloquear_jornada_028(old.id);
    snap := public.snapshot_jornada_028(old.id);
    if public.protegida_jornada_028(snap) then
      raise exception 'Historial protegido: conservar estado y archivar' using errcode = '55000';
    end if;
    if exists (select 1 from public.competencias where fecha_id = old.id and inscripciones_habilitadas) then
      raise exception 'Cerrar habilitación administrativa antes de cambiar estado' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;
create trigger validar_estado_jornada_028 before update of estado on public.fechas
  for each row execute function public.validar_estado_jornada_028();

create function public.gestionar_jornada_028(p_token uuid, p_operacion text, p_frase text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  review public.jornadas_revisiones_028;
  snap jsonb;
  j public.fechas;
  counts jsonb;
begin
  if public.es_administrador() is distinct from true then
    raise exception 'Solo Administrador' using errcode = '42501';
  end if;
  if p_operacion is null or p_operacion not in ('eliminar', 'archivar', 'despublicar') then
    raise exception 'Operación inválida' using errcode = '22023';
  end if;
  select * into review from public.jornadas_revisiones_028
    where token = p_token and actor_id = auth.uid() and vence_en > clock_timestamp() for update;
  if not found then raise exception 'Revisión inexistente o vencida' using errcode = '22023'; end if;
  perform public.bloquear_jornada_028(review.fecha_id);
  if review.vence_en <= clock_timestamp() then
    raise exception 'Revisión vencida durante la espera' using errcode = '22023';
  end if;
  select * into j from public.fechas where id = review.fecha_id;
  snap := public.snapshot_jornada_028(review.fecha_id);
  if snap is distinct from review.snapshot then
    raise exception 'La jornada cambió: volver a revisar' using errcode = '40001';
  end if;
  if p_operacion = 'eliminar' then
    if p_frase is distinct from 'ELIMINAR JORNADA ' || j.numero::text then
      raise exception 'Confirmación literal incorrecta' using errcode = '22023';
    end if;
    if public.protegida_jornada_028(snap) then
      raise exception 'Historial protegido: archivar' using errcode = '55000';
    end if;
    -- Lista explícita, sin CASCADE ni borrado de jugadores o cuentas.
    delete from public.competencia_formato_final_021 where competencia_id in
      (select id from public.competencias where fecha_id = j.id);
    delete from public.competencia_formatos_sets where competencia_id in
      (select id from public.competencias where fecha_id = j.id);
    delete from public.competencia_control_deportivo where competencia_id in
      (select id from public.competencias where fecha_id = j.id);
    delete from public.competencias where fecha_id = j.id;
    delete from public.mesas_jornada where fecha_id = j.id;
    delete from public.fechas where id = j.id;
  elsif p_operacion = 'despublicar' then
    if public.protegida_jornada_028(snap) then
      raise exception 'Conservar visibilidad histórica: archivar' using errcode = '55000';
    end if;
    if exists (select 1 from public.competencias where fecha_id = j.id and inscripciones_habilitadas) then
      raise exception 'Cerrar habilitación administrativa antes de despublicar' using errcode = '55000';
    end if;
    update public.fechas set estado = 'borrador' where id = j.id;
  else
    -- Archivar conserva el estado deportivo, los resultados y su visibilidad.
    update public.fechas set archivada = true where id = j.id;
  end if;
  select jsonb_object_agg(key, jsonb_array_length(value)) into counts from jsonb_each(snap);
  insert into public.jornadas_operaciones_028(fecha_id, actor_id, operacion, resumen)
    values (j.id, auth.uid(), p_operacion, jsonb_build_object(
      'jornada', jsonb_build_object('id', j.id, 'numero', j.numero, 'fecha', j.fecha,
        'estado', j.estado, 'archivada', j.archivada), 'dependencias', counts));
  delete from public.jornadas_revisiones_028 where token = p_token;
end;
$$;
revoke all on function public.snapshot_jornada_028(bigint), public.protegida_jornada_028(jsonb),
  public.bloquear_jornada_028(bigint), public.validar_estado_jornada_028(),
  public.revisar_jornada_028(bigint), public.gestionar_jornada_028(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.revisar_jornada_028(bigint),
  public.gestionar_jornada_028(uuid, text, text) to authenticated;
commit;
