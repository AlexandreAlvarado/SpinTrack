-- Nómina oficial de participantes confirmados por competencia individual.
-- Dependencias: 001_base_segura, 002_identidad_deportiva, 003_categorias_competencias,
-- 004_inscripciones, 005_eliminar_cupo_maximo y 006_retirar_dependencia_tarifa.
-- 007 sigue reservada para programación deportiva; 008 para fichas Excel.
-- No usa pagos, tarifas ni solicitudes de 004. Aplicar una sola vez como propietario.
begin;

create table public.participantes_competencia (
  id bigint generated always as identity primary key,
  jugador_id bigint not null references public.jugadores(id) on delete restrict,
  competencia_id bigint not null references public.competencias(id) on delete restrict,
  confirmado_por uuid not null references public.perfiles(id) on delete restrict,
  confirmado_en timestamptz not null default pg_catalog.clock_timestamp(),
  fuente text not null default 'manual' check (fuente in ('manual','excel')),
  referencia_trazabilidad text not null check (char_length(pg_catalog.btrim(referencia_trazabilidad)) between 1 and 1000),
  unique (jugador_id, competencia_id)
);
create index participantes_competencia_competencia_idx on public.participantes_competencia(competencia_id, jugador_id);

create table public.participantes_competencia_historial (
  id bigint generated always as identity primary key,
  participante_id bigint,
  jugador_id bigint not null references public.jugadores(id) on delete restrict,
  competencia_id bigint not null references public.competencias(id) on delete restrict,
  evento text not null check (evento in ('confirmado','retirado')),
  actor_id uuid not null references public.perfiles(id) on delete restrict,
  ocurrido_en timestamptz not null default pg_catalog.clock_timestamp(),
  fuente text not null check (fuente in ('manual','excel')),
  referencia_trazabilidad text not null check (char_length(pg_catalog.btrim(referencia_trazabilidad)) between 1 and 1000),
  motivo text check (evento = 'confirmado' or nullif(pg_catalog.btrim(motivo),'') is not null)
);
create index participantes_competencia_historial_idx on public.participantes_competencia_historial(competencia_id, jugador_id, ocurrido_en);

alter table public.participantes_competencia enable row level security;
alter table public.participantes_competencia_historial enable row level security;
revoke all on public.participantes_competencia from public, anon, authenticated;
revoke all on public.participantes_competencia_historial from public, anon, authenticated;
grant select on public.participantes_competencia to authenticated;
grant select on public.participantes_competencia_historial to authenticated;
create policy participantes_operadores on public.participantes_competencia
  for select to authenticated using ((select public.es_administrador()) or (select public.es_juez_general()));
create policy participantes_historial_operadores on public.participantes_competencia_historial
  for select to authenticated using ((select public.es_administrador()) or (select public.es_juez_general()));
revoke all on sequence public.participantes_competencia_id_seq from public, anon, authenticated;
revoke all on sequence public.participantes_competencia_historial_id_seq from public, anon, authenticated;

