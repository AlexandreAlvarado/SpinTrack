-- Preparada para revisión y aplicación MANUAL. No inserta configuración ni datos reales.
-- Requiere 001–025; no cambia las eliminatorias ni las migraciones aplicadas.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create table public.ranking_configuraciones_026 (
 id bigint generated always as identity primary key,
 categoria_temporada_id bigint not null unique references public.categorias_temporada(id),
 reglamento_id bigint not null references public.reglamentos_temporada(id),
 fecha_ids bigint[] not null check(cardinality(fecha_ids)=7 and array_ndims(fecha_ids)=1),
 referencia text not null check(length(btrim(referencia)) between 10 and 2000),
 registrado_por uuid not null references public.perfiles(id),
 registrado_en timestamptz not null default clock_timestamp()
);
create table public.ranking_resoluciones_026 (
 id bigint generated always as identity primary key,
 competencia_id bigint not null references public.competencias(id),
 jugador_id bigint not null references public.jugadores(id),
 puesto integer check(puesto between 3 and 8), -- NULL revoca; jamás edita totales.
 autoridad text not null check(length(btrim(autoridad)) between 3 and 200),
 referencia text not null check(length(btrim(referencia)) between 10 and 2000),
 motivo text not null check(length(btrim(motivo)) between 10 and 2000),
 registrado_por uuid not null references public.perfiles(id),
 registrado_en timestamptz not null default clock_timestamp()
);
create index ranking_resoluciones_actual_026 on public.ranking_resoluciones_026(competencia_id,jugador_id,id desc);
create function public.ranking_inmutable_026() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Registro de ranking inmutable; conservar trazabilidad' using errcode='55000'; end $$;
create trigger ranking_config_inmutable before update or delete or truncate on public.ranking_configuraciones_026 for each statement execute function public.ranking_inmutable_026();
create trigger ranking_resolucion_inmutable before update or delete or truncate on public.ranking_resoluciones_026 for each statement execute function public.ranking_inmutable_026();

-- No permitir que una edición administrativa remapee una autorización ya registrada.
create function public.proteger_alcance_ranking_026() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='fechas' then
   if (new.temporada_id,new.numero) is distinct from (old.temporada_id,old.numero)
   and exists(select 1 from public.ranking_configuraciones_026 where old.id=any(fecha_ids))
   then raise exception 'Fecha incluida en padrón oficial: revisar autorización antes de renumerar' using errcode='23514'; end if;
 elsif (new.temporada_id,new.categoria_id,new.nivel_id,new.rama,new.reglamento_id) is distinct from (old.temporada_id,old.categoria_id,old.nivel_id,old.rama,old.reglamento_id)
 and exists(select 1 from public.ranking_configuraciones_026 where categoria_temporada_id=old.id)
 then raise exception 'Alcance de ranking autorizado inmutable; requiere revisión documental' using errcode='23514'; end if;
 return new;
end $$;
create trigger proteger_fecha_ranking_026 before update on public.fechas for each row execute function public.proteger_alcance_ranking_026();
create trigger proteger_categoria_ranking_026 before update on public.categorias_temporada for each row execute function public.proteger_alcance_ranking_026();

create function public.configurar_ranking_026(p_categoria_id bigint,p_reglamento_id bigint,p_fecha_ids bigint[],p_referencia text)
returns bigint language plpgsql security definer set search_path='' as $$
declare ct public.categorias_temporada; result bigint; fechas bigint[];
begin
 if auth.uid() is null or public.es_administrador() is distinct from true then raise exception 'Solo Administrador' using errcode='42501'; end if;
 select * into strict ct from public.categorias_temporada where id=p_categoria_id for share;
 if not ct.activo or not exists(select 1 from public.temporadas where id=ct.temporada_id and anio=2026)
 or not exists(select 1 from public.reglamentos_temporada where id=p_reglamento_id and temporada_id=ct.temporada_id and estado_revision='validado' and nullif(btrim(referencia_aprobacion),'') is not null)
 then raise exception 'Requiere categoría individual 2026 y reglamento validado de la misma temporada' using errcode='23514'; end if;
 perform 1 from public.reglamentos_temporada where id=p_reglamento_id for share;
 perform 1 from public.fechas where id=any(p_fecha_ids) order by id for share;
 if cardinality(p_fecha_ids) is distinct from 7 or array_ndims(p_fecha_ids) is distinct from 1
 or (select count(distinct x) from unnest(p_fecha_ids) x)<>7
 or (select count(*) from public.fechas where id=any(p_fecha_ids) and temporada_id=ct.temporada_id and numero between 1 and 7)<>7
 then raise exception 'Selecciona exactamente las siete fechas oficiales 1–7; jornada 8 excluida' using errcode='23514'; end if;
 select array_agg(id order by numero) into fechas from public.fechas where id=any(p_fecha_ids);
 insert into public.ranking_configuraciones_026(categoria_temporada_id,reglamento_id,fecha_ids,referencia,registrado_por)
 values(p_categoria_id,p_reglamento_id,fechas,p_referencia,auth.uid()) returning id into result;
 return result;
