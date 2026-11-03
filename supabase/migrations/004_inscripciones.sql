-- Solo competencias individuales. Revisar y probar antes de aplicar en Supabase.
-- Requiere 001–003. No incorpora datos, pagos ni interfaces.
begin;

-- No añadir este esquema a los esquemas expuestos por PostgREST.
create schema privado_inscripciones;
revoke all on schema privado_inscripciones from public, anon, authenticated;

create table public.inscripciones (
  id bigint generated always as identity primary key,
  jugador_id bigint not null references public.jugadores(id) on delete restrict,
  competencia_id bigint not null references public.competencias(id) on delete restrict,
  estado text not null default 'pendiente' check (estado in ('pendiente','aceptada','rechazada','cancelada')),
  creado_por uuid not null,
  creado_en timestamptz not null,
  solicitud_abre_en timestamptz not null,
  solicitud_cierra_en timestamptz not null,
  actualizado_por uuid not null,
  actualizado_en timestamptz not null,
  motivo text,
  referencia_resolucion text,
  referencia_representacion text,
  antecedentes jsonb not null,
  unique (jugador_id, competencia_id),
  check (isfinite(solicitud_abre_en) and isfinite(solicitud_cierra_en)
    and creado_en >= solicitud_abre_en and creado_en < solicitud_cierra_en),
  check (motivo is null or char_length(btrim(motivo)) between 1 and 2000),
  check (referencia_resolucion is null or char_length(btrim(referencia_resolucion)) between 1 and 1000),
  check (referencia_representacion is null or char_length(btrim(referencia_representacion)) between 1 and 1000)
);
create index inscripciones_competencia_estado_idx on public.inscripciones(competencia_id, estado);
create table public.inscripciones_historial (
  id bigint generated always as identity primary key,
  inscripcion_id bigint not null references public.inscripciones(id) on delete restrict,
  estado_anterior text,
  estado_nuevo text not null,
  actor uuid not null,
  ocurrido_en timestamptz not null,
  motivo text,
  referencia_resolucion text,
  antecedentes jsonb not null
);
create index inscripciones_historial_inscripcion_idx on public.inscripciones_historial(inscripcion_id);

comment on table public.inscripciones is
  'Pendiente y aceptada reservan cupo; no hay lista de espera ni pago implícito. Rechazada/cancelada son terminales. Una fila por jugador/competencia, incluso tras cierre. Flujo técnico, no resolución automática de derechos deportivos.';
comment on column public.inscripciones.antecedentes is
  'Resumen deportivo por lista explícita de campos, visible al titular. Sin evidencias, referencias internas ni UUID de operadores. El respaldo completo está en historial, solo para operadores. Aceptar NO acredita pago.';
comment on column public.inscripciones.referencia_representacion is
  'Evidencia de solicitud/representación cuando Administración registra a otra persona, incluso sin cuenta. No otorga delegación general a otros usuarios.';

-- Reutilizar el bloqueo de configuración 003 evita carreras con aprobaciones.
-- Solo READ COMMITTED: cada consulta posterior a la espera debe ver el commit
-- anterior. No aceptar snapshots antiguos de REPEATABLE READ en el conteo.
create function privado_inscripciones.validar_inscripcion_004() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.competencias; d public.competencia_control_deportivo;
  j public.jugadores; ct public.categorias_temporada; h public.habilitaciones_jugador_categoria;
  f public.fechas; r public.reglamentos_temporada; instante timestamptz;
