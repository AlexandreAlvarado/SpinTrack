// Cluster temporal exclusivo; no lee credenciales ni conecta a Supabase.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const bin='C:/Program Files/PostgreSQL/18/bin';
fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
const scratch=fs.mkdtempSync(path.join(root,'test-results/pg012-'));
const data=path.join(scratch,'data'), port='55412';
const env={...process.env,PGHOST:'127.0.0.1',PGPORT:port,PGUSER:'postgres',PGPASSWORD:'',PGDATABASE:'liga_012_test',PGSSLMODE:'disable',PGOPTIONS:'-c statement_timeout=10000 -c lock_timeout=5000'};
const file=name=>fs.readFileSync(path.join(root,name),'utf8');
const run=(name,args,input='')=>spawnSync(path.join(bin,name+'.exe'),args,{env,input,encoding:'utf8',timeout:30000,windowsHide:true,maxBuffer:12*1024*1024});
const args=['-X','-h','127.0.0.1','-p',port,'-U','postgres','-d','liga_012_test','-v','ON_ERROR_STOP=1','-Atq'];
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
  const create=run('psql',['-X','-h','127.0.0.1','-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],'create role anon;create role authenticated;create role service_role;create database liga_012_test;');assert.equal(create.status,0,create.stderr);
  const source=file('supabase/tests/004_inscripciones.test.sql');
  const setup=source.slice(source.indexOf('\n',source.indexOf('\\set ON_ERROR_STOP on'))+1,source.indexOf('\nbegin;\nset local role authenticated;')).replaceAll('55404',port).replaceAll('liga_004_test','liga_012_test');
  sql(`create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;`+
    file('supabase/migrations/001_base_segura.sql')+file('supabase/migrations/002_identidad_deportiva.sql')+file('supabase/migrations/003_categorias_competencias.sql')+
    file('supabase/tests/004_historica.fixture.sql').replaceAll('55404',port).replaceAll('liga_004_test','liga_012_test')+
    file('supabase/migrations/005_eliminar_cupo_maximo.sql')+file('supabase/migrations/006_retirar_dependencia_tarifa.sql')+setup+
    file('supabase/migrations/009_participantes_competencia.sql')+file('supabase/migrations/010_organizacion_grupos.sql')+file('supabase/migrations/011_partidos_grupos.sql')+file('supabase/migrations/012_resultados_sets.sql'));
  // Todas las puntuaciones y personas son fixtures del cluster temporal exclusivo.
  const pairs3=[{a:11,b:9},{a:12,b:10}];
  const capture=(id,revision=0,sets=pairs3,kind='ordinario',motive=null)=>`select public.capturar_resultado_partido(${id},${revision},'${kind}','${JSON.stringify(sets)}','Acta local','ITTF 2.11.1 verificado',true,'Descripción local',${motive ? "'"+motive+"'" : 'null'});`;
  const reject=(query,code)=>`select public.reject004($query$${query}$query$,'${code}');`;
  sql(judge+`
select public.confirmar_participantes_competencia(4004,array[4004,4005,4006,4007],'manual','Fixture');
select public.guardar_grupos_competencia(4004,'[{"numero":1,"jugador_ids":[4004,4005,4006,4007]}]','Fixture');
select public.confirmar_grupos_competencia(4004,'Fixture');
select public.generar_partidos_grupos(4004,true,'Liga local');`);
  const match=Number(sql('select min(id) from public.partidos where competencia_id=4004'));
  sql(judge+reject(capture(match),'55000'));
  sql(judge+`select public.confirmar_partidos_grupos(4004,(select id from public.lotes_partidos_grupos where competencia_id=4004),'Fixture');`);
  // Puntuación: ambos ganadores, 2–0, 2–1, deuce sin tope deportivo y todas las entradas inválidas.
  for(const sets of [pairs3,[{a:0,b:11},{a:9,b:11}],[{a:11,b:0},{a:10,b:12},{a:1001,b:999}]])
    sql(`select public.calcular_resultado_sets_012('${JSON.stringify(sets)}',3);`);
  for(const sets of [[],[{a:11,b:3}],[{a:11,b:3},{a:3,b:11}],
    [{a:11,b:10},{a:11,b:3}],[{a:12,b:9},{a:11,b:3}],[{a:13,b:10},{a:11,b:3}],
    [{a:11,b:11},{a:11,b:3}],[{a:10,b:8},{a:11,b:3}],
    [...pairs3,{a:11,b:0}],[...pairs3,...pairs3]])
    sql(judge+reject(capture(match,0,sets),'23514'));
  for(const sets of [[{a:-1,b:11},{a:11,b:3}],[{a:11.5,b:9},{a:11,b:3}],
    [{a:'11',b:9},{a:11,b:3}],[{a:11,b:null},{a:11,b:3}],
    [{a:11,b:9,ganador:1},{a:11,b:3}],[{a:2147483648,b:2147483646},{a:11,b:3}], [null,{a:11,b:3}]])
    sql(judge+reject(capture(match,0,sets),'22023'));
  sql(judge+reject(capture(match).replace(',true,',',null,'),'22023')+reject(capture(match).replace("'ITTF 2.11.1 verificado'","' '"),'22023'));
  // Sin sesión, Admin, Jugador y Árbitro no asignado no escriben ni confirman.
  for(const suffix of ['001','003','005',null]) {
    const claims=suffix?JSON.stringify({sub:'e0040000-0000-0000-0000-000000000'+suffix.slice(-1)}):'{}';
    sql(`set role authenticated;select set_config('request.jwt.claims','${claims}',false);`+
      reject(capture(match),'42501')+reject(`select public.confirmar_resultado_partido(${match},1,1,'Intento');`,'42501'));
  }
  // Dos capturas desde revisión cero: solo una gana.
  const race=await Promise.allSettled([concurrent(judge+capture(match)),concurrent(judge+capture(match))]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  assert.match(race.find(r=>r.status==='rejected').reason.message,/cambió/);
  const result=Number(sql(`select id from public.resultados_partidos where partido_id=${match}`));
  sql(judge+`select public.check004((select sets_a=2 and sets_b=0 and ganador_id=(select jugador_a_id from public.partidos where id=${match}) and autor_id=auth.uid() and creado_en is not null from public.resultados_partidos where id=${result}),'Resumen y autor calculados');
select public.check004((select count(*)=0 from public.resultados_confirmados_grupos),'Captura no es confirmación');`+
    reject(`update public.resultados_partidos set sets_a=0 where id=${result}`,'42501')+
    reject('delete from public.resultados_partidos_eventos','42501')+
    reject('select public.puede_capturar_resultado_012(1)','42501'));
  const confirm=judge+`select public.confirmar_resultado_partido(${match},${result},1,'Revisado local');`;
  const confirmations=await Promise.allSettled([concurrent(confirm),concurrent(confirm)]);
  assert.equal(confirmations.filter(r=>r.status==='fulfilled').length,1);
  sql(judge+`select public.check004((select count(*)=1 from public.resultados_confirmados_grupos),'Solo confirmados para clasificación futura');`+
    reject(capture(match,0),'40001')+reject(capture(match,1),'42501'));
  sql(judge+capture(match,1,[{a:2,b:11},{a:10,b:12}],'ordinario','Error de transcripción'));
  const correction=Number(sql(`select id from public.resultados_partidos where partido_id=${match} and revision=2`));
  sql(judge+`select public.check004((select resultado_id=${result} from public.resultados_confirmados_grupos),'Confirmado previo vigente durante corrección');`+
    reject(`select public.confirmar_resultado_partido(${match},${result},1,'Obsoleto')`,'40001')+
    `select public.confirmar_resultado_partido(${match},${correction},2,'Corrección revisada');
select public.check004((select resultado_id=${correction} and sets_b=2 from public.resultados_confirmados_grupos),'Corrección confirmada sustituye proyección');
select public.check004((select count(*)=2 from public.resultados_partidos_eventos),'Ambas confirmaciones conservadas');
select public.check004(not has_function_privilege('service_role','public.capturar_resultado_partido(bigint,integer,text,jsonb,text,text,boolean,text,text)','execute'),'Service sin RPC');
select public.check004(not has_table_privilege('service_role','public.resultados_partidos','insert'),'Service sin DML');`);
  for(const table of ['resultados_partidos','resultados_partidos_eventos'])
    sql(reject(`update public.${table} set referencia='Alterado'`,'55000')+reject(`delete from public.${table}`,'55000'));
  // Un resumen privilegiado falso también es rechazado por trigger.
  sql(judge+reject(`insert into public.resultados_partidos(partido_id,revision,tipo,sets,mejor_de,sets_a,sets_b,ganador_id,referencia_reglas,referencia,motivo_correccion,autor_id)
values(${match},3,'ordinario','${JSON.stringify(pairs3)}',3,0,2,4005,'Reglas','Acta','Corrección',auth.uid())`,'42501'));
  sql(`select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',false);`+
    reject(`insert into public.resultados_partidos(partido_id,revision,tipo,sets,mejor_de,sets_a,sets_b,ganador_id,referencia_reglas,referencia,motivo_correccion,autor_id)
values(${match},3,'ordinario','${JSON.stringify(pairs3)}',3,0,2,4005,'Reglas','Acta','Corrección',auth.uid())`,'23514'));
  // Incidencias no asignan sets/ganador ni admiten confirmación deportiva automática.
  const other=sql(`select id from public.partidos where id<>${match} order by id limit 3`).split('\n').map(Number);
  for(const [i,kind] of ['incomparecencia','retiro','suspension'].entries()) {
    sql(judge+capture(other[i],0,[],kind));
    const id=Number(sql(`select id from public.resultados_partidos where partido_id=${other[i]}`));
    sql(judge+reject(`select public.confirmar_resultado_partido(${other[i]},${id},1,'Sin resolver')`,'55000')+
      `select public.check004((select ganador_id is null and sets_a is null and sets_b is null from public.resultados_partidos where id=${id}),'Incidencia sin consecuencias inventadas');`);
  }
  sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000005"}',false);
select public.check004((select count(*)=0 from public.resultados_partidos),'Árbitro sin lectura global');
select public.check004((select count(*)=0 from public.resultados_confirmados_grupos),'Vista respeta RLS');
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',false);
select public.check004((select count(*)>0 from public.resultados_partidos),'Administrador puede leer');`);
  // Formato cinco real aprobado antes de confirmar lote, sin modificar migraciones.
  sql(`alter table public.competencia_formatos_sets disable trigger user;update public.competencia_formatos_sets set mejor_de=5 where competencia_id=4005 and etapa='grupos';alter table public.competencia_formatos_sets enable trigger user;
${judge}select public.confirmar_participantes_competencia(4005,array[4004,4005,4006,4007],'manual','Fixture');
select public.guardar_grupos_competencia(4005,'[{"numero":1,"jugador_ids":[4004,4005,4006,4007]}]','Fixture');
select public.confirmar_grupos_competencia(4005,'Fixture');select public.generar_partidos_grupos(4005,true,'Fixture');
select public.confirmar_partidos_grupos(4005,(select id from public.lotes_partidos_grupos where competencia_id=4005),'Fixture');`);
  const five=Number(sql('select min(id) from public.partidos where competencia_id=4005'));
  sql(judge+reject(capture(five),'23514')+capture(five,0,[{a:0,b:11},{a:11,b:0},{a:10,b:12},{a:11,b:9},{a:15,b:13}]));
  sql(judge+`select public.check004((select mejor_de=5 and sets_a=3 and sets_b=2 from public.resultados_partidos where partido_id=${five}),'Formato cinco: 3–2 calculado');`);
  // Confirmación versus corrección: jamás confirma silenciosamente una revisión obsoleta.
  const fiveId=Number(sql(`select id from public.resultados_partidos where partido_id=${five}`));
  const conflict=await Promise.allSettled([
    concurrent(judge+capture(five,1,[...pairs3,{a:11,b:0}],'ordinario','Corrección concurrente')),
    concurrent(judge+`select public.confirmar_resultado_partido(${five},${fiveId},1,'Revisión concurrente')`),
  ]);
  assert.equal(conflict[0].status,'fulfilled');
  sql(`select public.check004((select count(*)=2 from public.resultados_partidos where partido_id=${five}),'Revisiones concurrentes conservadas');`);
  console.log('012 PostgreSQL temporal: puntuación 3/5, captura/confirmación, correcciones, concurrencia, incidencias, permisos, RLS y auditoría aprobados.');
} finally {
  if(started) assert.equal(run('pg_ctl',['-D',data,'-m','immediate','-w','stop']).status,0);
  // scratch se resuelve desde mkdtemp bajo test-results del workspace.
  assert.ok(path.resolve(scratch).startsWith(path.resolve(root,'test-results')+path.sep));
  fs.rmSync(scratch,{recursive:true,force:true});
}
