-- Ejecutar MANUALMENTE antes de 029/032. Solo catálogo y versión legal.
begin transaction read only;
select version from public.version_legal_028 where id;
select to_regprocedure('public.editar_mi_perfil_deportivo_029(bigint,date,bigint,bigint,jsonb)') as perfil_029,
       to_regprocedure('public.consultar_torneos_publicos_025(bigint)') as torneos_025,
       to_regprocedure('public.consultar_ranking_publico_026()') as ranking_026,
       to_regprocedure('public.consultar_torneos_publicos_032(bigint)') as torneos_032,
       to_regprocedure('public.consultar_ranking_publico_032()') as ranking_032,
       to_regprocedure('public.nombre_publico_032(bigint)') as nombre_032;
select tgname from pg_catalog.pg_trigger where not tgisinternal
  and tgname in ('resguardo_alta_revision_030','resguardo_aceptacion_revision_030');
select p.oid::regprocedure as funcion,pg_get_functiondef(p.oid) as definicion,
       p.prosecdef,p.proconfig,p.proacl
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('consultar_torneos_publicos_025','consultar_ranking_publico_026',
  'torneos_internos_revision_030','ranking_interno_revision_030');
commit;
