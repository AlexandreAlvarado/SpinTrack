// Cluster temporal exclusivo; no lee credenciales ni conecta a Supabase.
import fs from 'node:fs';
import net from 'node:net';
import Module from 'node:module';
import ts from 'typescript';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const bin='C:/Program Files/PostgreSQL/18/bin';
fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
const scratch=fs.mkdtempSync(path.join(root,'test-results/pg023-'));
const data=path.join(scratch,'data');
const port=await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const selected=server.address().port;server.close(()=>resolve(String(selected)));});});
const env={...process.env,PGHOST:'127.0.0.1',PGPORT:port,PGUSER:'postgres',PGPASSWORD:'',PGDATABASE:'liga_023_test',PGSSLMODE:'disable',PGOPTIONS:'-c statement_timeout=10000 -c lock_timeout=5000'};
const file=name=>fs.readFileSync(path.join(root,name),'utf8').replace(/^\uFEFF/,'');
const run=(name,args,input='')=>spawnSync(path.join(bin,name+'.exe'),args,{env,input,encoding:'utf8',timeout:30000,windowsHide:true,maxBuffer:12*1024*1024});
const runInitdb=(args)=>spawnSync(path.join(bin,'initdb.exe'),args,{env,stdio:'ignore',timeout:120000,windowsHide:true});
const runDetached=(name,args)=>spawnSync(path.join(bin,name+'.exe'),args,{env,stdio:'ignore',timeout:15000,windowsHide:true});
const args=['-X','-h','127.0.0.1','-p',port,'-U','postgres','-d','liga_023_test','-v','ON_ERROR_STOP=1','-Atq'];
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
  const create=run('psql',['-X','-h','127.0.0.1','-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],'create role anon;create role authenticated;create role service_role;create database liga_023_test;');assert.equal(create.status,0,create.stderr);
  const source=file('supabase/tests/004_inscripciones.test.sql');
  const setup=source.slice(source.indexOf('\n',source.indexOf('\\set ON_ERROR_STOP on'))+1,source.indexOf('\nbegin;\nset local role authenticated;')).replaceAll('55404',port).replaceAll('liga_004_test','liga_023_test')
    .replace('competencia_formatos_sets(competencia_id,etapa,mejor_de)','competencia_formatos_sets(competencia_id,etapa,mejor_de,referencia_resolucion)')
    .replace('select c,e,3',"select c,e,case when e='final' then 5 else 3 end,'Reglas fixture locales'");
  sql(`create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;`+
    file('supabase/migrations/001_base_segura.sql')+file('supabase/migrations/002_identidad_deportiva.sql')+file('supabase/migrations/003_categorias_competencias.sql')+
    file('supabase/tests/004_historica.fixture.sql').replaceAll('55404',port).replaceAll('liga_004_test','liga_023_test')+
    file('supabase/migrations/005_eliminar_cupo_maximo.sql')+file('supabase/migrations/006_retirar_dependencia_tarifa.sql')+setup+
    file('supabase/migrations/008_importar_fichas_jugadores.sql')+file('supabase/migrations/009_participantes_competencia.sql')+file('supabase/migrations/010_organizacion_grupos.sql')+file('supabase/migrations/011_partidos_grupos.sql')+file('supabase/migrations/012_resultados_sets.sql')+file('supabase/migrations/013_asignaciones_arbitros_resultados.sql')+file('supabase/migrations/014_acceso_lectura_arbitros.sql'));

  // Instalar todas las migraciones reales disponibles en orden, incluida 022.
  let previousAssignments;
  const assignmentSnapshot=`select jsonb_build_array((select jsonb_agg(to_jsonb(a) order by partido_id) from public.partidos_arbitros a),(select jsonb_agg(to_jsonb(h) order by id) from public.partidos_arbitros_historial h))`;
  for (const name of fs.readdirSync(path.join(root,'supabase/migrations')).filter(n=>/^0(1[5-9]|2[0-4])_/.test(n)).sort()) {
    if(name.startsWith('023_')) {
      sql(judge+`select public.confirmar_participantes_competencia(4004,array[4004,4005,4006,4007],'manual','Fixture');
        select public.guardar_grupos_competencia(4004,'[{"numero":1,"jugador_ids":[4004,4005,4006,4007]}]','Fixture');
        select public.confirmar_grupos_competencia(4004,'Fixture');select public.generar_partidos_grupos(4004,true,'Liga');select public.confirmar_partidos_grupos(4004,(select id from public.lotes_partidos_grupos where competencia_id=4004),'Liga');
        select public.asignar_arbitro_partido((select min(id) from public.partidos),'e0040000-0000-0000-0000-000000000005','Asignación anterior a 023');`);
      previousAssignments=sql(assignmentSnapshot);
    }
    if(name.startsWith('022_')) {
      sql(`update public.competencia_formatos_sets set referencia_resolucion=null where competencia_id=4004 and etapa='final';
        delete from public.competencia_formato_final_021 where competencia_id=4004;`);
    }
    sql(file('supabase/migrations/'+name));
    if(name.startsWith('022_')) sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',false);update public.competencia_control_deportivo set configuracion_aprobada=true,estado_deportivo='preparada' where competencia_id=4004;`);
    if(name.startsWith('024_')) {
      sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',false);
        select public.regularizar_respaldo_final_024(4004,'Bases 2026 § final al mejor de cinco','Regularización excepcional auditada de referencia histórica');`);
      assert.equal(sql(`select referencia_resolucion='Bases 2026 § final al mejor de cinco' from public.competencia_formatos_sets where competencia_id=4004 and etapa='final'`),'t');
      assert.equal(sql(`select count(*)=1 from public.competencia_final_regularizaciones_024 where competencia_id=4004`),'t');
      sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000003"}',false);select public.reject004($q$select public.regularizar_respaldo_final_024(4004,'Falsa','Sin permiso')$q$,'42501');`);
      sql(`set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',false);select public.reject004($q$select public.regularizar_respaldo_final_024(4004,'Otra','Repetición')$q$,'23505');`);
    }
    if(name.startsWith('023_')) assert.equal(sql(assignmentSnapshot),previousAssignments,'023 conserva asignaciones y auditoría anteriores');
    if (name.startsWith('021_')) sql(judge+`select public.configurar_formato_final_021(4004,'Formato final sintético local');`);
  }
  const session = suffix => `set role authenticated;select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-00000000000${suffix}"}',false);`;
  const admin=session(1), player=session(3), legacy=session(5);
  const check = (expression,label) => sql(`select public.check004(${expression},'${label}');`);
  const reject=(query,code='42501')=>`select public.reject004($query$${query}$query$,'${code}');`;
  check(`(select arbitraje_habilitado from public.perfiles where id='e0040000-0000-0000-0000-000000000005')`,'Árbitro anterior conserva permisos');
  check(`not (select arbitraje_habilitado from public.perfiles where id='e0040000-0000-0000-0000-000000000003')`,'Jugador sin arbitraje');
  sql(player+reject(`select public.habilitar_arbitraje_023(auth.uid(),true,false)`));
  sql(player+`update public.perfiles set arbitraje_habilitado=true where id=auth.uid();`);
  check(`not (select arbitraje_habilitado from public.perfiles where id='e0040000-0000-0000-0000-000000000003')`,'RLS impide autohabilitarse');
  sql(admin+`select public.habilitar_arbitraje_023('e0040000-0000-0000-0000-000000000003',true,false);`);
  check(`(select rol='jugador' and arbitraje_habilitado from public.perfiles where id='e0040000-0000-0000-0000-000000000003')`,'Identidad y rol conservados');
  sql(player+`select public.check004(public.es_arbitro_013(),'Doble función');`);
  sql(player+reject(`insert into public.arbitraje_habilitaciones_historial(perfil_id,habilitado,actor_id) values(auth.uid(),true,auth.uid())`));
  const own=Number(sql('select min(id) from public.partidos where jugador_a_id=4004 or jugador_b_id=4004'));
  const other=Number(sql('select min(id) from public.partidos where jugador_a_id<>4004 and jugador_b_id<>4004'));
  sql(judge+reject(`select public.asignar_arbitro_partido(${own},'e0040000-0000-0000-0000-000000000003','Auto')`,'23514'));
  sql(judge+`select public.asignar_arbitro_partido(${other},'e0040000-0000-0000-0000-000000000003','Otro encuentro');`);
  const capture=(id,rev=0)=>`select public.capturar_resultado_partido(${id},${rev},'ordinario','[{"a":11,"b":5},{"a":11,"b":5}]','Acta','Reglas',true,'',${rev ? "'Corrección'" : 'null'});`;
  sql(player+capture(other));
  const act=Number(sql(`select id from public.resultados_partidos where partido_id=${other}`));
  sql(player+reject(`select public.confirmar_resultado_partido(${other},${act},1,'No autorizado')`));
  sql(judge+`select public.observar_resultado_partido(${other},${act},1,'Revisar');`);
  sql(admin+`select public.habilitar_arbitraje_023('e0040000-0000-0000-0000-000000000003',false,true);`);
  sql(player+reject(capture(other,1)));
  sql(player+`select public.check004((select count(*)=0 from public.partidos),'RLS retira lectura operativa al revocar');`);
  check(`(select count(*)=1 from public.resultados_partidos where partido_id=${other})`,'Revocación preserva acta');
  sql(admin+`select public.habilitar_arbitraje_023('e0040000-0000-0000-0000-000000000003',true,false);`);
  sql(player+capture(other,1));
  const revised=Number(sql(`select id from public.resultados_partidos where partido_id=${other} and revision=2`));
  sql(judge+`select public.confirmar_resultado_partido(${other},${revised},2,'Revisado');`);
  // Dos cambios administrativos sobre la misma versión: uno gana, otro es obsoleto.
  const change=admin+`select public.habilitar_arbitraje_023('e0040000-0000-0000-0000-000000000003',false,true);`;
  const race=await Promise.allSettled([concurrent(change),concurrent(change)]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  check(`(select count(*)=4 from public.arbitraje_habilitaciones_historial)`,'Auditoría sin duplicados concurrentes');
  sql(legacy+`select public.check004(public.es_arbitro_013(),'Cuenta solo Árbitro');`);
  // Completar clasificación real y preparar una final con las RPC 019/020.
  const last = value => value.split(/\r?\n/).at(-1);
  const matches = JSON.parse(sql(`select json_agg(p order by id) from public.partidos p where id<>${other}`));
  for (const match of matches) {
    sql(judge+`select public.asignar_arbitro_partido(${match.id},'e0040000-0000-0000-0000-000000000005','Completar grupo');`);
    const sets = match.jugador_a_id < match.jugador_b_id ? '[{"a":11,"b":5},{"a":11,"b":5}]' : '[{"a":5,"b":11},{"a":5,"b":11}]';
    const id=Number(last(sql(legacy+`select public.capturar_resultado_partido(${match.id},0,'ordinario','${sets}','Acta','Reglas',true);`)));
    sql(judge+`select public.confirmar_resultado_partido(${match.id},${id},1,'Revisión de grupo');`);
  }
  const group=Number(sql('select id from public.grupos_competencia where competencia_id=4004'));
  const standings=JSON.parse(last(sql(judge+`select public.consultar_clasificacion_grupo(${group});`)));
  const quote = value => "'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
  sql(judge+`select public.aprobar_clasificacion_grupo(${group},${quote(standings.snapshot)},'Clasificación local',true,true);`);
  const proposal={version_regla:19,posiciones:2,clasificados:2,pases_automaticos:0,metodo_distribucion:'final_grupo_unico',clasificaciones:standings.filas.slice(0,2).map((row,i)=>({grupo_id:group,posicion:i+1,jugador_id:row.jugador_id,snapshot:standings.snapshot})),rondas:[]};
  const key=Number(last(sql(judge+`select public.guardar_propuesta_eliminatoria_019(4004,${quote(proposal)},'Propuesta local');`)));
  sql(judge+`select public.confirmar_llave_eliminatoria_019(${key},'Confirmación local',true,true,'Reglas locales','Respaldo local');`);
  // Habilitar de nuevo al finalista: la habilitación nunca permite arbitrar su final.
  sql(admin+`select public.habilitar_arbitraje_023('e0040000-0000-0000-0000-000000000003',true,false);`);
  sql(judge+reject(`select public.preparar_asignar_final_eliminatoria_020(${key},'e0040000-0000-0000-0000-000000000003','Final propia')`,'23514'));
  sql(judge+`select public.preparar_asignar_final_eliminatoria_020(${key},'e0040000-0000-0000-0000-000000000005','Asignar final');`);
  const final=Number(sql(`select id from public.eliminatorias_partidos where llave_id=${key}`));
  const operate=(operation,revision=0)=>`select public.operar_eliminatoria_018(${final},'${operation}',${revision},'Acta final',null,'[{"a":11,"b":5},{"a":11,"b":5},{"a":11,"b":5}]');`;
  // Cuenta vinculada a otro participante puede arbitrar esta final.
  sql(admin+`select public.habilitar_arbitraje_023('e0040000-0000-0000-0000-000000000004',true,false);select public.habilitar_arbitraje_023('e0040000-0000-0000-0000-000000000005',false,true);`);
  sql(legacy+reject(operate('comenzar')));
  sql(legacy+`select public.check004((select count(*)=0 from public.eliminatorias_partidos),'RLS retira lectura eliminatoria al revocar');`);
  const assignmentRace=await Promise.allSettled([
    concurrent(judge+`select public.operar_eliminatoria_018(${final},'asignar',0,'Reasignación por revocación','e0040000-0000-0000-0000-000000000004');`),
    concurrent(judge+`select public.operar_eliminatoria_018(${final},'asignar',0,'Autoarbitraje concurrente','e0040000-0000-0000-0000-000000000003');`),
  ]);
  assert.equal(assignmentRace.filter(result=>result.status==='fulfilled').length,1);
  check(`(select arbitro_id='e0040000-0000-0000-0000-000000000004' from public.eliminatorias_partidos where id=${final})`,'Asignación concurrente consistente');
  sql(session(4)+operate('comenzar'));
  // Cambio supervisado de vínculo: el árbitro ahora es participante. Bloquear acto.
  sql(admin+`update public.jugadores set perfil_id=null where perfil_id='e0040000-0000-0000-0000-000000000004';update public.jugadores set perfil_id='e0040000-0000-0000-0000-000000000004' where id=4005;`);
  sql(session(4)+reject(operate('enviar'),'23514'));
  sql(admin+`select public.habilitar_arbitraje_023('e0040000-0000-0000-0000-000000000005',true,false);`);
  sql(judge+`select public.operar_eliminatoria_018(${final},'asignar',0,'Reasignación por identidad participante','e0040000-0000-0000-0000-000000000005');`);
  sql(legacy+operate('enviar'));
  sql(judge+operate('observar',1));
  sql(legacy+operate('enviar',1));
  const confirmations=await Promise.allSettled([concurrent(judge+operate('confirmar',2)),concurrent(judge+operate('confirmar',2))]);
  assert.equal(confirmations.filter(r=>r.status==='fulfilled').length,2);
  check(`(select estado='finalizado' from public.eliminatorias_cuadros where llave_id=${key})`,'Final y campeón');
  check(`(select count(*)=1 from public.eliminatorias_eventos where partido_id=${final} and evento='confirmado')`,'Confirmación idempotente');
  // Otra competencia de la misma jornada: inscribirse en 4004 no excluye arbitrar 4005.
  sql(`insert into public.jugadores(id,nombre_completo,fecha_nacimiento) overriding system value select id,'Fixture '||id,'2000-01-01'::date from generate_series(4009,4012) id;`);
  sql(judge+`insert into public.habilitaciones_jugador_categoria(jugador_id,categoria_temporada_id,estado,motivo,referencia_evidencia) select id,4005,'habilitado','Fixture','Fixture' from generate_series(4009,4012) id;
    select public.confirmar_participantes_competencia(4005,array[4005,4006,4007,4008,4009,4010,4011,4012],'manual','Fixture');
    select public.guardar_grupos_competencia(4005,'[{"numero":1,"jugador_ids":[4005,4006,4007,4008]},{"numero":2,"jugador_ids":[4009,4010,4011,4012]}]','Fixture');
    select public.confirmar_grupos_competencia(4005,'Fixture');select public.generar_partidos_grupos(4005,true,'Liga');select public.confirmar_partidos_grupos(4005,(select id from public.lotes_partidos_grupos where competencia_id=4005),'Liga');`);
  const secondMatches=JSON.parse(sql(`select json_agg(p order by id) from public.partidos p where competencia_id=4005`));
  // Dos mesas independientes no deben quedar detrás del antiguo bloqueo global 2026023.
  sql(admin+`update public.jugadores set perfil_id=null where perfil_id in('e0040000-0000-0000-0000-000000000004','e0040000-0000-0000-0000-000000000005');select public.habilitar_arbitraje_023('e0040000-0000-0000-0000-000000000004',true,true);`);
  const independentA=secondMatches[0], independentB=secondMatches[1];
  sql(judge+`select public.asignar_arbitro_partido(${independentA.id},'e0040000-0000-0000-0000-000000000004','Mesa independiente A');
    select public.asignar_arbitro_partido(${independentB.id},'e0040000-0000-0000-0000-000000000005','Mesa independiente B');`);
  const holder=concurrent(`begin;select pg_advisory_xact_lock(2026023,1);select pg_sleep(1);rollback;`);
  await new Promise(resolve=>setTimeout(resolve,120));
  const independent=Promise.all([
    concurrent(session(4)+`select 1;`),
    concurrent(legacy+`select 1;`),
  ]);
  const finished=await Promise.race([independent.then(()=>"independent"),new Promise(resolve=>setTimeout(()=>resolve("blocked"),700))]);
  assert.equal(finished,"independent","Partidos independientes no dependen del bloqueo global 2026023");
  await independent;
  await holder;
  for(const match of secondMatches) {
    if(Number(last(sql(`select count(*) from public.resultados_partidos where partido_id=${match.id}`)))>0) continue;
    sql(judge+`select public.asignar_arbitro_partido(${match.id},'e0040000-0000-0000-0000-000000000004','Otra competencia');`);
    const scores=match.jugador_a_id<match.jugador_b_id?'[{"a":11,"b":5},{"a":11,"b":5}]':'[{"a":5,"b":11},{"a":5,"b":11}]';
    const actId=Number(last(sql(session(4)+`select public.capturar_resultado_partido(${match.id},0,'ordinario','${scores}','Acta','Reglas',true);`)));
    sql(judge+`select public.confirmar_resultado_partido(${match.id},${actId},1,'Revisión');`);
  }
  const secondGroups=JSON.parse(sql('select json_agg(id order by numero) from public.grupos_competencia where competencia_id=4005'));
  const classifications=[];
  for(const id of secondGroups) {
    const current=JSON.parse(last(sql(judge+`select public.consultar_clasificacion_grupo(${id});`)));
    sql(judge+`select public.aprobar_clasificacion_grupo(${id},${quote(current.snapshot)},'Clasificación local',true,true);`);
    classifications.push(JSON.parse(last(sql(judge+`select public.consultar_clasificacion_grupo(${id});`))));
  }
  const engine=new Module(path.join(root,'src/lib/eliminatorias.ts'));
  engine._compile(ts.transpileModule(file('src/lib/eliminatorias.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,path.join(root,'src/lib/eliminatorias.ts'));
  const input=engine.exports.competitionInput('4005',classifications);
  const bracket=engine.exports.persistableProposal(input,engine.exports.proposeBracket(input));
  const secondKey=Number(last(sql(judge+`select public.guardar_propuesta_eliminatoria_017(4005,${quote(bracket)},'Propuesta local');`)));
  sql(judge+`select public.confirmar_llave_eliminatoria_016(${secondKey},'Confirmar local',true,true,'Reglas locales');`);
  // Respaldo documental sintético exclusivo del clúster temporal.
  sql(`insert into public.eliminatorias_respaldos(llave_id,referencia_distribucion,referencia_pases_reencuentros,registrado_por) values(${secondKey},'Fixture','Fixture','e0040000-0000-0000-0000-000000000002');`);
  sql(judge+`select public.iniciar_eliminatoria_018(${secondKey},'Inicio local');`);
  const futureFinal=Number(sql(`select id from public.eliminatorias_partidos where llave_id=${secondKey} and ronda_numero=2`));
  // Simular una asignación histórica anticipada con participantes todavía pendientes.
  // No se otorgan permisos de escritura a clientes para crear este escenario.
  sql(`select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',false);update public.eliminatorias_partidos set arbitro_id='e0040000-0000-0000-0000-000000000003' where id=${futureFinal};`);
  sql(admin+`update public.jugadores set perfil_id=null where perfil_id in('e0040000-0000-0000-0000-000000000003','e0040000-0000-0000-0000-000000000004');update public.jugadores set perfil_id='e0040000-0000-0000-0000-000000000003' where id=4005;`);
  const semis=JSON.parse(sql(`select json_agg(p order by id) from public.eliminatorias_partidos p where llave_id=${secondKey} and ronda_numero=1`));
  for(const match of semis) {
    sql(judge+`select public.operar_eliminatoria_018(${match.id},'asignar',0,'Semifinal','e0040000-0000-0000-0000-000000000005');`);
    sql(legacy+`select public.operar_eliminatoria_018(${match.id},'enviar',0,'Acta semifinal',null,'[{"a":11,"b":5},{"a":11,"b":5}]');`);
    sql(judge+`select public.operar_eliminatoria_018(${match.id},'confirmar',1,'Confirmar semifinal');`);
  }
  check(`exists(select 1 from public.eliminatorias_partidos where id=${futureFinal} and 4005 in(jugador_a_id,jugador_b_id))`,'Ganador propagado a final');
  sql(player+reject(`select public.operar_eliminatoria_018(${futureFinal},'comenzar',0,'Autoarbitraje tras avance')`,'23514'));
  sql(judge+`select public.operar_eliminatoria_018(${futureFinal},'asignar',0,'Reasignación tras avance','e0040000-0000-0000-0000-000000000005');`);
  console.log('023 PostgreSQL temporal: cuentas, RLS/RPC, otra competencia, grupos, final 019/020, semifinales y avance real, autoarbitraje, reasignación, sets, revisión, revocación y concurrencia aprobados.');
} finally {
 if(started) assert.equal(run('pg_ctl',['-D',data,'-m','immediate','-w','stop']).status,0);
 assert.ok(path.resolve(scratch).startsWith(path.resolve(root,'test-results')+path.sep));
 fs.rmSync(scratch,{recursive:true,force:true});
}
