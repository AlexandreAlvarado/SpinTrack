// Cluster temporal exclusivo; no lee credenciales ni conecta a Supabase.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const bin='C:/Program Files/PostgreSQL/18/bin';
fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
const scratch=fs.mkdtempSync(path.join(root,'test-results/pg011-'));
const data=path.join(scratch,'data'), port='55411';
const env={...process.env,PGHOST:'127.0.0.1',PGPORT:port,PGUSER:'postgres',PGPASSWORD:'',PGDATABASE:'liga_011_test',PGSSLMODE:'disable',PGOPTIONS:'-c statement_timeout=10000 -c lock_timeout=5000'};
const file=name=>fs.readFileSync(path.join(root,name),'utf8');
const run=(name,args,input='')=>spawnSync(path.join(bin,name+'.exe'),args,{env,input,encoding:'utf8',timeout:30000,windowsHide:true,maxBuffer:12*1024*1024});
const args=['-X','-h','127.0.0.1','-p',port,'-U','postgres','-d','liga_011_test','-v','ON_ERROR_STOP=1','-Atq'];
const sql=input=>{const r=run('psql',args,input);assert.equal(r.status,0,r.stderr+r.stdout);return r.stdout.trim();};
const judge=`set role authenticated; select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',false);`;
const concurrent=input=>new Promise((resolve,reject)=>{
  const child=spawn(path.join(bin,'psql.exe'),args,{env,windowsHide:true}); let out='';
  const timer=setTimeout(()=>child.kill(),8000);
  child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>out+=d);
  child.on('error',reject);child.on('close',code=>{clearTimeout(timer);if(code===0)resolve(out);else reject(new Error(out));});child.stdin.end(input);
});
let started=false;
try {
  assert.equal(run('initdb',['-D',data,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C']).status,0);
  const start=run('pg_ctl',['-D',data,'-l',path.join(scratch,'server.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']); assert.equal(start.status,0,start.stderr);started=true;
  const create=run('psql',['-X','-h','127.0.0.1','-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],'create role anon;create role authenticated;create role service_role;create database liga_011_test;');assert.equal(create.status,0,create.stderr);
  const source=file('supabase/tests/004_inscripciones.test.sql');
  const setup=source.slice(source.indexOf('\n',source.indexOf('\\set ON_ERROR_STOP on'))+1,source.indexOf('\nbegin;\nset local role authenticated;')).replaceAll('55404',port).replaceAll('liga_004_test','liga_011_test');
  sql(`create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;`+
    file('supabase/migrations/001_base_segura.sql')+file('supabase/migrations/002_identidad_deportiva.sql')+file('supabase/migrations/003_categorias_competencias.sql')+
    file('supabase/tests/004_historica.fixture.sql').replaceAll('55404',port).replaceAll('liga_004_test','liga_011_test')+
    file('supabase/migrations/005_eliminar_cupo_maximo.sql')+file('supabase/migrations/006_retirar_dependencia_tarifa.sql')+setup+
    file('supabase/migrations/009_participantes_competencia.sql')+file('supabase/migrations/010_organizacion_grupos.sql')+file('supabase/migrations/011_partidos_grupos.sql'));
  console.log(sql(judge+`
select public.reject004('select public.generar_partidos_grupos(4004,true,''Liga'')','23514');
select public.confirmar_participantes_competencia(4004,array[4004,4005,4006,4007],'manual','Fixture');
select public.guardar_grupos_competencia(4004,'[{"numero":1,"jugador_ids":[4004,4005,4006,4007]}]','Fixture');
select public.reject004('select public.generar_partidos_grupos(4004,true,''Liga'')','23514');
select public.confirmar_grupos_competencia(4004,'Fixture');
select public.reject004('select public.generar_partidos_grupos(4004,false,''Liga'')','22023');
select public.reject004('select public.generar_partidos_grupos(4004,null,''Liga'')','22023');
select public.reject004('select public.generar_partidos_grupos(4004,true,'' '')','22023');
select public.generar_partidos_grupos(4004,true,'Resolución Liga sintética');
select public.check004((select count(*)=6 from public.partidos),'4 jugadores: 6 cruces');
select public.check004((select bool_and(jugador_a_id<jugador_b_id) from public.partidos),'Sin autoenfrentamientos ni inversos');
select public.check004((select mejor_de=3 and estado='borrador' from public.lotes_partidos_grupos),'Sets aprobados y borrador');
select public.descartar_partidos_grupos(4004,(select id from public.lotes_partidos_grupos where estado='borrador'),'Distribución revisada por el Juez','Descarte de prueba');
select public.check004((select estado='descartado' and motivo_descarte='Distribución revisada por el Juez' from public.lotes_partidos_grupos where estado='descartado'),'Borrador descartado con motivo');
select public.check004((select count(*)=1 from public.partidos_grupos_historial where evento='descartado' and motivo='Distribución revisada por el Juez'),'Descarte auditado');
select public.check004((select count(*)=0 from public.partidos where competencia_id=4004),'Partidos del borrador descartado retirados tras conservar historial');
select public.generar_partidos_grupos(4004,true,'Regeneración autorizada');
select public.check004((select count(*)=6 from public.partidos where competencia_id=4004),'Regeneración produce seis cruces');
select public.reject004('select public.generar_partidos_grupos(4004,true,''Otra'')','55000');
select public.reject004('select public.descartar_partidos_grupos(4004,(select id from public.lotes_partidos_grupos where estado=''confirmado''),''No corresponde'',''Intento'')','55000');
select public.reject004('select public.confirmar_partidos_grupos(4004,999999,''Revisión'')','55000');
select public.reject004('delete from public.partidos','42501');
select public.reject004('delete from public.partidos_grupos_historial','42501');
select public.reject004('update public.competencia_control_deportivo set configuracion_aprobada=false,estado_deportivo=''pendiente'' where competencia_id=4004','23514');
select public.reject004('update public.competencia_formatos_sets set mejor_de=5 where competencia_id=4004 and etapa=''grupos''','23514');
reset role;
select public.reject004('update public.grupos_competencia set numero=2 where competencia_id=4004','55000');
select public.reject004('delete from public.grupo_participantes where jugador_id=4004','55000');
select public.reject004('insert into public.partidos(lote_id,competencia_id,grupo_id,jugador_a_id,jugador_b_id) select id,4004,(select id from public.grupos_competencia where competencia_id=4004),4004,4004 from public.lotes_partidos_grupos where estado=''borrador''','23514');
select public.reject004('insert into public.partidos(lote_id,competencia_id,grupo_id,jugador_a_id,jugador_b_id) select id,4004,(select id from public.grupos_competencia where competencia_id=4004),4004,4008 from public.lotes_partidos_grupos where estado=''borrador''','23503');
select public.reject004('insert into public.partidos(lote_id,competencia_id,grupo_id,jugador_a_id,jugador_b_id) select lote_id,competencia_id,grupo_id,jugador_a_id,jugador_b_id from public.partidos limit 1','23505');
begin; delete from public.partidos where id=(select min(id) from public.partidos);
${judge}select public.reject004('select public.confirmar_partidos_grupos(4004,(select id from public.lotes_partidos_grupos where estado=''borrador''),''Incompleto'')','23514');rollback;
${judge}select public.check004(not has_function_privilege('service_role','public.generar_partidos_grupos(bigint,boolean,text)','execute'),'Service sin RPC');
select public.check004(not has_function_privilege('authenticated','public.revisar_contexto_partidos_011(bigint)','execute'),'Validador privado');
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',false);
select public.reject004('select public.generar_partidos_grupos(4005,true,''Admin'')','42501');
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000003"}',false);
select public.check004((select count(*)=0 from public.partidos),'Jugador sin lectura');
select public.reject004('select public.confirmar_partidos_grupos(4004,1,''Jugador'')','42501');
select set_config('request.jwt.claims','{}',false);
select public.reject004('select public.generar_partidos_grupos(4004,true,''Sin sesión'')','42501');`));
  // Cada contexto invalidado debe impedir confirmar el borrador existente.
  for (const mutation of [
    "update public.fechas set estado='borrador' where id=4004",
    "update public.competencias set publicada=false,inscripciones_habilitadas=false where id=4004",
    "update public.competencia_control_deportivo set configuracion_aprobada=false,estado_deportivo='pendiente' where competencia_id=4004",
    "update public.reglamentos_temporada set estado_revision='pendiente',referencia_aprobacion=null where id=4004",
  ]) sql(`begin;set local session_replication_role=replica;${mutation};${judge}
select public.reject004('select public.confirmar_partidos_grupos(4004,(select id from public.lotes_partidos_grupos where estado=''borrador''),''Contexto inválido'')','23514');rollback;`);
  // Dos confirmaciones simultáneas: exactamente una acepta y la otra rechaza.
  const confirm=judge+`select public.confirmar_partidos_grupos(4004,(select id from public.lotes_partidos_grupos where competencia_id=4004 and estado='borrador'),'Revisión concurrente');`;
  const results=await Promise.allSettled([concurrent(confirm),concurrent(confirm)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.match(results.find(r=>r.status==='rejected').reason.message,/confirmado|desactualizado/);
  console.log(sql(judge+`select public.check004((select count(*)=4 from public.partidos_grupos_historial),'Generación, descarte y confirmación auditadas');select public.check004((select estado='confirmado' from public.lotes_partidos_grupos where estado='confirmado'),'Confirmación persistente');`));
  console.log(sql(`reset role;select public.reject004('update public.lotes_partidos_grupos set referencia_formato=''alterado'' where estado=''confirmado''','55000');select public.reject004('delete from public.lotes_partidos_grupos where estado=''confirmado''','55000');select public.reject004('delete from public.partidos where lote_id=(select id from public.lotes_partidos_grupos where estado=''confirmado'')','55000');`));
  // Siete participantes, dos grupos (3 + 4), sets de cinco en otra competencia.
  sql(`reset role;insert into public.jugadores(id,nombre_completo,fecha_nacimiento) overriding system value select n,'Fixture '||n,'2000-01-01' from generate_series(4010,4016) n;
${judge}insert into public.habilitaciones_jugador_categoria(jugador_id,categoria_temporada_id,estado,motivo,referencia_evidencia) select n,4005,'habilitado','Fixture','Fixture' from generate_series(4010,4016) n;
reset role;alter table public.competencia_formatos_sets disable trigger user;update public.competencia_formatos_sets set mejor_de=5 where competencia_id=4005 and etapa='grupos';alter table public.competencia_formatos_sets enable trigger user;
${judge}select public.confirmar_participantes_competencia(4005,array[4010,4011,4012,4013,4014,4015,4016],'manual','Fixture');
select public.guardar_grupos_competencia(4005,'[{"numero":1,"jugador_ids":[4010,4011,4012]},{"numero":2,"jugador_ids":[4013,4014,4015,4016]}]','Fixture');
select public.confirmar_grupos_competencia(4005,'Fixture');select public.generar_partidos_grupos(4005,true,'Liga fixture');
select public.check004((select count(*)=3 from public.partidos p join public.grupos_competencia g on g.id=p.grupo_id where p.competencia_id=4005 and g.numero=1),'3 jugadores: 3 cruces');
select public.check004((select count(*)=9 from public.partidos where competencia_id=4005),'Dos grupos sin cruces entre grupos');
select public.check004((select mejor_de=5 from public.lotes_partidos_grupos where competencia_id=4005),'Sets cinco conservados');`);
  console.log('011 PostgreSQL temporal: cruces, revisión, permisos, trazabilidad y concurrencia aprobados.');
} finally {
  if(started) assert.equal(run('pg_ctl',['-D',data,'-m','immediate','-w','stop']).status,0);
  // scratch se resuelve desde mkdtemp bajo test-results del workspace.
  assert.ok(path.resolve(scratch).startsWith(path.resolve(root,'test-results')+path.sep));
  fs.rmSync(scratch,{recursive:true,force:true});
}
