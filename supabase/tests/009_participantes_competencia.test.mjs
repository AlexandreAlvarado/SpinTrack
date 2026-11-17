// PostgreSQL temporal loopback. No Supabase ni datos reales.
import fs from "node:fs"; import path from "node:path"; import { spawn, spawnSync } from "node:child_process"; import assert from "node:assert/strict"; import { fileURLToPath } from "node:url";
const root=fileURLToPath(new URL("../../",import.meta.url)), bin="C:/Program Files/PostgreSQL/18/bin", scratch=fs.mkdtempSync(path.join(root,"test-results","pg009p-")), data=path.join(scratch,"data"), port="55410"; fs.mkdirSync(path.dirname(scratch),{recursive:true}); const env={...process.env,PGHOST:"127.0.0.1",PGPORT:port,PGUSER:"postgres",PGPASSWORD:"",PGDATABASE:"liga_009p_test",PGSSLMODE:"disable",PGOPTIONS:"-c statement_timeout=10000 -c lock_timeout=5000"}; const file=n=>fs.readFileSync(path.join(root,n),"utf8"); const run=(p,a,i="")=>spawnSync(path.join(bin,p+".exe"),a,{env,input:i,encoding:"utf8",timeout:30000,windowsHide:true,maxBuffer:12*1024*1024}); const sql=i=>{const r=run("psql",["-X","-h","127.0.0.1","-p",port,"-U","postgres","-d",env.PGDATABASE,"-v","ON_ERROR_STOP=1","-Atq"],i);assert.equal(r.status,0,r.stderr+r.stdout);return r.stdout.trim();}; const active=new Set(); const psqlAsync=i=>new Promise((resolve,reject)=>{const child=spawn(path.join(bin,"psql.exe"),["-X","-h","127.0.0.1","-p",port,"-U","postgres","-d",env.PGDATABASE,"-v","ON_ERROR_STOP=1","-Atq"],{env,windowsHide:true}); active.add(child); let out="",err=""; const timer=setTimeout(()=>{child.kill(); reject(new Error("psql concurrente excedió 8 s"));},8000); child.stdout.on("data",d=>out+=d); child.stderr.on("data",d=>err+=d); child.on("error",reject); child.on("close",(code,signal)=>{clearTimeout(timer);active.delete(child); code===0?resolve(out.trim()):reject(new Error("psql concurrente exit="+code+" signal="+signal+": "+err+out));}); child.stdin.end(i);}); let started=false;
try { assert.equal(run("initdb",["-D",data,"-U","postgres","-A","trust","--encoding=UTF8","--locale=C"]).status,0); assert.equal(run("pg_ctl",["-D",data,"-l",path.join(scratch,"server.log"),"-o",`-h 127.0.0.1 -p ${port}`,"-w","start"]).status,0); started=true; env.PGDATABASE="postgres"; sql("create role anon;create role authenticated;create role service_role;create database liga_009p_test;"); env.PGDATABASE="liga_009p_test";
 const bootstrap=`create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;`;
 const source=file("supabase/tests/004_inscripciones.test.sql"), start=source.indexOf("\\set ON_ERROR_STOP on"), setup=source.slice(source.indexOf("\n",start)+1,source.indexOf("\nbegin;\nset local role authenticated;")).replaceAll("55404",port).replaceAll("liga_004_test","liga_009p_test"), historical=file("supabase/tests/004_historica.fixture.sql").replaceAll("55404",port).replaceAll("liga_004_test","liga_009p_test");
 sql(bootstrap+file("supabase/migrations/001_base_segura.sql")+file("supabase/migrations/002_identidad_deportiva.sql")+file("supabase/migrations/003_categorias_competencias.sql")+historical+file("supabase/migrations/005_eliminar_cupo_maximo.sql")+file("supabase/migrations/006_retirar_dependencia_tarifa.sql")+setup+file("supabase/migrations/009_participantes_competencia.sql")+file("supabase/migrations/010_organizacion_grupos.sql"));
 console.log(sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',false);
select public.check004((select public.confirmar_participantes_competencia(4004,array[4004],'manual','Prueba nómina')=1),'Juez confirma nómina');
select public.check004((select count(*)=1 from public.participantes_competencia where competencia_id=4004),'Fila confirmada');
create temp table confirmado009 as select confirmado_en from public.participantes_competencia where jugador_id=4004 and competencia_id=4004;
select public.confirmar_participantes_competencia(4004,array[4004,4005],'manual','Corrección inicial',null);
select public.check004((select confirmado_en=(select confirmado_en from confirmado009) from public.participantes_competencia where jugador_id=4004 and competencia_id=4004),'Permanencia conserva confirmación original');
select public.check004((select count(*)=2 from public.participantes_competencia_historial where competencia_id=4004 and evento='confirmado'),'Altas auditadas');
select public.confirmar_participantes_competencia(4004,array[4004],'manual','Corrección con retiro','Jugador retirado por revisión del Juez');
select public.check004((select count(*)=1 from public.participantes_competencia where competencia_id=4004),'Retiro aplica corrección');
select public.check004((select count(*)=1 from public.participantes_competencia_historial where competencia_id=4004 and jugador_id=4005 and evento='retirado' and motivo='Jugador retirado por revisión del Juez'),'Retiro auditado con motivo');
select public.check004((select count(*)=1 from public.participantes_competencia where competencia_id=4004),'Competencia nueva sin tablas de programación permite nómina');
select public.reject004('select public.confirmar_participantes_competencia(4004,array[4004,4004],''manual'',''Duplicado'')','22023');
select public.reject004('select public.confirmar_participantes_competencia(4004,array[4005],''manual'',''Retiro sin motivo'')','22023');
select public.confirmar_participantes_competencia(4004,array[]::bigint[],'manual','Retiro total de nómina','Retiro total autorizado por el Juez');
select public.check004((select count(*)=0 from public.participantes_competencia where competencia_id=4004),'Retiro total permitido con motivo');
select public.check004((select count(*)=1 from public.participantes_competencia_historial where competencia_id=4004 and jugador_id=4004 and evento='retirado' and motivo='Retiro total autorizado por el Juez'),'Retiro total auditado');
select public.reject004('select public.confirmar_participantes_competencia(4004,array[999999],''manual'',''Jugador inválido'')','23514');
select public.check004((select count(*)=0 from public.participantes_competencia where jugador_id=999999),'Jugador inválido no se guarda');
reset role;
alter table public.habilitaciones_jugador_categoria alter column tipo_resolucion drop not null;
update public.habilitaciones_jugador_categoria set tipo_resolucion=null where jugador_id=4004 and categoria_temporada_id=4004;
update public.jugadores set fecha_nacimiento='1980-01-01' where id=4004;
set role authenticated;
select public.reject004('select public.confirmar_participantes_competencia(4004,array[4004],''manual'',''Nacimiento NULL'')','23514');
reset role;
update public.jugadores set fecha_nacimiento='2000-01-01' where id=4004;
update public.habilitaciones_jugador_categoria set tipo_resolucion='ordinaria' where jugador_id=4004 and categoria_temporada_id=4004;
set role authenticated;
select public.confirmar_participantes_competencia(4004,array[4004],'manual','Reincorporación posterior',null);
reset role;
alter table public.competencia_control_deportivo disable trigger b_validar;
update public.competencia_control_deportivo set estado_deportivo='en_curso' where competencia_id=4004;
alter table public.competencia_control_deportivo enable trigger b_validar;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',false);
select public.reject004('select public.confirmar_participantes_competencia(4004,array[4004],''manual'',''Programación iniciada'')','55000');
reset role;
alter table public.competencia_control_deportivo disable trigger b_validar;
update public.competencia_control_deportivo set estado_deportivo='preparada' where competencia_id=4004;
alter table public.competencia_control_deportivo enable trigger b_validar;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000003"}',false);
select public.reject004('select public.confirmar_participantes_competencia(4004,array[4004],''manual'',''Jugador'')','42501');
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',false);
select public.check004((select count(*)=0 from public.consultar_mis_participaciones()),'Juez no consulta como jugador');
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000003"}',false);
select public.check004((select count(*)=1 from public.consultar_mis_participaciones()),'Jugador ve solo su participación');
select public.check004((select count(*)=0 from public.consultar_mis_participaciones() where categoria_nombre like '%PRIVADO%'),'Consulta sin datos privados');
select public.check004((select has_function_privilege('anon','public.confirmar_participantes_competencia(bigint,bigint[],text,text,text)','execute')=false),'Anon no confirma');
select public.check004((select has_function_privilege('authenticated','public.solicitar_inscripcion(bigint,bigint,text)','execute')),'RPC 004 conserva permiso');
select set_config('request.jwt.claims','{}',false);
select public.reject004('select public.confirmar_participantes_competencia(4004,array[4004],''manual'',''Sin identidad'')','42501');
select 'Pruebas 009 participantes completadas';`));
const concurrentSql="set statement_timeout='5s'; set role authenticated; select set_config('request.jwt.claims','{\"sub\":\"e0040000-0000-0000-0000-000000000002\"}',false); select public.confirmar_participantes_competencia(4004,array[4004],'manual','Concurrencia','Corrección concurrente');";
const concurrent=await Promise.all([psqlAsync(concurrentSql),psqlAsync(concurrentSql)]);
assert.equal(concurrent.length,2); console.log("Concurrencia PostgreSQL completada:",concurrent.map(x=>x.split("\n").at(-1)).join(","));
const groupsSql=`set role authenticated; select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',false);
select public.confirmar_participantes_competencia(4004,array[4004,4005,4006,4007],'manual','Nómina para grupos',null);
select public.reject004('select public.guardar_grupos_competencia(4004,''[{"numero":1,"jugador_ids":[4004,4005,4006,4007]}]''::jsonb,''Serpiente no implementada'',''serpiente'',''ranking_liga'',''[{"jugador_id":4004,"posicion_ranking":1}]''::jsonb,''[]''::jsonb)','0A000');
select public.reject004('select public.guardar_grupos_competencia(4004,''[{"numero":1,"jugador_ids":[4004,4005,4006,4007]}]''::jsonb,''Posicion duplicada'',''manual'',''ranking_liga'',''[{"jugador_id":4004,"posicion_ranking":"1"},{"jugador_id":4005,"posicion_ranking":"01"},{"jugador_id":4006,"posicion_ranking":3},{"jugador_id":4007,"posicion_ranking":4}]''::jsonb,''[]''::jsonb)','23514');
select public.reject004('select public.guardar_grupos_competencia(4004,''[{"numero":1,"jugador_ids":[4004,4005,4006,4007]}]''::jsonb,''Posicion faltante'',''manual'',''ranking_liga'',''[{"jugador_id":4004,"posicion_ranking":1},{"jugador_id":4005,"posicion_ranking":2},{"jugador_id":4006,"posicion_ranking":4},{"jugador_id":4007,"posicion_ranking":5}]''::jsonb,''[]''::jsonb)','23514');
select public.reject004('select public.guardar_grupos_competencia(4004,''[{"numero":1,"jugador_ids":[4004,4005,4006,4007]}]''::jsonb,''Posicion invalida'',''manual'',''ranking_liga'',''[{"jugador_id":4004,"posicion_ranking":"x"},{"jugador_id":4005,"posicion_ranking":2},{"jugador_id":4006,"posicion_ranking":3},{"jugador_id":4007,"posicion_ranking":4}]''::jsonb,''[]''::jsonb)','22023');
select public.reject004('select public.guardar_grupos_competencia(4004,''[{"numero":1,"jugador_ids":[4004,4005,4006,4007]}]''::jsonb,''Jugador invalido'',''manual'',''ranking_liga'',''[{"jugador_id":"abc","posicion_ranking":1},{"jugador_id":4005,"posicion_ranking":2},{"jugador_id":4006,"posicion_ranking":3},{"jugador_id":4007,"posicion_ranking":4}]''::jsonb,''[]''::jsonb)','22023');
select public.guardar_grupos_competencia(4004,'[{"numero":1,"jugador_ids":[4004,4005,4006,4007]}]'::jsonb,'Borrador grupos','manual','ranking_liga','[{"jugador_id":4004,"posicion_ranking":1},{"jugador_id":4005,"posicion_ranking":2},{"jugador_id":4006,"posicion_ranking":3},{"jugador_id":4007,"posicion_ranking":4}]'::jsonb,'[{"jugador_id":4007,"desde":1,"hacia":1,"motivo":"Ajuste validado por Juez"}]'::jsonb);
select public.check004((select count(*)=1 from public.grupos_competencia where competencia_id=4004 and estado='borrador'),'Borrador de grupos guardado');
select public.check004((select metodo_distribucion='manual' and fuente_deportiva='ranking_liga' and orden_siembra->0->>'jugador_id'='4004' and ajustes_manuales->0->>'motivo'='Ajuste validado por Juez' from public.grupos_competencia where competencia_id=4004 and estado='borrador'),'Metadatos de siembra y ajustes guardados');
select public.reject004('select public.guardar_grupos_competencia(4004,''[{"numero":1,"jugador_ids":[4004,4005,4006]}]''::jsonb,''Incompleto'')','23514');
select public.confirmar_grupos_competencia(4004,'Confirmación grupos');
select public.check004((select count(*)=1 from public.grupos_competencia where competencia_id=4004 and estado='confirmado'),'Grupos confirmados');
select public.check004((select count(*)=4 from public.grupo_participantes gp join public.grupos_competencia g on g.id=gp.grupo_id where g.competencia_id=4004),'Cuatro participantes distribuidos');
select public.check004((select metodo_distribucion='manual' and fuente_deportiva='ranking_liga' and orden_siembra->3->>'jugador_id'='4007' from public.grupos_competencia_historial where competencia_id=4004 and evento='confirmado'),'Confirmacion conserva orden de siembra sin afirmar serpiente');
select public.reject004('select public.confirmar_participantes_competencia(4004,array[4004],''manual'',''Retiro bloqueado'',''Corrección posterior a grupos'')','55000');
select public.reject004('select public.guardar_grupos_competencia(4004,''[{"numero":1,"jugador_ids":[4004,4005,4006,4007]}]''::jsonb,''Segunda propuesta'')','55000');`;
// Revalidaciones antes de confirmar: mutaciones sinteticas revertidas en cada caso.
const groupPrefix=groupsSql.slice(0,groupsSql.indexOf("select public.confirmar_grupos_competencia"));
console.log(sql(groupPrefix));
for (const mutation of [
  "update public.fechas set estado='borrador' where id=(select fecha_id from public.competencias where id=4004)",
  "update public.competencias set publicada=false,inscripciones_habilitadas=false where id=4004",
  "alter table public.competencia_control_deportivo disable trigger user; update public.competencia_control_deportivo set configuracion_aprobada=false,estado_deportivo='pendiente' where competencia_id=4004",
  "alter table public.reglamentos_temporada disable trigger user; update public.reglamentos_temporada set referencia_aprobacion=null,estado_revision='pendiente' where id=(select reglamento_id from public.competencia_control_deportivo where competencia_id=4004)"
]) {
  sql(`begin; set local session_replication_role=replica; ${mutation}; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',true);
select public.reject004('select public.confirmar_grupos_competencia(4004,''No disponible'')','23514'); rollback;`);
}
console.log(sql(`set role authenticated; select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',false);
select public.guardar_grupos_competencia(4004,'[{"numero":1,"jugador_ids":[4007,4006,4005,4004]}]'::jsonb,'Redistribucion');
select public.check004((select distribucion->0->'jugador_ids'='[4004,4005,4006,4007]'::jsonb from public.grupos_competencia_historial where competencia_id=4004 order by id limit 1),'Historial conserva primera distribucion');
select public.check004(not has_function_privilege('authenticated','public.validar_grupos_competencia(bigint,jsonb,text,text,jsonb)','execute'),'Validador privado');
select public.check004(not has_function_privilege('service_role','public.confirmar_grupos_competencia(bigint,text)','execute'),'Service role sin RPC');
select public.reject004('delete from public.grupos_competencia_historial','42501');
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000003"}',false);
select public.check004((select count(*)=0 from public.grupos_competencia_historial),'Jugador no ve historial');
select public.reject004('select public.confirmar_grupos_competencia(4004,''Jugador'')','42501');`));
// Ambas sesiones compiten por el mutex usado por 009. La confirmacion debe esperar.
const holder=psqlAsync(`begin; ${concurrentSql} select pg_sleep(1); commit;`);
await new Promise(resolve=>setTimeout(resolve,150));
// La nomina ahora tiene uno: confirmar nunca puede aceptar el borrador obsoleto.
await psqlAsync(`set statement_timeout='5s'; set role authenticated; select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',false); select public.reject004('select public.confirmar_grupos_competencia(4004,''Carrera'')','23514');`);
await holder;
console.log(sql(groupsSql));
const confirmedHolder=psqlAsync(`begin; set statement_timeout='5s'; select pg_advisory_xact_lock(2026003,2); select pg_sleep(1); commit;`);
await new Promise(resolve=>setTimeout(resolve,150));
await psqlAsync(`set statement_timeout='5s'; set role authenticated; select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',false); select public.reject004('select public.confirmar_participantes_competencia(4004,array[4004],''manual'',''Carrera inversa'',''Retiro'')','55000');`);
await confirmedHolder;
console.log('Revalidaciones, historial, permisos y carrera nomina/grupos aprobados');
} finally { for(const child of active) child.kill(); if(started) run("pg_ctl",["-D",data,"-m","immediate","-w","stop"]); fs.rmSync(scratch,{recursive:true,force:true}); }
