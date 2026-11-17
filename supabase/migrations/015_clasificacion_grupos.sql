-- Contrato y propuesta de tabla: documentacion/CLASIFICACION_GRUPOS.md.
-- Aplicación manual pendiente. Sin datos iniciales ni publicación pública.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create table public.clasificaciones_grupos_aprobaciones (
  id bigint generated always as identity primary key,
  grupo_id bigint not null references public.grupos_competencia(id) on delete restrict,
  snapshot jsonb not null,
  criterio text not null check(criterio='victorias_desc'),
  referencia text not null check(char_length(btrim(referencia)) between 1 and 1000),
  actor_id uuid not null references public.perfiles(id) on delete restrict,
  ocurrido_en timestamptz not null default clock_timestamp(),
  unique(grupo_id,snapshot)
);
alter table public.clasificaciones_grupos_aprobaciones enable row level security;
revoke all on public.clasificaciones_grupos_aprobaciones from public,anon,authenticated,service_role;
revoke all on sequence public.clasificaciones_grupos_aprobaciones_id_seq from public,anon,authenticated,service_role;
grant select on public.clasificaciones_grupos_aprobaciones to authenticated;
create policy clasificacion_operadores_015 on public.clasificaciones_grupos_aprobaciones for select to authenticated
  using((select public.es_juez_general()) or (select public.es_administrador()));

create function public.proteger_aprobacion_grupos_015() returns trigger
language plpgsql set search_path='' as $$
begin
  raise exception 'Aprobaciones inmutables' using errcode='55000';
end $$;
create trigger proteger_aprobacion_grupos_015 before update or delete on public.clasificaciones_grupos_aprobaciones
  for each row execute function public.proteger_aprobacion_grupos_015();
create trigger proteger_truncate_aprobacion_015 before truncate on public.clasificaciones_grupos_aprobaciones
  for each statement execute function public.proteger_aprobacion_grupos_015();

