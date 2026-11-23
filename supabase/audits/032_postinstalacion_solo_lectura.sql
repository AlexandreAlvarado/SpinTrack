-- Ejecutar MANUALMENTE después de 032. No devuelve nombres ni resultados personales.
begin transaction read only;
select p.oid::regprocedure as funcion,p.prosecdef,p.proconfig,
       has_function_privilege('anon',p.oid,'execute') as anon_execute,
       has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
       has_function_privilege('service_role',p.oid,'execute') as service_execute
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('editar_mi_perfil_deportivo_029','nombre_publico_032',
  'consultar_torneos_publicos_025','consultar_ranking_publico_026',
  'consultar_torneos_publicos_032','consultar_ranking_publico_032') order by p.proname;
select c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'select') as anon_select
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
 ('jugadores','resultados_partidos','eliminatorias_actas','clasificaciones_grupos_aprobaciones',
  'ranking_fuentes_026','ranking_resoluciones_026');
-- Sesión realmente anónima en esta transacción. No se utiliza service_role.
set local role anon;
select set_config('request.jwt.claims','{}',true);
with data as (select public.consultar_torneos_publicos_032(null) payload)
select jsonb_typeof(payload) as tipo_torneos,
       jsonb_array_length(payload->'jornadas') as jornadas_publicadas,
       jsonb_array_length(payload->'competencias') as competencias_publicadas,
       payload=public.consultar_torneos_publicos_025(null) as igualdad_025_032
from data;
with competencias as (
 select (c->>'id')::bigint id
 from jsonb_array_elements(public.consultar_torneos_publicos_032(null)->'competencias') c
)
select count(*) as detalles_revisados,
       coalesce(bool_and(public.consultar_torneos_publicos_025(id)=public.consultar_torneos_publicos_032(id)),true) as igualdad_detalles_025_032
from competencias;
select jsonb_typeof(public.consultar_ranking_publico_032()) as tipo_ranking,
       jsonb_array_length(public.consultar_ranking_publico_032()) as alcances_ranking,
       public.consultar_ranking_publico_026()=public.consultar_ranking_publico_032() as igualdad_026_032;
commit;