end $$;

-- Fuente única interna. Los candidatos son participantes reales; no se asignan puestos
-- a partir de orden de filas, nombres, sets, medallas ni clasificaciones de grupos.
create view public.ranking_fuentes_026 as
with resoluciones as (
 select distinct on (competencia_id,jugador_id) competencia_id,jugador_id,puesto
 from public.ranking_resoluciones_026 order by competencia_id,jugador_id,id desc
), fuentes as (
 select cfg.id configuracion_id,c.id competencia_id,f.numero fecha_numero,pc.jugador_id,j.nombre_completo,
 q.estado='finalizado' and k.estado='confirmada'
 and fin.estado='confirmado' and fin.ganador_id=q.campeon_id and fin.perdedor_id=q.finalista_id terminado,
 q.campeon_id,q.finalista_id,r.posiciones ronda_perdida,res.puesto resuelto,
 -- Solo cuadros completos sin pases: no inferir bandas de cuadros incompletos.
 (select count(*) from public.eliminatorias_partidos z where z.llave_id=k.id and z.ronda_numero=1 and z.estado='confirmado')
   =(select max(z.posiciones)/2 from public.eliminatorias_rondas z where z.llave_id=k.id) cuadro_completo
 from public.ranking_configuraciones_026 cfg
 join public.categorias_temporada ct on ct.id=cfg.categoria_temporada_id and ct.activo
 join public.reglamentos_temporada reg on reg.id=cfg.reglamento_id and reg.estado_revision='validado'
 join public.fechas f on f.id=any(cfg.fecha_ids) and f.temporada_id=ct.temporada_id and f.numero between 1 and 7 and f.estado in ('publicada','finalizada')
 join public.competencias c on c.fecha_id=f.id and c.categoria_temporada_id=ct.id and c.activo and c.publicada
 join public.competencia_control_deportivo ctl on ctl.competencia_id=c.id and ctl.configuracion_aprobada
 join public.participantes_competencia pc on pc.competencia_id=c.id
 join public.jugadores j on j.id=pc.jugador_id
 left join public.eliminatorias_llaves k on k.competencia_id=c.id and k.estado='confirmada'
 left join public.eliminatorias_cuadros q on q.llave_id=k.id
 left join public.eliminatorias_rondas rf on rf.llave_id=k.id and rf.posiciones=2
 left join public.eliminatorias_partidos fin on fin.ronda_id=rf.id and fin.llave_id=k.id
 left join public.eliminatorias_partidos derrota on derrota.llave_id=k.id and derrota.perdedor_id=pc.jugador_id and derrota.estado='confirmado'
 left join public.eliminatorias_rondas r on r.id=derrota.ronda_id
 left join resoluciones res on res.competencia_id=c.id and res.jugador_id=pc.jugador_id
), posiciones as (
 select *,case when terminado then case
 when jugador_id=campeon_id then 1 when jugador_id=finalista_id then 2
 when ronda_perdida=4 and resuelto between 3 and 4 then resuelto
 when ronda_perdida=8 and resuelto between 5 and 8 then resuelto end end puesto,
 case when terminado and cuadro_completo and ronda_perdida=16 then 81
 when terminado and cuadro_completo and ronda_perdida=32 then 78 end banda_puntos
 from fuentes
)
select configuracion_id,competencia_id,fecha_numero,jugador_id,nombre_completo,coalesce(terminado,false) terminado,
 ronda_perdida,puesto,
 coalesce((array[100,97,95,93,90,88,86,84])[puesto],banda_puntos) puntos,
 case when not coalesce(terminado,false) then 'resultado_pendiente'
 when puesto is not null or banda_puntos is not null then 'confirmado'
 when ronda_perdida>32 then 'sin_escala'
 else 'resolucion_pendiente' end estado
from posiciones;
revoke all on public.ranking_fuentes_026 from public,anon,authenticated,service_role;