create function public.consultar_clasificacion_grupo(p_grupo_id bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare g public.grupos_competencia; filas jsonb; fuente jsonb; total integer; confirmados integer; pendientes integer; empatados boolean; aprobacion jsonb;
begin
  if auth.uid() is null
    or (public.es_juez_general() is distinct from true and public.es_administrador() is distinct from true) then
    raise exception 'Solo operadores deportivos' using errcode='42501'; end if;
  select * into g from public.grupos_competencia where id=p_grupo_id;
  if not found then raise exception 'Grupo no disponible' using errcode='22023'; end if;
  with oficiales as (
    select r.* from public.resultados_confirmados_grupos r
    join public.partidos p on p.id=r.partido_id join public.lotes_partidos_grupos l on l.id=p.lote_id
    where r.grupo_id=g.id and l.estado='confirmado'
  ), individuales as (
    select r.partido_id,r.jugador_a_id jugador_id,r.ganador_id,r.sets_a sf,r.sets_b sc,
      (select sum((s->>'a')::bigint) from jsonb_array_elements(r.sets) s) pf,
      (select sum((s->>'b')::bigint) from jsonb_array_elements(r.sets) s) pc from oficiales r
    union all
    select r.partido_id,r.jugador_b_id,r.ganador_id,r.sets_b,r.sets_a,
      (select sum((s->>'b')::bigint) from jsonb_array_elements(r.sets) s),
      (select sum((s->>'a')::bigint) from jsonb_array_elements(r.sets) s) from oficiales r
  ), resumen as (
    select gp.jugador_id,j.nombre_completo,count(i.partido_id)::integer pj,
      count(i.partido_id) filter(where i.ganador_id=gp.jugador_id)::integer pg,
      count(i.partido_id) filter(where i.ganador_id<>gp.jugador_id)::integer pp,
      coalesce(sum(i.sf),0) sf,coalesce(sum(i.sc),0) sc,coalesce(sum(i.pf),0) pf,coalesce(sum(i.pc),0) pc
    from public.grupo_participantes gp join public.jugadores j on j.id=gp.jugador_id
    left join individuales i on i.jugador_id=gp.jugador_id where gp.grupo_id=g.id group by gp.jugador_id,j.nombre_completo
  ), marcadas as (select *,count(*) over(partition by pg)>1 empate from resumen)
  select coalesce(jsonb_agg(to_jsonb(m) order by pg desc,jugador_id),'[]'::jsonb),coalesce(bool_or(empate),true)
    into filas,empatados from marcadas m;
  select count(*),count(r.resultado_id),count(*) filter(where coalesce(u.revision,0)<>coalesce(r.revision,0)),
    coalesce(jsonb_agg(jsonb_build_object('partido_id',p.id,'resultado_id',r.resultado_id,'revision_actual',u.revision) order by p.id),'[]'::jsonb)
    into total,confirmados,pendientes,fuente
    from public.partidos p join public.lotes_partidos_grupos l on l.id=p.lote_id
    left join public.resultados_confirmados_grupos r on r.partido_id=p.id
    left join lateral (select max(revision) revision from public.resultados_partidos where partido_id=p.id) u on true
    where p.grupo_id=g.id and l.estado='confirmado';
  fuente:=jsonb_build_object('grupo_id',g.id,'filas',filas,'partidos',fuente,'estado',g.estado);
  select jsonb_build_object('id',a.id,'vigente',a.snapshot=fuente,'actor_id',a.actor_id,'ocurrido_en',a.ocurrido_en,'referencia',a.referencia)
    into aprobacion from public.clasificaciones_grupos_aprobaciones a where a.grupo_id=g.id order by a.id desc limit 1;
  return jsonb_build_object('grupo_id',g.id,'numero',g.numero,'filas',filas,'total',total,'confirmados',confirmados,'pendientes',pendientes,
    'empate',empatados,'aprobable',g.estado='confirmado' and jsonb_array_length(filas) between 3 and 4
      and total=jsonb_array_length(filas)*(jsonb_array_length(filas)-1)/2 and confirmados=total and pendientes=0 and not empatados,
    'snapshot',fuente,'aprobacion',aprobacion);
end $$;

create function public.aprobar_clasificacion_grupo(p_grupo_id bigint,p_snapshot jsonb,p_referencia text,p_criterio_validado boolean,p_datos_reales boolean)
returns bigint language plpgsql security definer set search_path='' as $$
declare actual jsonb; nuevo bigint;
begin
  if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
  if p_criterio_validado is distinct from true or p_datos_reales is distinct from true
    or coalesce(char_length(btrim(p_referencia)),0) not between 1 and 1000 then
    raise exception 'Documente criterio validado y datos reales' using errcode='22023'; end if;
  perform 1 from public.grupos_competencia where id=p_grupo_id for update;
  perform 1 from public.partidos where grupo_id=p_grupo_id order by id for update;
  actual:=public.consultar_clasificacion_grupo(p_grupo_id);
  if p_snapshot is distinct from actual->'snapshot' then raise exception 'Clasificación cambió: recargue' using errcode='40001'; end if;
  if (actual->>'aprobable')::boolean is distinct from true then raise exception 'Faltan resultados o resolución de empate' using errcode='55000'; end if;
  insert into public.clasificaciones_grupos_aprobaciones(grupo_id,snapshot,criterio,referencia,actor_id)
    values(p_grupo_id,p_snapshot,'victorias_desc',btrim(p_referencia),auth.uid()) returning id into nuevo;
  return nuevo;
end $$;
revoke all on function public.proteger_aprobacion_grupos_015(),public.consultar_clasificacion_grupo(bigint),public.aprobar_clasificacion_grupo(bigint,jsonb,text,boolean,boolean) from public,anon,authenticated,service_role;
grant execute on function public.consultar_clasificacion_grupo(bigint),public.aprobar_clasificacion_grupo(bigint,jsonb,text,boolean,boolean) to authenticated;
commit;
