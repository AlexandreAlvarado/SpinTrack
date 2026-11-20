-- Solo catálogos. No invoca las RPC ni devuelve registros deportivos/personales.
begin transaction read only;
select p.oid::regprocedure as funcion, p.prosecdef as security_definer,
       p.provolatile, p.proconfig,
       has_function_privilege('anon',p.oid,'execute') as anon_execute,
       has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
       pg_get_functiondef(p.oid) as definicion
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('consultar_torneos_publicos_025','consultar_ranking_publico_026');
select pg_get_viewdef('public.ranking_fuentes_026'::regclass,true) as fuente_ranking;
select c.relname,c.relrowsecurity,c.relforcerowsecurity,c.reloptions,
       has_table_privilege('anon',c.oid,'select') as anon_select,
       has_table_privilege('authenticated',c.oid,'select') as authenticated_select
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
 ('jugadores','perfiles','ranking_fuentes_026','ranking_configuraciones_026','ranking_resoluciones_026');
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in
 ('jugadores','perfiles','ranking_configuraciones_026','ranking_resoluciones_026')
order by tablename,policyname;
commit;
