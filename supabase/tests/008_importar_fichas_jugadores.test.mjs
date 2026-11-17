// Exclusivamente PostgreSQL temporal propio. Nunca lee .env ni URLs de Supabase.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const bin='C:/Program Files/PostgreSQL/18/bin';
const scratchRoot=path.join(root,'test-results');fs.mkdirSync(scratchRoot,{recursive:true});
const scratch=fs.mkdtempSync(path.join(scratchRoot,'pg008-')),data=path.join(scratch,'data'),port='55408';
const env={...Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('PG'))),PGHOST:'127.0.0.1',PGPORT:port,PGUSER:'postgres',PGDATABASE:'liga_008_test',PGPASSWORD:'',PGCLIENTENCODING:'UTF8',PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'5'};
const file=n=>fs.readFileSync(path.join(root,n),'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
const args=()=>['-X','-h','127.0.0.1','-p',port,'-U','postgres','-d',env.PGDATABASE,'-v','ON_ERROR_STOP=1','-Atq'];
function run(p,a,input){return spawnSync(path.join(bin,p+'.exe'),a,{env,input,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:16*1024*1024});}
function sql(s,ok=true){const r=run('psql',args(),s);if(ok)assert.equal(r.status,0,r.stderr||r.error?.message);else assert.notEqual(r.status,0,'Se esperaba rechazo: '+s);return r;}
const value=s=>sql(s).stdout.trim();
const admin='e0040000-0000-0000-0000-000000000001';
const identity=(id=admin,role='authenticated')=>`set role ${role}; select set_config('request.jwt.claims','${JSON.stringify(id?{sub:id}:{})}',false);`;
const payload=(name,extra={})=>({nombre_completo:name,perfil_id:null,activo:true,fecha_nacimiento:null,club_id:null,localidad_procedencia_id:null,...extra});
const call=rows=>`select public.importar_fichas_jugadores($json$${JSON.stringify(rows)}$json$::jsonb);`;
const rpc=rows=>JSON.parse(value(identity()+call(rows)).split('\n').at(-1));
function asyncSql(s){const c=spawn(path.join(bin,'psql.exe'),args(),{env,windowsHide:true});let out='',err='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>err+=d);c.stdin.end(s);return new Promise(resolve=>c.on('close',status=>resolve({status,out,err})));}
let started=false;
try{
 assert.equal(run('initdb',['-D',data,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C']).status,0);
 const r=run('pg_ctl',['-D',data,'-l',path.join(scratch,'server.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);assert.equal(r.status,0,r.stderr);started=true;
 env.PGDATABASE='postgres';sql('create role anon;create role authenticated;create role service_role;create database liga_008_test;');env.PGDATABASE='liga_008_test';
 assert.equal(value("select current_setting('data_directory');").replaceAll('\\','/').toLowerCase(),data.replaceAll('\\','/').toLowerCase());
 sql(`create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;`);
 for(const n of ['001_base_segura.sql','002_identidad_deportiva.sql','003_categorias_competencias.sql'])sql(file('supabase/migrations/'+n));
 sql(file('supabase/tests/004_historica.fixture.sql'));sql(file('supabase/migrations/005_eliminar_cupo_maximo.sql'));
 const suite=file('supabase/tests/004_inscripciones.test.sql').replaceAll('55404',port).replaceAll('liga_004_test','liga_008_test');
 sql(suite.slice(0,suite.indexOf('\nbegin;\nset local role authenticated;')));
 const migration=file('supabase/migrations/008_importar_fichas_jugadores.sql');
 const objects=`select jsonb_build_object('tables',(select jsonb_agg(to_jsonb(t) order by oid) from (select oid,relacl,relrowsecurity,relforcerowsecurity from pg_class where relnamespace in ('public'::regnamespace,'auth'::regnamespace))t),'policies',(select jsonb_agg(to_jsonb(p) order by oid)from pg_policy p),'functions',(select jsonb_agg(to_jsonb(t)order by oid)from(select oid,proacl,proowner,prosecdef,proconfig,prosrc from pg_proc where pronamespace in ('public'::regnamespace,'auth'::regnamespace,'privado_inscripciones'::regnamespace) and proname<>'importar_fichas_jugadores')t),'constraints',(select jsonb_agg(to_jsonb(t)order by oid)from(select oid,pg_get_constraintdef(oid)def from pg_constraint where connamespace='public'::regnamespace)t),'triggers',(select jsonb_agg(to_jsonb(t)order by oid)from(select oid,tgenabled,pg_get_triggerdef(oid)def from pg_trigger where tgrelid in(select oid from pg_class where relnamespace in ('public'::regnamespace,'auth'::regnamespace)))t));`;
 const before=value(objects);sql(migration);assert.equal(value(objects),before);sql(migration,false);assert.equal(value(objects),before);
 console.log('008: aplica una vez sobre 001-005; reaplicación rechazada sin alterar objetos existentes.');
 sql(file('supabase/migrations/006_retirar_dependencia_tarifa.sql'));
 // Comprobar también orden 006 antes de 008 en otra BD con todas sus precondiciones.
 env.PGDATABASE='postgres';sql('create database liga_008_order;');env.PGDATABASE='liga_008_order';
 sql(`create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;`);
 for(const n of ['001_base_segura.sql','002_identidad_deportiva.sql','003_categorias_competencias.sql'])sql(file('supabase/migrations/'+n));
 sql(file('supabase/tests/004_historica.fixture.sql'));sql(file('supabase/migrations/005_eliminar_cupo_maximo.sql'));sql(file('supabase/migrations/006_retirar_dependencia_tarifa.sql'));const before6=value(objects);sql(migration);assert.equal(value(objects),before6);env.PGDATABASE='liga_008_test';
 console.log('008: compatible con 006 antes y después; 007 ausente y reservada.');
 for(const [id,role]of [[null,'anon'],[null,'authenticated'],['e0040000-0000-0000-0000-000000000002','authenticated'],['e0040000-0000-0000-0000-000000000003','authenticated'],['e0040000-0000-0000-0000-000000000005','authenticated'],['e0040000-0000-0000-0000-000000009999','authenticated']]){
   const fail=sql(identity(id,role)+call([payload('Prohibido')]),false);assert.match(fail.stderr,/permission denied|Solo Administrador/);
   const rls=sql(identity(id,role)+"insert into public.jugadores(nombre_completo) values('RLS prohibido');",false);assert.match(rls.stderr,/permission denied|row-level security/);
 }
 assert.equal(value("select count(*) from public.jugadores where nombre_completo like '%prohibido%' or nombre_completo='Prohibido';"),'0');
 assert.equal(value(`select not prosecdef and proconfig[1] in ('search_path=', 'search_path=""') from pg_proc where oid='public.importar_fichas_jugadores(jsonb)'::regprocedure;`),'t');
 console.log('008: anon, sesión ausente, perfil ausente, Juez, Árbitro y Jugador rechazados; RLS directa también.');
 const tables=value("select string_agg(quote_ident(n.nspname)||'.'||quote_ident(c.relname),',' order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('public','auth') and c.relname<>'jugadores';").split(',');
 const snapshot=()=>tables.map(t=>value(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from ${t} t;`));
 sql(identity()+"select public.solicitar_inscripcion(4006,4004,'Fixture aislado 008');");
 sql("insert into public.localidades(nombre)values('Localidad fixture 008'),('Localidad inactiva 008');update public.localidades set activo=false where id=2;insert into public.clubes(nombre,localidad_id)values('Club fixture 008',1),('Club inactivo 008',1);update public.clubes set activo=false where id=2;");
 const preserved=snapshot();const oldPlayers=value('select jsonb_agg(to_jsonb(j)order by id)from public.jugadores j;');
 const hundreds=Array.from({length:500},(_,i)=>payload('Participante SQL '+i));assert.equal(rpc(hundreds).filter(r=>r.estado==='creado').length,500);assert.equal(rpc(hundreds).filter(r=>r.estado==='duplicado').length,500);
 assert.equal(value('select jsonb_agg(to_jsonb(j)order by id)from public.jugadores j where id>=4004;'),oldPlayers);
 assert.deepEqual(snapshot(),preserved);
 console.log('008: 500 creados, 500 duplicados al reintentar; fichas previas y todas las otras tablas intactas.');
 const linked=rpc([payload('Con relaciones SQL',{club_id:1,localidad_procedencia_id:1,fecha_nacimiento:'2000-01-01'}),payload('Club inactivo SQL',{club_id:2}),payload('Localidad inactiva SQL',{localidad_procedencia_id:2})]);
 assert.deepEqual(linked.map(r=>r.estado),['creado','error','error']);
 assert.equal(value(`select club_id=1 and localidad_procedencia_id=1 and fecha_nacimiento='2000-01-01'::date and perfil_id is null from public.jugadores where id=${linked[0].id};`),'t');
 const mixed=[payload('Ana Pérez'),payload(' ANA PEREZ '),payload('Falta fecha',{fecha_nacimiento:'2026-02-30'}),payload('Futuro',{fecha_nacimiento:'2999-01-01'}),payload('Sin club',{club_id:999999}),payload(''),payload('Otra ficha')];
 assert.deepEqual(rpc(mixed).map(r=>r.estado),['creado','duplicado','error','error','error','error','creado']);assert.deepEqual(rpc(mixed).map(r=>r.estado),['duplicado','duplicado','error','error','error','error','duplicado']);
 sql("insert into public.jugadores(nombre_completo)values('Homonimo SQL'),('Homonimo SQL');");const homonyms=value("select jsonb_agg(to_jsonb(j)order by id)from public.jugadores j where nombre_completo='Homonimo SQL';");assert.equal(rpc([payload('Homonimo SQL')])[0].estado,'duplicado');assert.equal(value("select jsonb_agg(to_jsonb(j)order by id)from public.jugadores j where nombre_completo='Homonimo SQL';"),homonyms);
 console.log('008: errores parciales, reintento y homónimos conservados sin fusión.');
 assert.deepEqual(rpc([payload('ÁLVARO GÜEMES'),payload('Alvaro Guemes'),payload('Alvaro Gue\u0308mes')]).map(r=>r.estado),['creado','duplicado','duplicado']);
 const a=asyncSql(`begin;${identity()}${call([payload('Concurrente SQL')])}select pg_sleep(1);commit;`);
 // Espera hasta que la primera transacción esté realmente durmiendo con el bloqueo.
 for(let i=0;i<100;i++){if(value("select count(*) from pg_stat_activity where datname=current_database() and wait_event='PgSleep';")==='1')break;await new Promise(r=>setTimeout(r,20));if(i===99)throw Error('No comenzó la primera conexión');}
 const b=asyncSql(identity()+call([payload('Concurrente SQL')]));const [ra,rb]=await Promise.all([a,b]);assert.equal(ra.status,0,ra.err);assert.equal(rb.status,0,rb.err);assert.match(ra.out,/creado/);assert.match(rb.out,/duplicado/);assert.equal(value("select count(*)from public.jugadores where nombre_completo='Concurrente SQL';"),'1');
 console.log('008: dos conexiones concurrentes: una creación y una omisión.');
 // Límite demostrado: el formulario manual no participa en el advisory lock.
 const manualA=asyncSql(`begin;${identity()}${call([payload('Carrera manual SQL')])}select pg_sleep(1);commit;`);
 for(let i=0;i<100;i++){if(value("select count(*) from pg_stat_activity where datname=current_database() and wait_event='PgSleep';")==='1')break;await new Promise(r=>setTimeout(r,20));if(i===99)throw Error('No comenzó la carrera manual');}
 const manualB=await asyncSql(identity()+"insert into public.jugadores(nombre_completo)values('Carrera manual SQL');");
 assert.equal((await manualA).status,0);assert.equal(manualB.status,0,manualB.err);
 assert.equal(value("select count(*)from public.jugadores where nombre_completo='Carrera manual SQL';"),'2');
 assert.deepEqual(rpc([payload('Martin Mansilla'),payload('Martin Mancilla')]).map(r=>r.estado),['creado','creado']);
 assert.equal(rpc([payload('Nombre anterior SQL')])[0].estado,'creado');
 sql(identity()+"update public.jugadores set nombre_completo='Nombre corregido SQL' where nombre_completo='Nombre anterior SQL';");
 assert.equal(rpc([payload('Nombre anterior SQL')])[0].estado,'creado');
 console.log('008: límites demostrados: carrera manual, variantes no exactas y nombre cambiado no tienen idempotencia persistente.');
 // Casos duros: errores de tipo por fila no deben abortar los vecinos válidos.
 assert.deepEqual(rpc([payload('Antes overflow'),payload('Overflow',{club_id:'999999999999999999999999999'}),payload('Después overflow')]).map(r=>r.estado),['creado','error','creado']);
 for(const invalid of ['null',"'null'::jsonb","'{}'::jsonb"]){sql(identity()+`select public.importar_fichas_jugadores(${invalid});`,false);}
 assert.deepEqual(rpc([1,payload('Vecino valido')]).map(r=>r.estado),['error','creado']);
 assert.deepEqual(rpc([payload('Booleano texto',{activo:'true'}),payload('Cuenta prohibida',{perfil_id:admin}),payload('ID prohibido',{id:4004}),payload('Fecha ambigua',{fecha_nacimiento:'02/03/2010'})]).map(r=>r.estado),['error','error','error','error']);
 sql(identity()+call(Array.from({length:2001},()=>payload('Exceso'))),false);
 sql(identity()+call([payload('Tamaño excesivo',{nombre_completo:'x'.repeat(2100000)})]),false);
 sql('begin isolation level repeatable read;'+identity()+call([payload('Snapshot viejo')])+'commit;',false);
 sql('begin isolation level serializable;'+identity()+call([payload('Serializable')])+'commit;',false);
 assert.equal(value("select has_function_privilege('anon','public.importar_fichas_jugadores(jsonb)','execute') or has_function_privilege('service_role','public.importar_fichas_jugadores(jsonb)','execute');"),'f');
 assert.deepEqual(snapshot(),preserved);
 console.log('008: VALIDACIÓN COMPLETA APROBADA.');
}finally{
 if(started)assert.equal(run('pg_ctl',['-D',data,'-m','fast','-w','stop']).status,0);
 const resolved=fs.realpathSync(scratch);assert.equal(path.dirname(resolved).toLowerCase(),fs.realpathSync(scratchRoot).toLowerCase());assert.ok(path.basename(resolved).startsWith('pg008-'));fs.rmSync(resolved,{recursive:true,force:true});
}
