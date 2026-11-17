-- Organización de grupos ordinarios por competencia individual.
-- Dependencia: 009_participantes_competencia.sql.
-- No crea partidos, mesas, árbitros, eliminatorias ni ranking.
begin;

create table public.grupos_competencia (
  id bigint generated always as identity primary key,
  competencia_id bigint not null references public.competencias(id) on delete restrict,
  numero integer not null check (numero > 0),
  estado text not null default 'borrador' check (estado in ('borrador','confirmado')),
  creado_por uuid not null references public.perfiles(id) on delete restrict,
  creado_en timestamptz not null default pg_catalog.clock_timestamp(),
  confirmado_por uuid references public.perfiles(id) on delete restrict,
  confirmado_en timestamptz,
  metodo_distribucion text not null default 'manual' check (metodo_distribucion in ('manual','sin_siembra','serpiente')),
  fuente_deportiva text check (fuente_deportiva is null or fuente_deportiva in ('ranking_liga','ranking_nacional','orden_manual_validado')),
  orden_siembra jsonb check (orden_siembra is null or pg_catalog.jsonb_typeof(orden_siembra) = 'array'),
  ajustes_manuales jsonb not null default '[]'::jsonb check (pg_catalog.jsonb_typeof(ajustes_manuales) = 'array'),
  referencia_trazabilidad text not null check (char_length(pg_catalog.btrim(referencia_trazabilidad)) between 1 and 1000),
  unique (competencia_id, numero),
  check ((estado = 'borrador' and confirmado_por is null and confirmado_en is null)
      or (estado = 'confirmado' and confirmado_por is not null and confirmado_en is not null)),
  check ((metodo_distribucion = 'serpiente' and fuente_deportiva is not null and orden_siembra is not null)
      or metodo_distribucion <> 'serpiente')
);

create table public.grupo_participantes (
  id bigint generated always as identity primary key,
  grupo_id bigint not null references public.grupos_competencia(id) on delete cascade,
  jugador_id bigint not null references public.jugadores(id) on delete restrict,
  posicion integer not null check (posicion between 1 and 4),
  unique (grupo_id, jugador_id),
  unique (grupo_id, posicion)
);

create table public.grupos_competencia_historial (
  id bigint generated always as identity primary key,
  competencia_id bigint not null references public.competencias(id) on delete restrict,
  evento text not null check (evento in ('borrador_guardado','confirmado')),
  distribucion jsonb not null check (jsonb_typeof(distribucion) = 'array'),
  metodo_distribucion text not null check (metodo_distribucion in ('manual','sin_siembra','serpiente')),
  fuente_deportiva text check (fuente_deportiva is null or fuente_deportiva in ('ranking_liga','ranking_nacional','orden_manual_validado')),
  orden_siembra jsonb check (orden_siembra is null or pg_catalog.jsonb_typeof(orden_siembra) = 'array'),
  ajustes_manuales jsonb not null default '[]'::jsonb check (pg_catalog.jsonb_typeof(ajustes_manuales) = 'array'),
  actor_id uuid not null references public.perfiles(id) on delete restrict,
  ocurrido_en timestamptz not null default pg_catalog.clock_timestamp(),
  referencia_trazabilidad text not null check (char_length(pg_catalog.btrim(referencia_trazabilidad)) between 1 and 1000)
);

create index grupo_participantes_jugador_idx on public.grupo_participantes(jugador_id);
create index grupos_competencia_competencia_idx on public.grupos_competencia(competencia_id, estado);

alter table public.grupos_competencia enable row level security;
alter table public.grupo_participantes enable row level security;
alter table public.grupos_competencia_historial enable row level security;
revoke all on public.grupos_competencia, public.grupo_participantes, public.grupos_competencia_historial from public, anon, authenticated;
grant select on public.grupos_competencia, public.grupo_participantes, public.grupos_competencia_historial to authenticated;
create policy grupos_operadores on public.grupos_competencia for select to authenticated using ((select public.es_administrador()) or (select public.es_juez_general()));
create policy grupo_participantes_operadores on public.grupo_participantes for select to authenticated using ((select public.es_administrador()) or (select public.es_juez_general()));
create policy grupos_historial_operadores on public.grupos_competencia_historial for select to authenticated using ((select public.es_administrador()) or (select public.es_juez_general()));

