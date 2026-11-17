// Cluster temporal exclusivo; no lee credenciales ni conecta a Supabase.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const bin='C:/Program Files/PostgreSQL/18/bin';
fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
const scratch=fs.mkdtempSync(path.join(root,'test-results/pg013-'));
const data=path.join(scratch,'data'), port='55413';
const env={...process.env,PGHOST:'127.0.0.1',PGPORT:port,PGUSER:'postgres',PGPASSWORD:'',PGDATABASE:'liga_013_test',PGSSLMODE:'disable',PGOPTIONS:'-c statement_timeout=10000 -c lock_timeout=5000'};
const file=name=>fs.readFileSync(path.join(root,name),'utf8');
const run=(name,args,input='')=>spawnSync(path.join(bin,name+'.exe'),args,{env,input,encoding:'utf8',timeout:30000,windowsHide:true,maxBuffer:12*1024*1024});
const runInitdb=(args)=>spawnSync(path.join(bin,'initdb.exe'),args,{env,stdio:'ignore',timeout:120000,windowsHide:true});
const runDetached=(name,args)=>spawnSync(path.join(bin,name+'.exe'),args,{env,stdio:'ignore',timeout:15000,windowsHide:true});
const args=['-X','-h','127.0.0.1','-p',port,'-U','postgres','-d','liga_013_test','-v','ON_ERROR_STOP=1','-Atq'];
const sql=input=>{const r=run('psql',args,input);assert.equal(r.status,0,r.stderr+r.stdout);return r.stdout.trim();};
const judge=`set role authenticated; select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',false);`;
const concurrent=input=>new Promise((resolve,reject)=>{
  const child=spawn(path.join(bin,'psql.exe'),args,{env,windowsHide:true}); let out='';
  const timer=setTimeout(()=>{ if(process.platform==='win32' && child.pid) spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true}); else child.kill('SIGKILL'); },8000);
  child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>out+=d);
  child.on('error',reject);child.on('close',code=>{clearTimeout(timer);if(code===0)resolve(out);else reject(new Error(out));});child.stdin.end(input);
});
let started=false;
try {
  assert.equal(runInitdb(['-D',data,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C']).status,0);
  const start=runDetached('pg_ctl',['-D',data,'-l',path.join(scratch,'server.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']); assert.equal(start.status,0);started=true;let ready=null;for(let i=0;i<30;i++){ready=run('pg_isready',['-h','127.0.0.1','-p',port,'-U','postgres','-d','postgres']);if(ready.status===0)break;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);}assert.equal(ready?.status,0,ready?.stderr);
  const create=run('psql',['-X','-h','127.0.0.1','-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],'create role anon;create role authenticated;create role service_role;create database liga_013_test;');assert.equal(create.status,0,create.stderr);
  const source=file('supabase/tests/004_inscripciones.test.sql');
  const setup=source.slice(source.indexOf('\n',source.indexOf('\\set ON_ERROR_STOP on'))+1,source.indexOf('\nbegin;\nset local role authenticated;')).replaceAll('55404',port).replaceAll('liga_004_test','liga_013_test');
  sql(`create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;`+
    file('supabase/migrations/001_base_segura.sql')+file('supabase/migrations/002_identidad_deportiva.sql')+file('supabase/migrations/003_categorias_competencias.sql')+
    file('supabase/tests/004_historica.fixture.sql').replaceAll('55404',port).replaceAll('liga_004_test','liga_013_test')+
    file('supabase/migrations/005_eliminar_cupo_maximo.sql')+file('supabase/migrations/006_retirar_dependencia_tarifa.sql')+setup+
    file('supabase/migrations/009_participantes_competencia.sql')+file('supabase/migrations/010_organizacion_grupos.sql')+file('supabase/migrations/011_partidos_grupos.sql')+file('supabase/migrations/012_resultados_sets.sql')+file('supabase/migrations/013_asignaciones_arbitros_resultados.sql')+file('supabase/migrations/014_acceso_lectura_arbitros.sql'));
  sql(`select public.check004(not has_function_privilege('anon','public.observar_resultado_partido(bigint,bigint,integer,text)','EXECUTE'),'Anon no puede ejecutar observar');select public.check004(not has_function_privilege('anon','public.capturar_resultado_partido(bigint,integer,text,jsonb,text,text,boolean,text,text)','EXECUTE'),'Anon no puede ejecutar capturar');select public.check004(has_function_privilege('authenticated','public.observar_resultado_partido(bigint,bigint,integer,text)','EXECUTE'),'Authenticated tiene solo la puerta RPC');`);
  const reject=(query,code)=>`select public.reject004($query$${query}$query$,'${code}');`;
  const score=JSON.stringify([{a:11,b:9},{a:12,b:10}]);
  const capture=(id,rev=0,motive=null)=>`select public.capturar_resultado_partido(${id},${rev},'ordinario','${score}','Acta del partido','Reglamento aprobado',true,'',${motive ? "'"+motive+"'" : 'null'});`;
  sql(judge+`select public.confirmar_participantes_competencia(4004,array[4004,4005,4006,4007],'manual','Fixture');
select public.guardar_grupos_competencia(4004,'[{"numero":1,"jugador_ids":[4004,4005,4006,4007]}]','Fixture');
select public.confirmar_grupos_competencia(4004,'Fixture');select public.generar_partidos_grupos(4004,true,'Liga');select public.confirmar_partidos_grupos(4004,(select id from public.lotes_partidos_grupos where competencia_id=4004),'Liga');`);
  const match=Number(sql('select min(id) from public.partidos where competencia_id=4004'));
  sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',false);update public.jugadores set perfil_id='e0040000-0000-0000-0000-000000000005' where id=4004;`);
  sql(judge+reject(`select public.asignar_arbitro_partido(${match},'e0040000-0000-0000-0000-000000000005','Auto')`,'23514'));
  sql(`reset role;insert into auth.users(id,email,raw_user_meta_data) values('e0040000-0000-0000-0000-000000000006','arb2@example.invalid','{}');update public.perfiles set rol='arbitro' where id='e0040000-0000-0000-0000-000000000006';`);
  sql(judge+`select public.asignar_arbitro_partido(${match},'e0040000-0000-0000-0000-000000000006','Asignacion fixture');`);
  sql(judge+`select public.asignar_arbitro_partido(id,'e0040000-0000-0000-0000-000000000006','Asignación de los seis partidos') from public.partidos where competencia_id=4004;`);
  sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000006"}',false);
select public.check004((select count(*)=6 from public.partidos p join public.lotes_partidos_grupos l on l.id=p.lote_id where p.competencia_id=4004 and l.estado='confirmado'),'Árbitro asignado ve los seis partidos confirmados');
select public.check004((select count(*)=4 from public.jugadores j where exists(select 1 from public.partidos p join public.partidos_arbitros pa on pa.partido_id=p.id where pa.arbitro_id=auth.uid() and pa.activo and j.id in(p.jugador_a_id,p.jugador_b_id))),'Árbitro ve jugadores de sus partidos');`);
  sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000005"}',false);
select public.check004((select count(*)=0 from public.partidos p where exists(select 1 from public.partidos_arbitros pa where pa.partido_id=p.id and pa.arbitro_id=auth.uid() and pa.activo)),'Árbitro sin asignaciones no ve partidos');`);
  sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000003"}',false);
select public.check004((select count(*)=0 from public.partidos),'Jugador no autorizado no ve partidos');`);
  sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000006"}',false);`+capture(match));
  const result=Number(sql(`select id from public.resultados_partidos where partido_id=${match}`));
  sql(judge+reject(capture(match,1),'42501'));
  sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000005"}',false);`+reject(`select public.confirmar_resultado_partido(${match},${result},1,'No puede confirmar')`,'42501'));
  sql(judge+`select public.confirmar_resultado_partido(${match},${result},1,'RevisiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n del Juez');`);
  sql(judge+`select public.check004((select count(*)=1 from public.resultados_confirmados_grupos where partido_id=${match}),'Solo confirmado es oficial');`);
  sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000006"}',false);`+capture(match,1,'CorrecciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½n solicitada'));
  const correction=Number(sql(`select id from public.resultados_partidos where partido_id=${match} and revision=2`));
  sql(judge+`select public.observar_resultado_partido(${match},${correction},2,'Revisa el segundo set');`);
  sql(judge+`select public.check004((select count(*)=1 from public.resultados_partidos_observaciones where resultado_id=${correction}),'DevoluciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n auditada');`);
  sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000005"}',false);`+reject(`select public.observar_resultado_partido(${match},${correction},2,'No')`,'42501'));
  sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000003"}',false);`+reject(`select public.observar_resultado_partido(${match},${correction},2,'Jugador no puede observar')`,'42501'));
  sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000006"}',false);`+capture(match,2,'CorrecciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½n final'));
  const finalResult=Number(sql(`select id from public.resultados_partidos where partido_id=${match} and revision=3`));
  const race=await Promise.allSettled([concurrent(judge+`select public.confirmar_resultado_partido(${match},${finalResult},3,'ConfirmaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n');`),concurrent(judge+`select public.confirmar_resultado_partido(${match},${finalResult},3,'ConfirmaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n');`)]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  sql(judge+`select public.check004((select count(*)=3 from public.resultados_partidos where partido_id=${match}),'Historial de tres revisiones');select public.check004((select count(*)=2 from public.resultados_partidos_eventos),'Confirmaciones auditadas');`);
  sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',false);select public.check004((select count(*)=7 from public.partidos_arbitros_historial),'Administrador consulta auditorÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a');`);
  sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000003"}',false);select public.check004((select count(*)=0 from public.partidos_arbitros),'Jugador no ve asignaciones');`);
  console.log('013 PostgreSQL temporal: permisos 014, seis partidos asignados, árbitro sin asignaciones y usuario no autorizado aprobados.');
} finally {
  if(started) assert.equal(run('pg_ctl',['-D',data,'-m','immediate','-w','stop']).status,0);
  // scratch se resuelve desde mkdtemp bajo test-results del workspace.
  assert.ok(path.resolve(scratch).startsWith(path.resolve(root,'test-results')+path.sep));
  fs.rmSync(scratch,{recursive:true,force:true});
}
