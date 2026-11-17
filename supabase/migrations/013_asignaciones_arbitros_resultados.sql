-- Migración incremental sobre 012. No modifica 001–012 ni inserta datos.
-- Aplicación manual pendiente; no ejecutar en Supabase real desde esta tarea.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.partidos_arbitros (
  partido_id bigint primary key references public.partidos(id) on delete restrict,
  arbitro_id uuid not null references public.perfiles(id) on delete restrict,
  asignado_por uuid not null references public.perfiles(id) on delete restrict,
  asignado_en timestamptz not null default clock_timestamp(),
  referencia text not null check (char_length(btrim(referencia)) between 1 and 1000),
  activo boolean not null default true
);
create table public.partidos_arbitros_historial (
  id bigint generated always as identity primary key,
  partido_id bigint not null references public.partidos(id) on delete restrict,
  arbitro_id uuid not null references public.perfiles(id) on delete restrict,
  evento text not null check (evento in ('asignado','reemplazado','retirado')),
  actor_id uuid not null references public.perfiles(id) on delete restrict,
  ocurrido_en timestamptz not null default clock_timestamp(),
  referencia text not null check (char_length(btrim(referencia)) between 1 and 1000)
);
create table public.resultados_partidos_observaciones (
  id bigint generated always as identity primary key,
  resultado_id bigint not null references public.resultados_partidos(id) on delete restrict,
  juez_id uuid not null references public.perfiles(id) on delete restrict,
  observacion text not null check (char_length(btrim(observacion)) between 1 and 2000),
  creado_en timestamptz not null default clock_timestamp()
);
create index partidos_arbitros_arbitro_idx on public.partidos_arbitros(arbitro_id, activo);

create function public.es_arbitro_013() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.perfiles where id=auth.uid() and rol='arbitro'::public.rol_usuario)
$$;
create policy perfiles_arbitros_juez_013 on public.perfiles for select to authenticated using (rol='arbitro'::public.rol_usuario and (select public.es_juez_general()));

create function public.asignar_arbitro_partido(p_partido_id bigint,p_arbitro_id uuid,p_referencia text)
returns bigint language plpgsql security definer set search_path='' as $$
declare p public.partidos; l public.lotes_partidos_grupos; actual public.partidos_arbitros; evento text;
begin
  if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
  if p_arbitro_id is null or nullif(btrim(p_referencia),'') is null then raise exception 'Árbitro y referencia son obligatorios' using errcode='22023'; end if;
  select * into p from public.partidos where id=p_partido_id for update;
  if not found then raise exception 'Partido no disponible' using errcode='22023'; end if;
  select * into l from public.lotes_partidos_grupos where id=p.lote_id for share;
  if l.estado is distinct from 'confirmado' then raise exception 'Solo se asignan partidos confirmados' using errcode='55000'; end if;
  if not exists(select 1 from public.perfiles where id=p_arbitro_id and rol='arbitro'::public.rol_usuario) then raise exception 'Perfil no es Árbitro' using errcode='22023'; end if;
  if exists(select 1 from public.jugadores where perfil_id=p_arbitro_id and id in (p.jugador_a_id,p.jugador_b_id)) then
    raise exception 'No se permite autoarbitraje' using errcode='23514'; end if;
  select * into actual from public.partidos_arbitros where partido_id=p.id for update;
  if actual.partido_id is not null and exists(select 1 from public.resultados_partidos where partido_id=p.id) then
    raise exception 'No se puede reemplazar el rbitro despus de iniciar el historial de resultados' using errcode='55000';
  end if;
  evento := case when actual.partido_id is null then 'asignado' else case when actual.arbitro_id=p_arbitro_id then 'asignado' else 'reemplazado' end end;
  insert into public.partidos_arbitros(partido_id,arbitro_id,asignado_por,referencia,activo)
    values(p.id,p_arbitro_id,auth.uid(),btrim(p_referencia),true)
    on conflict(partido_id) do update set arbitro_id=excluded.arbitro_id,asignado_por=excluded.asignado_por,
      asignado_en=clock_timestamp(),referencia=excluded.referencia,activo=true;
  insert into public.partidos_arbitros_historial(partido_id,arbitro_id,evento,actor_id,referencia)
    values(p.id,p_arbitro_id,evento,auth.uid(),btrim(p_referencia));
  return p.id;
end $$;