create or replace function public.validar_grupos_competencia(p_competencia_id bigint, p_grupos jsonb, p_metodo_distribucion text default 'manual', p_fuente_deportiva text default null, p_orden_siembra jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.competencias; f public.fechas; ct public.categorias_temporada;
  ctl public.competencia_control_deportivo; r public.reglamentos_temporada;
  v_total integer;
  v_seen bigint[] := array[]::bigint[];
  v_group jsonb;
  v_ids bigint[];
  v_numero integer;
  v_ordinal integer;
  v_jugador bigint;
  v_seed jsonb;
begin
  -- Mismo orden que 009: mutex de nomina antes de bloquear la competencia.
  perform pg_catalog.pg_advisory_xact_lock(2026003, 2);
  select * into c from public.competencias where id=p_competencia_id for update;
  if not found or c.activo is distinct from true or c.publicada is distinct from true then
    raise exception 'Competencia no disponible' using errcode='23514';
  end if;
  select * into f from public.fechas where id=c.fecha_id and temporada_id=c.temporada_id for share;
  select * into ct from public.categorias_temporada where id=c.categoria_temporada_id and temporada_id=c.temporada_id for share;
  select * into ctl from public.competencia_control_deportivo where competencia_id=c.id for share;
  select * into r from public.reglamentos_temporada where id=ct.reglamento_id and temporada_id=c.temporada_id for share;
  perform 1 from public.categorias where id=ct.categoria_id and activo for share;
  if not found then raise exception 'Categoria inactiva' using errcode='23514'; end if;
  perform 1 from public.niveles where id=ct.nivel_id and activo for share;
  if not found or f.estado is distinct from 'publicada' or ct.activo is distinct from true
    or ct.rama is null or ct.criterio_nacimiento is null or ct.criterio_nacimiento='pendiente'
    or ctl.configuracion_aprobada is distinct from true or ctl.inicio_programado is null
    or ctl.reglamento_id is distinct from r.id or r.id is null or r.estado_revision is distinct from 'validado'
    or nullif(pg_catalog.btrim(r.referencia_aprobacion),'') is null
    or ctl.grupo_minimo is distinct from 3 or ctl.grupo_maximo is distinct from 4
    or (select count(*) from public.competencia_formatos_sets where competencia_id=c.id) <> 5 then
    raise exception 'Jornada, preparacion o reglamento no disponibles para grupos ordinarios' using errcode='23514';
  end if;
  if ctl.estado_deportivo is distinct from 'preparada' then
    raise exception 'La competencia ya no permite organizar grupos' using errcode='55000';
  end if;
  if p_metodo_distribucion not in ('manual','sin_siembra','serpiente') then
    raise exception 'Método de distribución no válido' using errcode='22023';
  end if;
  if p_metodo_distribucion = 'serpiente' then
    raise exception 'La distribución serpiente aún no está implementada; no se puede afirmar una siembra inexistente' using errcode='0A000';
  end if;
  if p_fuente_deportiva is not null and p_fuente_deportiva not in ('ranking_liga','ranking_nacional','orden_manual_validado') then
    raise exception 'Fuente deportiva no válida' using errcode='22023';
  end if;
  if p_grupos is null or pg_catalog.jsonb_typeof(p_grupos) <> 'array' then
    raise exception 'La propuesta de grupos no es válida' using errcode='22023';
  end if;
  select count(*) into v_total from public.participantes_competencia where competencia_id = p_competencia_id;
  if v_total < greatest(4,ctl.minimo_participantes) then raise exception 'La competencia necesita al menos cuatro participantes confirmados' using errcode='23514'; end if;
  if (select count(*) from pg_catalog.jsonb_array_elements(p_grupos)) = 0 then raise exception 'La propuesta debe contener grupos' using errcode='22023'; end if;
  for v_group, v_ordinal in select value, ordinality::integer from pg_catalog.jsonb_array_elements(p_grupos) with ordinality loop
    if pg_catalog.jsonb_typeof(v_group) is distinct from 'object'
      or pg_catalog.jsonb_typeof(v_group->'jugador_ids') is distinct from 'array' then
      raise exception 'Cada grupo debe contener una lista de jugadores' using errcode='22023';
    end if;
    v_numero := coalesce(nullif(v_group->>'numero','')::integer, v_ordinal);
    v_ids := coalesce(array(select jsonb_array_elements_text(v_group->'jugador_ids')::bigint), array[]::bigint[]);
    if pg_catalog.cardinality(v_ids) not between 3 and 4 then raise exception 'Cada grupo debe tener tres o cuatro jugadores' using errcode='23514'; end if;
    if exists(select 1 from unnest(v_ids) x group by x having count(*) > 1) then raise exception 'Un jugador no puede repetirse dentro de un grupo' using errcode='22023'; end if;
    if v_numero <> v_ordinal then raise exception 'Los grupos deben numerarse consecutivamente' using errcode='22023'; end if;
    foreach v_jugador in array v_ids loop
      if v_jugador is null or v_jugador = any(v_seen) then raise exception 'Un jugador no puede aparecer en más de un grupo' using errcode='22023'; end if;
      if not exists(select 1 from public.participantes_competencia where competencia_id = p_competencia_id and jugador_id = v_jugador) then raise exception 'La propuesta contiene un jugador que no está confirmado en la competencia' using errcode='23514'; end if;
      v_seen := array_append(v_seen, v_jugador);
    end loop;
  end loop;
  if cardinality(v_seen) <> v_total or exists(select 1 from public.participantes_competencia where competencia_id = p_competencia_id and not (jugador_id = any(v_seen))) then
    raise exception 'La propuesta debe incluir exactamente toda la nómina confirmada' using errcode='23514';
  end if;
  if p_metodo_distribucion = 'serpiente' and p_fuente_deportiva is null then
    raise exception 'La distribución serpiente exige una fuente deportiva' using errcode='23514';
  end if;
  if p_metodo_distribucion = 'serpiente' and (p_orden_siembra is null or pg_catalog.jsonb_typeof(p_orden_siembra) <> 'array') then
    raise exception 'La distribución serpiente exige un orden de siembra completo' using errcode='23514';
  end if;
  if p_orden_siembra is not null then
    if pg_catalog.jsonb_typeof(p_orden_siembra) <> 'array'
      or (select count(*) from pg_catalog.jsonb_array_elements(p_orden_siembra)) <> v_total then
      raise exception 'El orden de siembra debe incluir exactamente toda la nómina' using errcode='23514';
    end if;
    if exists(select 1 from pg_catalog.jsonb_array_elements(p_orden_siembra) item where pg_catalog.jsonb_typeof(item) <> 'object' or (item->>'jugador_id') is null or (item->>'posicion_ranking') is null) then
      raise exception 'Cada siembra debe identificar jugador_id y posicion_ranking' using errcode='22023';
    end if;
    if exists(select 1 from pg_catalog.jsonb_array_elements(p_orden_siembra) item where (item->>'jugador_id') !~ '^[0-9]+$' or (item->>'posicion_ranking') !~ '^[0-9]+$' or (item->>'jugador_id')::numeric <= 0 or (item->>'posicion_ranking')::numeric <= 0) then
      raise exception 'jugador_id y posicion_ranking deben ser enteros positivos' using errcode='22023';
    end if;
    if exists(select 1 from pg_catalog.jsonb_array_elements(p_orden_siembra) item group by ((item->>'jugador_id')::numeric) having count(*) > 1)
      or exists(select 1 from pg_catalog.jsonb_array_elements(p_orden_siembra) item group by ((item->>'posicion_ranking')::numeric) having count(*) > 1)
      or exists(select 1 from pg_catalog.jsonb_array_elements(p_orden_siembra) item where (item->>'posicion_ranking')::numeric not between 1 and v_total)
      or exists(select 1 from pg_catalog.jsonb_array_elements(p_orden_siembra) item where not exists(select 1 from public.participantes_competencia pc where pc.competencia_id=p_competencia_id and pc.jugador_id=(item->>'jugador_id')::numeric)) then
      raise exception 'El orden de siembra no es completo, único o no corresponde a la nómina' using errcode='23514';
    end if;
  end if;
end;
$$;

create or replace function public.guardar_grupos_competencia(p_competencia_id bigint, p_grupos jsonb, p_referencia_trazabilidad text, p_metodo_distribucion text default 'manual', p_fuente_deportiva text default null, p_orden_siembra jsonb default null, p_ajustes_manuales jsonb default '[]'::jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_group jsonb; v_ordinal integer; v_group_id bigint; v_ids bigint[]; v_jugador bigint; v_count integer;
begin
  if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo el Juez General puede organizar grupos' using errcode='42501'; end if;
  if nullif(pg_catalog.btrim(p_referencia_trazabilidad),'') is null then raise exception 'La trazabilidad es obligatoria' using errcode='22023'; end if;
  if p_ajustes_manuales is null or pg_catalog.jsonb_typeof(p_ajustes_manuales) <> 'array' then raise exception 'Los ajustes manuales deben ser una lista' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(2026003, 2);
  perform 1 from public.competencias where id=p_competencia_id for update;
  if exists(select 1 from public.grupos_competencia where competencia_id=p_competencia_id and estado='confirmado') then raise exception 'Los grupos ya están confirmados y no pueden modificarse' using errcode='55000'; end if;
  if not exists(select 1 from public.competencias where id=p_competencia_id and activo and publicada) then raise exception 'Competencia no disponible' using errcode='23514'; end if;
  perform public.validar_grupos_competencia(p_competencia_id,p_grupos,p_metodo_distribucion,p_fuente_deportiva,p_orden_siembra);
  delete from public.grupos_competencia where competencia_id=p_competencia_id;
  for v_group, v_ordinal in select value, ordinality::integer from pg_catalog.jsonb_array_elements(p_grupos) with ordinality loop
    insert into public.grupos_competencia(competencia_id,numero,creado_por,referencia_trazabilidad,metodo_distribucion,fuente_deportiva,orden_siembra,ajustes_manuales) values(p_competencia_id,v_ordinal,auth.uid(),pg_catalog.btrim(p_referencia_trazabilidad),p_metodo_distribucion,p_fuente_deportiva,p_orden_siembra,p_ajustes_manuales) returning id into v_group_id;
    v_ids := array(select jsonb_array_elements_text(v_group->'jugador_ids')::bigint);
    v_count := 0;
    foreach v_jugador in array v_ids loop
      v_count := v_count + 1;
      insert into public.grupo_participantes(grupo_id,jugador_id,posicion) values(v_group_id,v_jugador,v_count);
    end loop;
  end loop;
  insert into public.grupos_competencia_historial(competencia_id,evento,actor_id,referencia_trazabilidad,distribucion,metodo_distribucion,fuente_deportiva,orden_siembra,ajustes_manuales) values(p_competencia_id,'borrador_guardado',auth.uid(),pg_catalog.btrim(p_referencia_trazabilidad),p_grupos,p_metodo_distribucion,p_fuente_deportiva,p_orden_siembra,p_ajustes_manuales);
  return pg_catalog.jsonb_array_length(p_grupos);
end;
$$;

create or replace function public.confirmar_grupos_competencia(p_competencia_id bigint, p_referencia_trazabilidad text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_groups jsonb; v_count integer; v_metodo text; v_fuente text; v_seed jsonb; v_ajustes jsonb;
begin
  if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo el Juez General puede confirmar grupos' using errcode='42501'; end if;
  if nullif(pg_catalog.btrim(p_referencia_trazabilidad),'') is null then raise exception 'La trazabilidad es obligatoria' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(2026003, 2);
  perform 1 from public.competencias where id=p_competencia_id for update;
  select coalesce(jsonb_agg(jsonb_build_object('numero',g.numero,'jugador_ids',(select jsonb_agg(gp.jugador_id order by gp.posicion) from public.grupo_participantes gp where gp.grupo_id=g.id)) order by g.numero),'[]'::jsonb), min(g.metodo_distribucion), min(g.fuente_deportiva), (array_agg(g.orden_siembra))[1], (array_agg(g.ajustes_manuales))[1] into v_groups,v_metodo,v_fuente,v_seed,v_ajustes from public.grupos_competencia g where g.competencia_id=p_competencia_id and g.estado='borrador';
  perform public.validar_grupos_competencia(p_competencia_id,v_groups,v_metodo,v_fuente,v_seed);
  update public.grupos_competencia set estado='confirmado',confirmado_por=auth.uid(),confirmado_en=pg_catalog.clock_timestamp(),referencia_trazabilidad=pg_catalog.btrim(p_referencia_trazabilidad) where competencia_id=p_competencia_id and estado='borrador';
  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception 'No hay grupos preliminares para confirmar' using errcode='22023'; end if;
  insert into public.grupos_competencia_historial(competencia_id,evento,actor_id,referencia_trazabilidad,distribucion,metodo_distribucion,fuente_deportiva,orden_siembra,ajustes_manuales) values(p_competencia_id,'confirmado',auth.uid(),pg_catalog.btrim(p_referencia_trazabilidad),v_groups,v_metodo,v_fuente,v_seed,v_ajustes);
  return v_count;
end;
$$;

create or replace function public.bloquear_nomina_con_grupos()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(2026003, 2);
  if tg_op = 'UPDATE' and old.competencia_id <> new.competencia_id then
    raise exception 'No se permite trasladar participantes entre competencias' using errcode='55000';
  end if;
  if exists(select 1 from public.grupos_competencia where competencia_id=(case when tg_op = 'DELETE' then old.competencia_id else new.competencia_id end) and estado='confirmado') then
    raise exception 'La nómina está bloqueada porque los grupos ya fueron confirmados' using errcode='55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger z_bloquear_nomina_con_grupos before insert or update or delete on public.participantes_competencia for each row execute function public.bloquear_nomina_con_grupos();

revoke all on function public.validar_grupos_competencia(bigint,jsonb,text,text,jsonb), public.guardar_grupos_competencia(bigint,jsonb,text,text,text,jsonb,jsonb), public.confirmar_grupos_competencia(bigint,text), public.bloquear_nomina_con_grupos() from public, anon, authenticated;
grant execute on function public.guardar_grupos_competencia(bigint,jsonb,text,text,text,jsonb,jsonb), public.confirmar_grupos_competencia(bigint,text) to authenticated;
revoke all on sequence public.grupos_competencia_id_seq, public.grupo_participantes_id_seq, public.grupos_competencia_historial_id_seq from public, anon, authenticated;
-- No depender de privilegios por defecto del entorno Supabase.
do $$ begin
  if exists(select 1 from pg_catalog.pg_roles where rolname='service_role') then
    revoke all on public.grupos_competencia, public.grupo_participantes, public.grupos_competencia_historial from service_role;
    revoke all on sequence public.grupos_competencia_id_seq, public.grupo_participantes_id_seq, public.grupos_competencia_historial_id_seq from service_role;
    revoke all on function public.validar_grupos_competencia(bigint,jsonb,text,text,jsonb), public.guardar_grupos_competencia(bigint,jsonb,text,text,text,jsonb,jsonb), public.confirmar_grupos_competencia(bigint,text), public.bloquear_nomina_con_grupos() from service_role;
  end if;
end $$;
commit;

