-- Lectura pública incremental. Revisión y aplicación MANUAL; sin tablas ni datos nuevos.
-- Requiere el esquema deportivo 001–024. No amplía SELECT sobre tablas privadas.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create function public.consultar_torneos_publicos_025(p_competencia_id bigint default null)
returns jsonb language sql stable security definer set search_path='' as $$
with jornadas as materialized (
  select f.id,f.temporada_id,f.numero,f.fecha,f.comuna,f.recinto,f.estado
  from public.fechas f where f.estado in ('publicada','finalizada')
), competencias as materialized (
  select c.id,c.fecha_id,concat_ws(' · ',cat.nombre,n.nombre,ct.rama) nombre,
    case when cuadro.estado='finalizado' then 'finalizada' else ctl.estado_deportivo end estado,
    ctl.inicio_programado inicio,
    case when cuadro.estado='finalizado' and final.estado='confirmado' then campeon.nombre_completo end campeon,
    case when cuadro.estado='finalizado' and final.estado='confirmado' then finalista.nombre_completo end subcampeon
  from public.competencias c join jornadas f on f.id=c.fecha_id
  join public.categorias_temporada ct on ct.id=c.categoria_temporada_id
  join public.categorias cat on cat.id=ct.categoria_id join public.niveles n on n.id=ct.nivel_id
  join public.competencia_control_deportivo ctl on ctl.competencia_id=c.id
  left join public.eliminatorias_llaves llave on llave.competencia_id=c.id and llave.estado='confirmada'
  left join public.eliminatorias_cuadros cuadro on cuadro.llave_id=llave.id
  left join public.eliminatorias_rondas ronda on ronda.llave_id=llave.id and ronda.posiciones=2
  left join public.eliminatorias_partidos final on final.ronda_id=ronda.id and final.llave_id=llave.id
    and final.ganador_id=cuadro.campeon_id and final.perdedor_id=cuadro.finalista_id
  left join public.jugadores campeon on campeon.id=cuadro.campeon_id
  left join public.jugadores finalista on finalista.id=cuadro.finalista_id
  where c.publicada and c.activo and ctl.configuracion_aprobada
), grupos as materialized (
  select g.id,g.numero,g.estado from public.grupos_competencia g
  join competencias c on c.id=g.competencia_id
  where c.id=p_competencia_id and g.estado='confirmado'
), oficiales as materialized (
  select r.* from public.resultados_confirmados_grupos r
  join public.partidos p on p.id=r.partido_id
  join public.lotes_partidos_grupos l on l.id=p.lote_id and l.estado='confirmado'
  join grupos g on g.id=p.grupo_id
), grupos_publicos as (
  select g.numero,
    coalesce((select jsonb_agg(j.nombre_completo order by gp.posicion) from public.grupo_participantes gp
      join public.jugadores j on j.id=gp.jugador_id where gp.grupo_id=g.id),'[]'::jsonb) jugadores,
    coalesce((select jsonb_agg(jsonb_build_object('nombre',fila->>'nombre_completo','pj',fila->'pj',
      'pg',fila->'pg','pp',fila->'pp','sf',fila->'sf','sc',fila->'sc') order by posicion)
      from (select a.snapshot from public.clasificaciones_grupos_aprobaciones a where a.grupo_id=g.id order by a.id desc limit 1) aprobacion,
      lateral jsonb_array_elements(aprobacion.snapshot->'filas') with ordinality as filas(fila,posicion)
      -- La aprobación debe corresponder exactamente a los resultados y revisiones actuales.
      where aprobacion.snapshot->>'estado'=g.estado
      and aprobacion.snapshot->'partidos'=(select coalesce(jsonb_agg(jsonb_build_object('partido_id',p.id,
        'resultado_id',r.resultado_id,'revision_actual',u.revision) order by p.id),'[]'::jsonb)
        from public.partidos p join public.lotes_partidos_grupos l on l.id=p.lote_id and l.estado='confirmado'
        left join oficiales r on r.partido_id=p.id
        left join lateral (select max(revision) revision from public.resultados_partidos where partido_id=p.id) u on true
        where p.grupo_id=g.id)
      and (select count(*) from public.grupo_participantes where grupo_id=g.id)=jsonb_array_length(aprobacion.snapshot->'filas')
      and not exists(select 1 from jsonb_array_elements(aprobacion.snapshot->'filas') f
        where not exists(select 1 from public.grupo_participantes gp where gp.grupo_id=g.id and gp.jugador_id=(f->>'jugador_id')::bigint))
    ),'[]'::jsonb) clasificacion,
    coalesce((select jsonb_agg(jsonb_build_object('numero',p.id,'a',a.nombre_completo,'b',b.nombre_completo,
      'estado',case when r.resultado_id is not null then 'confirmado' else 'pendiente' end,
      'sets_a',r.sets_a,'sets_b',r.sets_b,'sets',r.sets,
      'ganador',case r.ganador_id when p.jugador_a_id then 'a' when p.jugador_b_id then 'b' end) order by p.id)
      from public.partidos p join public.lotes_partidos_grupos l on l.id=p.lote_id and l.estado='confirmado'
      join public.jugadores a on a.id=p.jugador_a_id join public.jugadores b on b.id=p.jugador_b_id
      left join oficiales r on r.partido_id=p.id where p.grupo_id=g.id),'[]'::jsonb) partidos
  from grupos g
), rondas_publicas as (
  select r.numero,r.nombre,
    coalesce((select jsonb_agg(jsonb_build_object('numero',e.numero,'a',a.nombre_completo,'b',b.nombre_completo,
      'origen_a',case when e.origen_a->>'tipo'='ganador' then e.origen_a->>'cruce' end,
      'origen_b',case when e.origen_b->>'tipo'='ganador' then e.origen_b->>'cruce' end,
      'estado',case when p.estado='confirmado' then 'confirmado' else 'pendiente' end,
      'ganador',case when p.estado='confirmado' then case p.ganador_id when p.jugador_a_id then 'a' when p.jugador_b_id then 'b' end end,
      'sets_a',acta.sets_a,'sets_b',acta.sets_b,'sets',acta.sets) order by e.numero)
      from public.eliminatorias_enfrentamientos e
      left join public.eliminatorias_partidos p on p.id=e.id
      left join public.jugadores a on a.id=coalesce(p.jugador_a_id,e.jugador_a_id)
      left join public.jugadores b on b.id=coalesce(p.jugador_b_id,e.jugador_b_id)
      left join public.eliminatorias_actas acta on acta.partido_id=p.id and acta.revision=p.revision and p.estado='confirmado'
      where e.ronda_id=r.id),'[]'::jsonb) partidos
  from public.eliminatorias_rondas r join public.eliminatorias_llaves k on k.id=r.llave_id and k.estado='confirmada'
  join competencias c on c.id=k.competencia_id where c.id=p_competencia_id
)
select jsonb_build_object(
  'temporadas',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'nombre',t.nombre,'anio',t.anio) order by t.anio desc),'[]'::jsonb)
    from public.temporadas t where exists(select 1 from jornadas f where f.temporada_id=t.id)),
  'jornadas',(select coalesce(jsonb_agg(to_jsonb(f) order by f.fecha,f.numero),'[]'::jsonb) from jornadas f),
  'competencias',(select coalesce(jsonb_agg(to_jsonb(c) order by c.inicio nulls last,c.nombre),'[]'::jsonb) from competencias c),
  'detalle',case when exists(select 1 from competencias where id=p_competencia_id) then jsonb_build_object(
    'grupos',(select coalesce(jsonb_agg(to_jsonb(g) order by g.numero),'[]'::jsonb) from grupos_publicos g),
    'rondas',(select coalesce(jsonb_agg(to_jsonb(r) order by r.numero),'[]'::jsonb) from rondas_publicas r)) end
);
$$;
revoke all on function public.consultar_torneos_publicos_025(bigint) from public,anon,authenticated,service_role;
grant execute on function public.consultar_torneos_publicos_025(bigint) to anon,authenticated;
comment on function public.consultar_torneos_publicos_025(bigint) is 'Proyección pública explícita; sin actas pendientes, cuentas, auditorías ni referencias privadas. Sin segunda publicación de resultados.';
commit;