begin
  if auth.uid() is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Inscripciones requiere READ COMMITTED' using errcode='25000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(2026003, 1);
  select * into c from public.competencias where id=new.competencia_id for update;
  if not found then raise exception 'Competencia inexistente' using errcode='23503'; end if;
  select * into j from public.jugadores where id=new.jugador_id for share;
  if not found then raise exception 'Jugador inexistente' using errcode='23503'; end if;
  instante := clock_timestamp(); -- después de adquirir los bloqueos, no now() de inicio de transacción
  if tg_op='INSERT' then
    if new.estado <> 'pendiente' then raise exception 'Solicitud inicial pendiente' using errcode='23514'; end if;
    if public.es_administrador() then
      if j.perfil_id is distinct from auth.uid() and nullif(btrim(new.referencia_representacion),'') is null then
        raise exception 'Falta evidencia de representación' using errcode='23514';
      end if;
    elsif j.perfil_id is distinct from auth.uid() then
      raise exception 'Solo identidad deportiva propia o Administración autorizada' using errcode='42501';
    end if;
    new.creado_por := auth.uid(); new.creado_en := instante;
    new.motivo := null; new.referencia_resolucion := null;
  else
    if (new.id,new.jugador_id,new.competencia_id,new.creado_por,new.creado_en,new.referencia_representacion,new.solicitud_abre_en,new.solicitud_cierra_en)
      is distinct from (old.id,old.jugador_id,old.competencia_id,old.creado_por,old.creado_en,old.referencia_representacion,old.solicitud_abre_en,old.solicitud_cierra_en) then
      raise exception 'Identidad y solicitud inmutables' using errcode='23514';
    end if;
    if not ((old.estado='pendiente' and new.estado in ('aceptada','rechazada') and public.es_juez_general())
      or (old.estado in ('pendiente','aceptada') and new.estado='cancelada' and public.es_administrador())) then
      raise exception 'Transición o rol no autorizado' using errcode='42501';
    end if;
    if nullif(btrim(new.motivo),'') is null or nullif(btrim(new.referencia_resolucion),'') is null then
      raise exception 'Requiere motivo y resolución documentada' using errcode='23514';
    end if;
    -- Cancelación administrativa solo instrumenta resolución externa documentada.
    -- No se infieren derechos de cancelación, reembolso ni reinscripción.
    new.antecedentes := old.antecedentes;
  end if;
  if new.estado in ('pendiente','aceptada') then
    select * into d from public.competencia_control_deportivo where competencia_id=c.id;
    select * into f from public.fechas where id=c.fecha_id;
    select * into ct from public.categorias_temporada where id=c.categoria_temporada_id;
    select * into r from public.reglamentos_temporada where id=ct.reglamento_id;
    select * into h from public.habilitaciones_jugador_categoria
      where jugador_id=j.id and categoria_temporada_id=ct.id;
    if not c.activo or not c.publicada
      or d.configuracion_aprobada is distinct from true or d.estado_deportivo is distinct from 'preparada'
      or f.estado is distinct from 'publicada' or c.tarifa_clp is null then
      raise exception 'Competencia no disponible' using errcode='23514';
    end if;
    if tg_op='INSERT' then
      if not c.inscripciones_habilitadas then
        raise exception 'Nuevas solicitudes deshabilitadas' using errcode='23514';
      end if;
      if c.inscripcion_abre_en is null or c.inscripcion_cierra_en is null
        or instante < c.inscripcion_abre_en or instante >= c.inscripcion_cierra_en then
        raise exception 'Fuera del período [apertura,cierre)' using errcode='23514';
      end if;
      -- Evidencia temporal inmutable: no reinterpretar solicitudes si cambian plazos.
      new.solicitud_abre_en := c.inscripcion_abre_en;
      new.solicitud_cierra_en := c.inscripcion_cierra_en;
    elsif old.creado_en < old.solicitud_abre_en or old.creado_en >= old.solicitud_cierra_en then
      raise exception 'La solicitud no fue presentada a tiempo' using errcode='23514';
    end if;
    if d.inicio_programado is null or instante >= d.inicio_programado then
      raise exception 'Inicio deportivo alcanzado; no hay excepción validada' using errcode='23514';
    end if;
    if (d.inicio_programado at time zone 'America/Santiago')::date is distinct from f.fecha
      or c.inscripcion_cierra_en > d.inicio_programado then
      raise exception 'Revisar inicio deportivo y día local' using errcode='23514';
    end if;
    if not j.activo or ct.activo is distinct from true or ct.rama is null or ct.criterio_nacimiento='pendiente'
      or r.estado_revision is distinct from 'validado' or d.reglamento_id is distinct from r.id
      or not exists(select 1 from public.categorias where id=ct.categoria_id and activo)
      or not exists(select 1 from public.niveles where id=ct.nivel_id and activo)
      or h.estado is distinct from 'habilitado' or h.validado_por is null or h.validado_en is null
      or nullif(btrim(h.motivo),'') is null or nullif(btrim(h.referencia_evidencia),'') is null then
      raise exception 'Elegibilidad o aprobación pendiente' using errcode='23514';
    end if;
    if h.tipo_resolucion='ordinaria' and ct.criterio_nacimiento='rango_anios' and
      (j.fecha_nacimiento is null or extract(year from j.fecha_nacimiento) not between ct.anio_nacimiento_desde and ct.anio_nacimiento_hasta) then
      raise exception 'Nacimiento vigente requiere revisión deportiva' using errcode='23514';
    end if;
    if c.cupo_maximo is not null and (select count(*) from public.inscripciones
      where competencia_id=c.id and estado in ('pendiente','aceptada') and id<>new.id) >= c.cupo_maximo then
      raise exception 'Cupo agotado' using errcode='23514';
    end if;
    -- No serializar filas completas en una columna visible al titular.
    new.antecedentes := jsonb_build_object(
      'habilitacion',jsonb_build_object('id',h.id,'estado',h.estado),
      'categoria',jsonb_build_object('id',ct.id,'codigo',ct.codigo,'rama',ct.rama),
      'reglamento',jsonb_build_object('id',r.id,'version',r.version),
      'tarifa_clp',c.tarifa_clp,'club_id',j.club_id,
      'localidad_procedencia_id',j.localidad_procedencia_id);
  end if;
  new.actualizado_por := auth.uid(); new.actualizado_en := instante;
  return new;