create function public.resolver_puesto_ranking_026(p_competencia_id bigint,p_jugador_id bigint,p_puesto integer,p_autoridad text,p_referencia text,p_motivo text)
returns bigint language plpgsql security definer set search_path='' as $$
declare f record; result bigint;
begin
 if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
 -- Serializa decisiones de todos los jugadores de la competencia (incluido puesto ocupado).
 perform 1 from public.competencias where id=p_competencia_id for update;
 select * into f from public.ranking_fuentes_026 where competencia_id=p_competencia_id and jugador_id=p_jugador_id;
 if not found or not f.terminado or f.ronda_perdida not in (4,8) or f.ronda_perdida is null
 or (p_puesto is not null and not ((f.ronda_perdida=4 and p_puesto between 3 and 4) or (f.ronda_perdida=8 and p_puesto between 5 and 8)))
 then raise exception 'Puesto no demostrable con resultados confirmados; requiere resolución de Liga fuera de este procedimiento' using errcode='23514'; end if;
 if p_puesto is not null and exists(select 1 from public.ranking_fuentes_026 where competencia_id=p_competencia_id and jugador_id<>p_jugador_id and puesto=p_puesto)
 then raise exception 'Puesto ya adjudicado; revocar antes de corregir' using errcode='23505'; end if;
 insert into public.ranking_resoluciones_026(competencia_id,jugador_id,puesto,autoridad,referencia,motivo,registrado_por)
 values(p_competencia_id,p_jugador_id,p_puesto,p_autoridad,p_referencia,p_motivo,auth.uid()) returning id into result;
 return result;
end $$;

create function public.consultar_ranking_publico_026() returns jsonb language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object('id',cfg.id,'seasonId',t.id,'seasonLabel',t.nombre,'label',concat_ws(' · ',cat.nombre,n.nombre,ct.rama),
 'dates',(select jsonb_agg(jsonb_build_object('id',f.id,'number',f.numero,'label',concat('Fecha ',f.numero),'complete',
 exists(select 1 from public.ranking_fuentes_026 src where src.configuracion_id=cfg.id and src.fecha_numero=f.numero and src.terminado)) order by f.numero)
 from public.fechas f where f.id=any(cfg.fecha_ids)),
 'results',(select coalesce(jsonb_agg(jsonb_build_object('playerId',src.jugador_id,'name',src.nombre_completo,'date',src.fecha_numero,
 'points',src.puntos,'place',src.puesto,'state',src.estado) order by src.jugador_id,src.fecha_numero),'[]'::jsonb) from public.ranking_fuentes_026 src where src.configuracion_id=cfg.id)
 ) order by t.anio desc,ct.codigo),'[]'::jsonb)
from public.ranking_configuraciones_026 cfg
join public.categorias_temporada ct on ct.id=cfg.categoria_temporada_id and ct.activo
join public.temporadas t on t.id=ct.temporada_id and t.anio=2026
join public.categorias cat on cat.id=ct.categoria_id join public.niveles n on n.id=ct.nivel_id
join public.reglamentos_temporada reg on reg.id=cfg.reglamento_id and reg.estado_revision='validado'
-- Un cambio posterior de numeración o temporada invalida el padrón, no lo remapea.
where (select count(*) from public.fechas f where f.id=any(cfg.fecha_ids) and f.temporada_id=ct.temporada_id and f.numero between 1 and 7)=7;
$$;

-- Consulta privada de pendientes e historial sin abrir tablas deportivas al público.
create function public.consultar_gestion_ranking_026() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or (public.es_administrador() is distinct from true and public.es_juez_general() is distinct from true) then raise exception 'Solo operadores' using errcode='42501'; end if;
 return jsonb_build_object('configuraciones',(select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]'::jsonb) from public.ranking_configuraciones_026 c),
 'fuentes',(select coalesce(jsonb_agg(to_jsonb(s) order by competencia_id,jugador_id),'[]'::jsonb) from public.ranking_fuentes_026 s),
 'historial',(select coalesce(jsonb_agg(to_jsonb(h) order by id desc),'[]'::jsonb) from public.ranking_resoluciones_026 h));
end $$;

alter table public.ranking_configuraciones_026 enable row level security;
alter table public.ranking_resoluciones_026 enable row level security;
revoke all on public.ranking_configuraciones_026,public.ranking_resoluciones_026 from public,anon,authenticated,service_role;
revoke all on sequence public.ranking_configuraciones_026_id_seq,public.ranking_resoluciones_026_id_seq from public,anon,authenticated,service_role;
revoke all on function public.ranking_inmutable_026(),public.proteger_alcance_ranking_026(),public.configurar_ranking_026(bigint,bigint,bigint[],text),public.resolver_puesto_ranking_026(bigint,bigint,integer,text,text,text),public.consultar_ranking_publico_026(),public.consultar_gestion_ranking_026() from public,anon,authenticated,service_role;
grant execute on function public.configurar_ranking_026(bigint,bigint,bigint[],text),public.resolver_puesto_ranking_026(bigint,bigint,integer,text,text,text),public.consultar_gestion_ranking_026() to authenticated;
grant execute on function public.consultar_ranking_publico_026() to anon,authenticated;
commit;