create or replace function public.confirmar_participantes_competencia(
  p_competencia_id bigint,
  p_jugadores bigint[],
  p_fuente text default 'manual',
  p_referencia_trazabilidad text default null,
  p_motivo_retiro text default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare c public.competencias; f public.fechas; ct public.categorias_temporada; ctl public.competencia_control_deportivo; r public.reglamentos_temporada; old_pc public.participantes_competencia; v_jugador_id bigint; inserted_id bigint; total integer;
begin
  if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo el Juez General puede confirmar participantes' using errcode='42501'; end if;
  if p_fuente is null or p_fuente not in ('manual','excel') or nullif(pg_catalog.btrim(p_referencia_trazabilidad),'') is null then raise exception 'Fuente y trazabilidad son obligatorias' using errcode='22023'; end if;
  if p_jugadores is null or (cardinality(p_jugadores) = 0 and nullif(pg_catalog.btrim(p_motivo_retiro),'') is null) or exists(select 1 from unnest(p_jugadores) x group by x having count(*) > 1) then raise exception 'La nómina debe contener jugadores distintos o un motivo para retirar a todos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(2026003, 2);
  select * into c from public.competencias where id=p_competencia_id for update;
  if not found or not c.activo or not c.publicada then raise exception 'Competencia no disponible' using errcode='23514'; end if;
  select * into f from public.fechas where id=c.fecha_id and temporada_id=c.temporada_id;
  select * into ct from public.categorias_temporada where id=c.categoria_temporada_id and temporada_id=c.temporada_id;
  select * into ctl from public.competencia_control_deportivo where competencia_id=c.id;
  select * into r from public.reglamentos_temporada where id=ct.reglamento_id and temporada_id=ct.temporada_id;
  if f.estado is distinct from 'publicada' or ct.activo is distinct from true or ct.rama is null or ct.criterio_nacimiento is not distinct from 'pendiente'
     or ctl.competencia_id is null or ctl.configuracion_aprobada is distinct from true
     or r.id is null or r.estado_revision is distinct from 'validado' or nullif(pg_catalog.btrim(r.referencia_aprobacion),'') is null
     or not exists(select 1 from public.categorias where id=ct.categoria_id and activo)
     or not exists(select 1 from public.niveles where id=ct.nivel_id and activo) then
    raise exception 'Competencia, categoría o reglamento no están listos' using errcode='23514';
  end if;
  if exists(select 1 from unnest(p_jugadores) x left join public.jugadores j on j.id=x where j.id is null or not j.activo) then raise exception 'La nómina contiene un jugador inexistente o inactivo' using errcode='23514'; end if;
  if exists(select 1 from unnest(p_jugadores) x left join public.habilitaciones_jugador_categoria h on h.jugador_id=x and h.categoria_temporada_id=ct.id where h.estado is distinct from 'habilitado' or h.validado_por is null or h.validado_en is null or nullif(pg_catalog.btrim(h.motivo),'') is null or nullif(pg_catalog.btrim(h.referencia_evidencia),'') is null) then raise exception 'La nómina contiene jugadores sin habilitación vigente' using errcode='23514'; end if;
  if ct.criterio_nacimiento = 'rango_anios' and exists(select 1 from unnest(p_jugadores) x join public.jugadores j on j.id=x left join public.habilitaciones_jugador_categoria h on h.jugador_id=x and h.categoria_temporada_id=ct.id where h.tipo_resolucion is distinct from 'excepcion_documentada' and (j.fecha_nacimiento is null or extract(year from j.fecha_nacimiento) not between ct.anio_nacimiento_desde and ct.anio_nacimiento_hasta)) then raise exception 'La nómina contiene un nacimiento fuera de rango' using errcode='23514'; end if;
  -- 003 es el contrato disponible antes de 007: solo "preparada" permite corregir.
  -- La futura programación debe cambiar este estado antes de crear grupos o partidos;
  -- estados NULL/desconocidos se bloquean por seguridad, sin inspeccionar tablas futuras.
  if ctl.estado_deportivo is distinct from 'preparada' then raise exception 'La nómina no puede corregirse después de iniciar la programación' using errcode='55000'; end if;
  if exists(select 1 from public.participantes_competencia where competencia_id=c.id and not (jugador_id = any(p_jugadores)))
    and nullif(pg_catalog.btrim(p_motivo_retiro),'') is null then
    raise exception 'Las retiradas requieren un motivo' using errcode='22023';
  end if;
  for old_pc in select * from public.participantes_competencia where competencia_id=c.id and not (jugador_id = any(p_jugadores)) for update loop
    insert into public.participantes_competencia_historial(participante_id,jugador_id,competencia_id,evento,actor_id,fuente,referencia_trazabilidad,motivo)
      values(old_pc.id,old_pc.jugador_id,old_pc.competencia_id,'retirado',auth.uid(),p_fuente,pg_catalog.btrim(p_referencia_trazabilidad),pg_catalog.btrim(p_motivo_retiro));
    delete from public.participantes_competencia where id=old_pc.id;
  end loop;
  for v_jugador_id in select x from unnest(p_jugadores) x loop
    inserted_id := null;
    insert into public.participantes_competencia(jugador_id,competencia_id,confirmado_por,confirmado_en,fuente,referencia_trazabilidad)
      values(v_jugador_id,c.id,auth.uid(),pg_catalog.clock_timestamp(),p_fuente,pg_catalog.btrim(p_referencia_trazabilidad))
      on conflict (jugador_id,competencia_id) do nothing returning id into inserted_id;
    if inserted_id is not null then
      insert into public.participantes_competencia_historial(participante_id,jugador_id,competencia_id,evento,actor_id,fuente,referencia_trazabilidad)
        values(inserted_id,v_jugador_id,c.id,'confirmado',auth.uid(),p_fuente,pg_catalog.btrim(p_referencia_trazabilidad));
    end if;
  end loop;
  select count(*) into total from public.participantes_competencia where competencia_id=c.id;
  return total;
end;
$$;

create or replace function public.consultar_mis_participaciones()
returns table (competencia_id bigint, fecha_id bigint, jornada_numero integer, fecha date, comuna text, recinto text, categoria_codigo text, categoria_nombre text, inicio_programado timestamptz, confirmado_en timestamptz)
language plpgsql security definer set search_path = '' stable as $$
declare uid uuid := (select auth.uid()); v_jugador_id bigint;
begin
  if uid is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  select j.id into v_jugador_id from public.jugadores j join public.perfiles p on p.id=j.perfil_id where j.perfil_id=uid and p.rol='jugador'::public.rol_usuario;
  if v_jugador_id is null then return; end if;
  return query select c.id,f.id,f.numero,f.fecha,f.comuna,f.recinto,cat.codigo,cat.nombre,ctl.inicio_programado,pc.confirmado_en
    from public.participantes_competencia pc join public.competencias c on c.id=pc.competencia_id join public.fechas f on f.id=c.fecha_id and f.estado='publicada'
    join public.categorias_temporada ct on ct.id=c.categoria_temporada_id join public.categorias cat on cat.id=ct.categoria_id
    left join public.competencia_control_deportivo ctl on ctl.competencia_id=c.id where pc.jugador_id=v_jugador_id and c.activo and c.publicada order by f.fecha,f.numero,ct.codigo;
end; $$;

revoke all on function public.confirmar_participantes_competencia(bigint,bigint[],text,text,text), public.consultar_mis_participaciones() from public, anon, authenticated;
grant execute on function public.confirmar_participantes_competencia(bigint,bigint[],text,text,text) to authenticated;
grant execute on function public.consultar_mis_participaciones() to authenticated;
do $$ begin if exists(select 1 from pg_catalog.pg_roles where rolname='service_role') then execute 'revoke all on function public.confirmar_participantes_competencia(bigint,bigint[],text,text,text), public.consultar_mis_participaciones() from service_role'; end if; end $$;
comment on table public.participantes_competencia is 'Nómina oficial confirmada por competencia individual; no representa solicitud, pago ni ficha de jugador.';
commit;