end;
$$;
create trigger validar_inscripcion before insert or update on public.inscripciones
  for each row execute function privado_inscripciones.validar_inscripcion_004();

create function privado_inscripciones.historial_inscripcion_004() returns trigger
language plpgsql security definer set search_path = '' as $$
declare evidencia jsonb;
begin
  if new.estado in ('pendiente','aceptada') then
    -- Respaldo íntegro bajo RLS de operadores, nunca en el resumen del jugador.
    select jsonb_build_object('habilitacion',to_jsonb(h),'categoria',to_jsonb(ct),
      'reglamento',to_jsonb(r),'resumen',new.antecedentes,
      'referencia_representacion',new.referencia_representacion)
      into evidencia from public.competencias c
      join public.categorias_temporada ct on ct.id=c.categoria_temporada_id
      join public.reglamentos_temporada r on r.id=ct.reglamento_id
      join public.habilitaciones_jugador_categoria h on h.categoria_temporada_id=ct.id and h.jugador_id=new.jugador_id
      where c.id=new.competencia_id;
  else
    select antecedentes into evidencia from public.inscripciones_historial
      where inscripcion_id=new.id order by id desc limit 1;
  end if;
  insert into public.inscripciones_historial(inscripcion_id,estado_anterior,estado_nuevo,actor,ocurrido_en,motivo,referencia_resolucion,antecedentes)
  values(new.id,case when tg_op='UPDATE' then old.estado end,new.estado,new.actualizado_por,new.actualizado_en,
    new.motivo,new.referencia_resolucion,evidencia);
  return new;
end;
$$;
create trigger historial_inscripcion after insert or update on public.inscripciones
  for each row execute function privado_inscripciones.historial_inscripcion_004();

-- No reducir el máximo por debajo de las reservas ya existentes.
create function privado_inscripciones.proteger_cupo_004() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Revisión de cupo requiere READ COMMITTED' using errcode='25000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(2026003, 1);
  if new.cupo_maximo is not null and (select count(*) from public.inscripciones
    where competencia_id=new.id and estado in ('pendiente','aceptada')) > new.cupo_maximo then
    raise exception 'Cupo inferior a reservas vigentes' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger c_proteger_cupo before update on public.competencias
  for each row execute function privado_inscripciones.proteger_cupo_004();

