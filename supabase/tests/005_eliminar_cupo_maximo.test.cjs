// SOLO PostgreSQL temporal local. Requiere cluster limpio, puerto 55404.
// Ejecutar desde la raiz: node supabase/tests/005_eliminar_cupo_maximo.test.cjs
const fs=require('node:fs');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const psql='C:/Program Files/PostgreSQL/18/bin/psql.exe';
const env={...process.env,PGHOST:'127.0.0.1',PGPORT:'55404',PGUSER:'postgres',PGPASSWORD:'',PGDATABASE:'liga_004_test'};
const sql=(input,ok=true)=>{
 const result=cp.spawnSync(psql,['-X','-v','ON_ERROR_STOP=1','-At'],{env,input,encoding:'utf8'});
 if(ok && result.status!==0) throw Error(result.stderr);
 if(!ok) assert.notEqual(result.status,0,'Debe abortar ante deriva');
 return result;
};
const file=p=>fs.readFileSync(p,'utf8');
env.PGDATABASE='postgres';
sql('create database liga_004_test;');
env.PGDATABASE='liga_004_test';
sql(`do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; create role authenticated; create role service_role; end if; end $$;
create schema auth;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$
select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid $$;
grant usage on schema auth to anon,authenticated,service_role;`);
const paths=['001_base_segura.sql','002_identidad_deportiva.sql','003_categorias_competencias.sql'];
sql(paths.map(p=>file('supabase/migrations/'+p)).join('\n'));
const snapshot=`select 'tabla'::text tipo,oid,relacl::text acl from pg_class where relnamespace in ('public'::regnamespace,'auth'::regnamespace)
union all select 'funcion',oid,proacl::text from pg_proc where pronamespace in ('public'::regnamespace,'auth'::regnamespace,'privado_inscripciones'::regnamespace)
union all select 'esquema',oid,nspacl::text from pg_namespace where nspname in ('public','auth','privado_inscripciones')
union all select 'columna',attrelid::bigint*1000+attnum,attacl::text from pg_attribute where attrelid in (select oid from pg_class where relnamespace='public'::regnamespace) and attnum>0;`;
const before004=`create temp table permisos_previos004 as
select 'tabla'::text tipo,oid,relacl::text acl from pg_class where relnamespace in ('public'::regnamespace,'auth'::regnamespace)
union all select 'funcion',oid,proacl::text from pg_proc where pronamespace in ('public'::regnamespace,'auth'::regnamespace)
union all select 'esquema',oid,nspacl::text from pg_namespace where nspname in ('public','auth');`;
const historical=file('supabase/tests/004_historica.fixture.sql');
sql(historical);
// Reproduce el rechazo antiguo con minimo=4 y cupo=2; todo se revierte.
const suite=file('supabase/tests/004_inscripciones.test.sql');
const setup=suite.slice(0,suite.indexOf('\nbegin;\nset local role authenticated;'));
assert.match(sql('begin;\n'+setup,false).stderr,/inferior al/);
const migration=file('supabase/migrations/005_eliminar_cupo_maximo.sql');
// Una diferencia de cuerpo, seguridad o trigger aborta toda la transaccion.
const original=sql("select pg_get_functiondef('privado_inscripciones.validar_inscripcion_004()'::regprocedure);").stdout;
sql(original.replace('clock_timestamp()', 'statement_timestamp()'));
assert.match(sql(migration,false).stderr,/seguridad inesperada/);
assert.equal(sql("select count(*) from pg_trigger where tgname='c_proteger_cupo';").stdout.trim(),'1');
sql(original);
sql('alter function privado_inscripciones.validar_inscripcion_004() security invoker;');
sql(migration,false);
sql(original);
sql('alter table public.competencias disable trigger c_proteger_cupo;');
sql(migration,false);
sql('alter table public.competencias enable trigger c_proteger_cupo;');
// Compara ACL/propietarios/OID y reglas antes/despues en la misma sesion.
const check=`do $$ begin
if exists(select 1 from permisos005 a left join (${snapshot.slice(0,-1)}) b using(tipo,oid)
where b.oid is null or a.acl is distinct from b.acl) then raise exception 'ACL alteradas'; end if;
if exists(select 1 from funciones005 a join pg_proc p using(oid)
where (a.proowner,a.proacl,a.proconfig) is distinct from (p.proowner,p.proacl,p.proconfig)) then raise exception 'Seguridad alterada'; end if;
if exists(select 1 from reglas005 a left join pg_constraint b using(oid)
where b.oid is null or a.def is distinct from pg_get_constraintdef(b.oid)) then raise exception 'Reglas alteradas'; end if;
if to_regprocedure('privado_inscripciones.proteger_cupo_004()') is not null then raise exception 'Protector persiste'; end if;
end $$;`;
sql(`create temp table permisos005 as ${snapshot}
delete from permisos005 where tipo='funcion' and oid='privado_inscripciones.proteger_cupo_004()'::regprocedure;
create temp table funciones005 as select oid,proowner,proacl,proconfig from pg_proc where oid in ('public.validar_competencia_003()'::regprocedure,'privado_inscripciones.validar_inscripcion_004()'::regprocedure);
create temp table reglas005 as select oid,pg_get_constraintdef(oid) def from pg_constraint where conrelid='public.competencia_control_deportivo'::regclass;
${migration}\n${check}`);
sql(migration,false); // Reaplicacion rechazada.
// Suite integral sobre datos sinteticos despues de 004 historica + 005.
// La captura completa anterior ya comprobo las ACL; esta sirve a la suite heredada.
const capture=before004.replace("where pronamespace in ('public'::regnamespace,'auth'::regnamespace)","where pronamespace in ('public'::regnamespace,'auth'::regnamespace) and proname not in ('solicitar_inscripcion','resolver_inscripcion')");
sql(capture+'\n'+file('supabase/tests/004_inscripciones.test.sql'));
console.log('005: deriva de cuerpo/seguridad/trigger y reaplicacion rechazadas; ACL, propietarios, OID, constraints y suite integral 004 aprobados.');