create or replace function public.puede_capturar_resultado_012(p_partido_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and public.es_arbitro_013()
    and exists(select 1 from public.partidos_arbitros pa where pa.partido_id=p_partido_id and pa.arbitro_id=auth.uid() and pa.activo)
$$;

create or replace function public.proteger_resultados_012() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.partidos; l public.lotes_partidos_grupos; r public.resultados_partidos; resumen jsonb; ultima integer; asignado uuid;
begin
  if tg_op<>'INSERT' then raise exception 'Actas y eventos inmutables: cree una revisión autorizada' using errcode='55000'; end if;
  if tg_table_name='resultados_partidos' then
    if auth.uid() is null or public.puede_capturar_resultado_012(new.partido_id) is distinct from true then raise exception 'Solo el Árbitro asignado puede capturar' using errcode='42501'; end if;
    select * into p from public.partidos where id=new.partido_id for update;
    select * into l from public.lotes_partidos_grupos where id=p.lote_id for share;
    select arbitro_id into asignado from public.partidos_arbitros where partido_id=p.id and activo;
    if l.estado is distinct from 'confirmado' or asignado is distinct from auth.uid() then raise exception 'Partido sin asignación activa' using errcode='55000'; end if;
    select coalesce(max(revision),0) into ultima from public.resultados_partidos where partido_id=p.id;
    if new.revision<>ultima+1 or new.autor_id is distinct from auth.uid() or new.mejor_de<>l.mejor_de then raise exception 'Revisión, autor o formato incompatibles' using errcode='40001'; end if;
    if new.tipo='ordinario' then
      resumen:=public.calcular_resultado_sets_012(new.sets,l.mejor_de);
      if new.sets_a is distinct from (resumen->>'sets_a')::integer or new.sets_b is distinct from (resumen->>'sets_b')::integer
        or new.ganador_id is distinct from (case when resumen->>'ganador'='a' then p.jugador_a_id else p.jugador_b_id end) then
        raise exception 'Resumen no coincide con los sets' using errcode='23514'; end if;
    end if;
    new.creado_en:=clock_timestamp();
  else
    if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General confirma' using errcode='42501'; end if;
    select * into r from public.resultados_partidos where id=new.resultado_id;
    perform 1 from public.partidos where id=r.partido_id for update;
    if r.tipo is distinct from 'ordinario' or new.actor_id is distinct from auth.uid()
      or r.revision is distinct from (select max(revision) from public.resultados_partidos where partido_id=r.partido_id) then
      raise exception 'Revise la última captura ordinaria; incidencia pendiente de resolución' using errcode='55000'; end if;
    perform public.calcular_resultado_sets_012(r.sets,r.mejor_de);
  end if;
  return new;
end $$;

create or replace function public.capturar_resultado_partido(p_partido_id bigint,p_revision_esperada integer,p_tipo text,p_sets jsonb,
  p_referencia text,p_referencia_reglas text,p_reglas_confirmadas boolean,p_descripcion text default '',p_motivo text default null)
returns bigint language plpgsql security definer set search_path='' as $$
declare p public.partidos; l public.lotes_partidos_grupos; ultima integer; resumen jsonb; nuevo bigint;
begin
  if auth.uid() is null or public.puede_capturar_resultado_012(p_partido_id) is distinct from true then raise exception 'Solo el Árbitro asignado puede capturar' using errcode='42501'; end if;
  if p_revision_esperada is null or p_revision_esperada<0 or p_tipo is null or p_tipo not in ('ordinario','incomparecencia','retiro','suspension')
    or nullif(btrim(p_referencia),'') is null or nullif(btrim(p_referencia_reglas),'') is null or p_reglas_confirmadas is distinct from true then raise exception 'Datos o reglas no confirmadas' using errcode='22023'; end if;
  select * into p from public.partidos where id=p_partido_id for update;
  select * into l from public.lotes_partidos_grupos where id=p.lote_id for share;
  if l.estado is distinct from 'confirmado' then raise exception 'Solo partidos confirmados' using errcode='55000'; end if;
  select coalesce(max(revision),0) into ultima from public.resultados_partidos where partido_id=p.id;
  if ultima<>p_revision_esperada then raise exception 'La captura cambió: recargue' using errcode='40001'; end if;
  if ultima>0 and nullif(btrim(p_motivo),'') is null then raise exception 'Corrección requiere motivo' using errcode='22023'; end if;
  if p_tipo='ordinario' then resumen:=public.calcular_resultado_sets_012(p_sets,l.mejor_de);
  elsif p_sets is distinct from '[]'::jsonb or nullif(btrim(p_descripcion),'') is null then raise exception 'Incidencia requiere descripción, sin sets ni ganador automático' using errcode='22023'; end if;
  insert into public.resultados_partidos(partido_id,revision,tipo,sets,mejor_de,sets_a,sets_b,ganador_id,descripcion,referencia_reglas,referencia,motivo_correccion,autor_id)
    values(p.id,ultima+1,p_tipo,p_sets,l.mejor_de,(resumen->>'sets_a')::integer,(resumen->>'sets_b')::integer,
      case when resumen->>'ganador'='a' then p.jugador_a_id when resumen->>'ganador'='b' then p.jugador_b_id end,
      coalesce(btrim(p_descripcion),''),btrim(p_referencia_reglas),btrim(p_referencia),nullif(btrim(p_motivo),''),auth.uid()) returning id into nuevo;
  return nuevo;
end $$;

create function public.observar_resultado_partido(p_partido_id bigint,p_resultado_id bigint,p_revision_esperada integer,p_observacion text)
returns bigint language plpgsql security definer set search_path='' as $$
declare r public.resultados_partidos;
begin
  if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
  if nullif(btrim(p_observacion),'') is null or char_length(p_observacion)>2000 then raise exception 'Observación obligatoria' using errcode='22023'; end if;
  perform 1 from public.partidos where id=p_partido_id for update;
  select * into r from public.resultados_partidos where id=p_resultado_id and partido_id=p_partido_id;
  if not found or r.revision is distinct from p_revision_esperada or r.revision<>(select max(revision) from public.resultados_partidos where partido_id=p_partido_id)
    or exists(select 1 from public.resultados_partidos_eventos where resultado_id=r.id) then raise exception 'Resultado obsoleto o ya confirmado' using errcode='40001'; end if;
  insert into public.resultados_partidos_observaciones(resultado_id,juez_id,observacion) values(r.id,auth.uid(),btrim(p_observacion));
  return r.id;
end $$;

alter table public.partidos_arbitros enable row level security;
alter table public.partidos_arbitros_historial enable row level security;
alter table public.resultados_partidos_observaciones enable row level security;
drop policy if exists partidos_arbitros_operadores_013 on public.partidos_arbitros;
drop policy if exists partidos_arbitros_historial_013 on public.partidos_arbitros_historial;
create policy partidos_arbitros_operadores_013 on public.partidos_arbitros for select to authenticated using ((select public.es_juez_general()) or (select public.es_administrador()) or arbitro_id=(select auth.uid()));
create policy partidos_arbitros_historial_013 on public.partidos_arbitros_historial for select to authenticated using ((select public.es_juez_general()) or (select public.es_administrador()) or arbitro_id=(select auth.uid()));
create policy resultados_observaciones_013 on public.resultados_partidos_observaciones for select to authenticated using ((select public.es_juez_general()) or (select public.es_administrador()) or exists(select 1 from public.resultados_partidos r join public.partidos_arbitros pa on pa.partido_id=r.partido_id where r.id=resultados_partidos_observaciones.resultado_id and pa.arbitro_id=(select auth.uid()) and pa.activo));
alter table public.resultados_partidos enable row level security;
alter table public.resultados_partidos_eventos enable row level security;
drop policy if exists resultados_operadores_012 on public.resultados_partidos;
drop policy if exists eventos_resultados_operadores_012 on public.resultados_partidos_eventos;
create policy resultados_operadores_013 on public.resultados_partidos for select to authenticated using ((select public.es_juez_general()) or (select public.es_administrador()) or exists(select 1 from public.partidos_arbitros pa where pa.partido_id=resultados_partidos.partido_id and pa.arbitro_id=(select auth.uid()) and pa.activo));
create policy eventos_resultados_013 on public.resultados_partidos_eventos for select to authenticated using ((select public.es_juez_general()) or (select public.es_administrador()));
revoke all on public.partidos_arbitros,public.partidos_arbitros_historial from public,anon,authenticated,service_role;
revoke all on public.resultados_partidos_observaciones from public,anon,authenticated,service_role;
grant select on public.partidos_arbitros,public.partidos_arbitros_historial,public.resultados_partidos_observaciones to authenticated;
revoke all on function public.es_arbitro_013(),public.asignar_arbitro_partido(bigint,uuid,text),public.puede_capturar_resultado_012(bigint),public.proteger_resultados_012(),public.capturar_resultado_partido(bigint,integer,text,jsonb,text,text,boolean,text,text),public.observar_resultado_partido(bigint,bigint,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.asignar_arbitro_partido(bigint,uuid,text),public.capturar_resultado_partido(bigint,integer,text,jsonb,text,text,boolean,text,text),public.observar_resultado_partido(bigint,bigint,integer,text) to authenticated;
commit;