-- RPC estrechas: el cliente no escribe snapshots, auditoría ni estados arbitrarios.
create function public.solicitar_inscripcion(p_jugador_id bigint,p_competencia_id bigint,p_referencia_representacion text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare resultado bigint;
begin
  -- Autorizar ANTES de tomar bloqueos o revelar existencia de competencias ajenas.
  -- No confiar en rol de metadata ni en un ID de perfil enviado por el cliente.
  if auth.uid() is null or (not public.es_administrador() and not exists (
    select 1 from public.jugadores where id=p_jugador_id and perfil_id=auth.uid())) then
    raise exception 'Identidad deportiva no autorizada' using errcode='42501';
  end if;
  insert into public.inscripciones(jugador_id,competencia_id,referencia_representacion)
    values(p_jugador_id,p_competencia_id,p_referencia_representacion) returning id into resultado;
  return resultado;
end;
$$;
create function public.resolver_inscripcion(p_inscripcion_id bigint,p_estado text,p_motivo text,p_referencia text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_estado is null or not (
    (p_estado in ('aceptada','rechazada') and public.es_juez_general())
    or (p_estado='cancelada' and public.es_administrador())) then
    raise exception 'Resolución no autorizada para este rol' using errcode='42501';
  end if;
  -- Mismo orden en las RPC: autorización, bloqueo global, filas.
  perform pg_catalog.pg_advisory_xact_lock(2026003, 1);
  update public.inscripciones set estado=p_estado,motivo=p_motivo,referencia_resolucion=p_referencia where id=p_inscripcion_id;
  if not found then raise exception 'Inscripción inexistente' using errcode='23503'; end if;
end;
$$;

alter table public.inscripciones enable row level security;
alter table public.inscripciones_historial enable row level security;
create policy lectura_inscripciones on public.inscripciones for select to authenticated using (
  (select public.es_administrador()) or (select public.es_juez_general())
  or exists(select 1 from public.jugadores j where j.id=jugador_id and j.perfil_id=(select auth.uid())));
create policy lectura_historial on public.inscripciones_historial for select to authenticated using (
  (select public.es_administrador()) or (select public.es_juez_general()));
revoke all on public.inscripciones,public.inscripciones_historial from public,anon,authenticated;
-- Las columnas administrativas de la fila actual tampoco se publican al titular.
-- Los operadores consultan evidencias/actores/resoluciones en el historial con RLS.
grant select (id,jugador_id,competencia_id,estado,creado_en,solicitud_abre_en,solicitud_cierra_en,actualizado_en,antecedentes)
  on public.inscripciones to authenticated;
grant select on public.inscripciones_historial to authenticated;
revoke all on sequence public.inscripciones_id_seq,public.inscripciones_historial_id_seq from public,anon,authenticated;
revoke all on all functions in schema privado_inscripciones from public,anon,authenticated;
revoke all on function public.solicitar_inscripcion(bigint,bigint,text),public.resolver_inscripcion(bigint,text,text,text) from public,anon,authenticated;

-- Supabase puede conceder privilegios por defecto a service_role. Este módulo
-- solo admite la sesión de un usuario; no necesita un acceso alternativo de API.
do $$ begin
  if exists(select 1 from pg_catalog.pg_roles where rolname='service_role') then
    execute 'revoke all on schema privado_inscripciones from service_role';
    execute 'revoke all on all functions in schema privado_inscripciones from service_role';
    execute 'revoke all on public.inscripciones,public.inscripciones_historial from service_role';
    execute 'revoke all on sequence public.inscripciones_id_seq,public.inscripciones_historial_id_seq from service_role';
    execute 'revoke all on function public.solicitar_inscripcion(bigint,bigint,text),public.resolver_inscripcion(bigint,text,text,text) from service_role';
  end if;
end $$;
grant execute on function public.solicitar_inscripcion(bigint,bigint,text),public.resolver_inscripcion(bigint,text,text,text) to authenticated;
commit;
