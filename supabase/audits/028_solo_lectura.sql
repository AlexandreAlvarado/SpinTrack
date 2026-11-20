-- Ejecutar MANUALMENTE en el SQL Editor para completar la inspección de 028.
-- Solo SELECT y catálogo. No crea revisiones, usuarios ni aceptaciones.
begin transaction read only;

select id, version, version = '2026-11-19.1' as version_esperada
from public.version_legal_028;

-- Referencia obtenida instalando la copia local 001–028 en PostgreSQL aislado.
-- Una diferencia de espacios/comentarios también cambia la huella: inspeccionar
-- la definición antes de concluir que una diferencia exige una corrección.
with esperadas(nombre, sha256) as (values
  ('estado_legal_028','e5a1e367c0869d4627056fb85ded5d343f0bbb933be5cb63cb2239ea2ef81d85'),
  ('aceptar_terminos_028','d57094db89d15f465631a7adc8dc96ea8b246ec6a61a9f1dd65911afc4d3017f'),
  ('validar_registro_legal_028','6a076efb320337f2678a480c776873ac093d6d0e1cf665b775009542d7c295b7'),
  ('registrar_aceptacion_028','18ce9b095b9bb31f845e7be9c7874b932e9a8a52a8afccf5e04ff74d52c17fb4'),
  ('snapshot_jornada_028','c9869c2df08d8f2cbe090d3164aaa87cb04129941c8d9749678b28c8bd46c690'),
  ('protegida_jornada_028','2e5cb91ffc31fe4d88952934a90bea7b46839afcd759ead39efcbf286960c352'),
  ('bloquear_jornada_028','85bb92f596560e361a53713e61f9fbaa91928c279e1c3a38ec3830b7e1bba52e'),
  ('validar_estado_jornada_028','fd71e6ec4bc9c1bec0780173ebc9f2fcb68f1dcbd3b607fcf6ff55f31db48c83'),
  ('revisar_jornada_028','93fb341a8e5e0ad1603a492bcda3c807f0cb6df114d70e156b6aefdb38210571'),
  ('gestionar_jornada_028','c5e092486f7165a9477d1a746c434d3234095c72b928ff78520af9e98251da7b')
)
select e.nombre, p.oid is not null as instalada,
  encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') = e.sha256 as coincide_cuerpo,
  p.prosecdef as security_definer, p.provolatile as volatilidad,
  p.proconfig as configuracion, pg_get_function_identity_arguments(p.oid) as argumentos
from esperadas e left join pg_proc p
  on p.proname = e.nombre and p.pronamespace = 'public'::regnamespace
order by e.nombre;

select n.nspname as esquema, c.relname as tabla, t.tgname,
  t.tgenabled, (t.tgtype::integer & 4) <> 0 as en_insert,
  (t.tgtype::integer & 16) <> 0 as en_update,
  pg_get_triggerdef(t.oid) as definicion
from pg_trigger t join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and ((n.nspname = 'auth' and c.relname = 'users')
  or (n.nspname = 'public' and c.relname in ('fechas','aceptaciones_legales_028')))
order by esquema, tabla, t.tgname;

select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as rls_forzada
from pg_class c where c.relnamespace = 'public'::regnamespace
  and c.relname in ('fechas','perfiles','jugadores','version_legal_028',
    'aceptaciones_legales_028','jornadas_operaciones_028','jornadas_revisiones_028')
order by c.relname;
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
  and tablename in ('fechas','perfiles','jugadores','version_legal_028',
    'aceptaciones_legales_028','jornadas_operaciones_028','jornadas_revisiones_028')
order by tablename, policyname;

select r.rolname, c.relname,
  has_table_privilege(r.oid,c.oid,'SELECT') as permite_select,
  has_table_privilege(r.oid,c.oid,'INSERT') as permite_insert,
  has_table_privilege(r.oid,c.oid,'UPDATE') as permite_update_tabla,
  has_table_privilege(r.oid,c.oid,'DELETE') as permite_delete
from pg_roles r cross join pg_class c
where r.rolname in ('anon','authenticated','service_role')
  and c.relnamespace = 'public'::regnamespace
  and c.relname in ('fechas','aceptaciones_legales_028','jornadas_operaciones_028','jornadas_revisiones_028')
order by r.rolname, c.relname;
select a.attname as columna,
  has_column_privilege('authenticated','public.fechas',a.attname,'UPDATE') as permite_update
from pg_attribute a where a.attrelid = 'public.fechas'::regclass
  and a.attnum > 0 and not a.attisdropped order by a.attnum;

select p.proname, pg_get_function_identity_arguments(p.oid) as argumentos,
  r.rolname, has_function_privilege(r.oid,p.oid,'EXECUTE') as permite_execute
from pg_proc p cross join pg_roles r
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('estado_legal_028','aceptar_terminos_028','validar_registro_legal_028',
    'registrar_aceptacion_028','revisar_jornada_028','gestionar_jornada_028',
    'bloquear_jornada_028','snapshot_jornada_028','validar_estado_jornada_028')
  and r.rolname in ('anon','authenticated','service_role')
order by p.proname,r.rolname;
select column_name, data_type, is_nullable, column_default
from information_schema.columns where table_schema = 'public'
  and table_name = 'aceptaciones_legales_028' order by ordinal_position;

-- Revisar definiciones si alguna huella difiere o falta un control.
select p.proname, pg_get_functiondef(p.oid) as definicion
from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('validar_registro_legal_028','registrar_aceptacion_028','aceptar_terminos_028',
    'gestionar_jornada_028','snapshot_jornada_028','protegida_jornada_028',
    'bloquear_jornada_028','validar_estado_jornada_028') order by p.proname;
commit;
