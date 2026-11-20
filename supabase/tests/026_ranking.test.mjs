// Reutiliza infraestructura y resultados REALES de pruebas locales 001–024.
// No conecta a Supabase; todas las decisiones son fixtures temporales.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const url=new URL('./023_habilitacion_arbitraje.test.mjs',import.meta.url);
let source=fs.readFileSync(url,'utf8').replaceAll('import.meta.url',JSON.stringify(url.href));
function before(marker,code){assert.equal(source.split(marker).length,2);source=source.replace(marker,code+'\n'+marker);}
before('  const session = suffix =>',String.raw`
  sql(file('supabase/migrations/025_lectura_torneos_publicos.sql'));
  sql(file('supabase/migrations/026_ranking_oficial_2026.sql'));
  const readRanking=()=>JSON.parse(sql('set role anon;select public.consultar_ranking_publico_026();').split(/\r?\n/).at(-1));
  assert.deepEqual(readRanking(),[]);
  sql("set role authenticated;select set_config('request.jwt.claims','{\"sub\":\"e0040000-0000-0000-0000-000000000001\"}',false);insert into public.fechas(id,temporada_id,numero,fecha,comuna,recinto,estado) select 5000+i,4004,i,date '2026-01-01'+i,'Prueba','Prueba','publicada' from generate_series(2,8) i;");
`);
before("  check(`(select arbitraje_habilitado",String.raw`
  const official='array[4004,5002,5003,5004,5005,5006,5007]';
  const configure="select public.configurar_ranking_026(4004,4004,"+official+",'Respaldo anual sintético de prueba');";
  sql(player+reject(configure));sql(judge+reject(configure));
  sql(admin+reject("select public.configurar_ranking_026(4004,4004,array[4004,5002,5003,5004,5005,5006,5008],'Jornada ocho no autorizada');",'23514'));
  sql(admin+reject("select public.configurar_ranking_026(4004,4004,array[4004,5002,5003,5004,5005,5006,5006],'Duplicada sintética');",'23514'));
  sql(admin+configure);
  sql(admin+"select public.configurar_ranking_026(4005,4004,"+official+",'Respaldo anual segunda categoría sintética');");
  sql(admin+reject(configure,'23505'));
  sql(admin+reject('update public.ranking_configuraciones_026 set referencia=\'Falsa\'','42501'));
  sql("set role anon;select public.reject004('select * from public.ranking_fuentes_026','42501');select public.reject004('select * from public.ranking_resoluciones_026','42501');select public.reject004('select public.consultar_gestion_ranking_026()','42501');");
  const initialRanking=readRanking();assert.equal(initialRanking.length,2);assert.equal(initialRanking[0].dates.length,7);
  assert.ok(initialRanking.flatMap(s=>s.results).every(r=>r.points===null));
  assert.doesNotMatch(JSON.stringify(initialRanking),/referencia|registrado_por|perfil_id|autoridad|e0040000/);
  sql(judge+reject("select public.resolver_puesto_ranking_026(4004,4004,3,'Juez','Respaldo de prueba','No hay final confirmada');",'23514'));
`);
before("  console.log('023 PostgreSQL temporal:",String.raw`
  const first=readRanking().find(c=>c.id===1);
  assert.equal(first.results.filter(r=>r.points===100).length,1);
  assert.equal(first.results.filter(r=>r.points===97).length,1);
  assert.equal(first.results.filter(r=>r.state==='resolucion_pendiente').length,2,'No clasificados de grupo único sin puestos inventados');
  assert.ok(first.results.every(r=>r.date!==8));
  // Final real de la segunda competencia: ahora los perdedores de semifinal siguen pendientes.
  sql(legacy+"select public.operar_eliminatoria_018("+futureFinal+",'enviar',0,'Acta final sintética',null,'[{\"a\":11,\"b\":5},{\"a\":11,\"b\":5},{\"a\":11,\"b\":5}]');");
  sql(judge+"select public.operar_eliminatoria_018("+futureFinal+",'confirmar',1,'Confirmación final sintética');");
  const second=readRanking().find(c=>c.id===2);
  const semifinalLosers=JSON.parse(sql('select json_agg(perdedor_id) from public.eliminatorias_partidos where llave_id='+secondKey+' and ronda_numero=1'));
  const losers=second.results.filter(r=>r.state==='resolucion_pendiente' && semifinalLosers.includes(r.playerId));assert.equal(losers.length,2);
  const resolve=(player,place)=>"select public.resolver_puesto_ranking_026(4005,"+player+","+place+",'Comisión de Liga sintética','Resolución sintética autorizada','Motivo deportivo sintético');";
  sql(admin+reject(resolve(losers[0].playerId,3)));sql(player+reject(resolve(losers[0].playerId,3)));
  sql(judge+reject(resolve(losers[0].playerId,5),'23514'));
  sql(judge+resolve(losers[0].playerId,3));
  sql(judge+reject(resolve(losers[1].playerId,3),'23505'));
  sql(judge+resolve(losers[1].playerId,4));
  assert.deepEqual(readRanking().find(c=>c.id===2).results.map(r=>r.points).filter(p=>p!==null).sort((a,b)=>b-a),[100,97,95,93]);
  sql(judge+resolve(losers[0].playerId,'null'));
  assert.equal(readRanking().find(c=>c.id===2).results.find(r=>r.playerId===losers[0].playerId).points,null);
  sql(judge+resolve(losers[0].playerId,3));
  assert.equal(sql('select count(*) from public.ranking_resoluciones_026'),'4');
  sql('select public.reject004(\'delete from public.ranking_resoluciones_026\',\'55000\');');
  // Cuadros sintéticos 16/32: misma fuente canónica, todos los encuentros reales
  // de primera ronda. Se revierte cada escenario y nunca se simula un puesto único.
  for(const size of [16,32]) {
    const synthetic=[
      'begin;alter table public.eliminatorias_rondas disable trigger user;',
      'update public.eliminatorias_rondas set posiciones='+size+' where llave_id='+secondKey+' and numero=1;',
      'alter table public.jugadores disable trigger user;',
      'alter table public.eliminatorias_enfrentamientos disable trigger user;',
      "insert into public.jugadores(id,nombre_completo) overriding system value select 10000+i,'Jugador sintético '||i from generate_series(1,"+size+") i;",
      'insert into public.eliminatorias_enfrentamientos(llave_id,ronda_id,numero,jugador_a_id,jugador_b_id,origen_a,origen_b) '+
      "select "+secondKey+",(select id from public.eliminatorias_rondas where llave_id="+secondKey+" and numero=1),i,10000+i*2-1,10000+i*2,'{\"tipo\":\"jugador\"}','{\"tipo\":\"jugador\"}' from generate_series(3,"+(size/2)+") i;",
      'insert into public.eliminatorias_partidos(id,llave_id,ronda_id,numero,ronda_numero,jugador_a_id,jugador_b_id,mejor_de,referencia_reglas,estado,revision,ganador_id,perdedor_id) '+
      "select id,llave_id,ronda_id,numero,1,jugador_a_id,jugador_b_id,3,'Reglas sintéticas','confirmado',1,jugador_a_id,jugador_b_id from public.eliminatorias_enfrentamientos where llave_id="+secondKey+' and numero>=3;',
      'select public.consultar_ranking_publico_026();rollback;'
    ].join('\n');
    const band=JSON.parse(sql(synthetic).split(/\r?\n/).at(-1)).find(c=>c.id===2);
    for(const loser of losers) {
      const row=band.results.find(r=>r.playerId===loser.playerId);
      assert.equal(row.place,null);assert.equal(row.points,size===16?81:78);
    }
    // Con pases (faltan encuentros), no deducir banda a partir del nombre de ronda.
    const incomplete=sql('begin;alter table public.eliminatorias_rondas disable trigger user;update public.eliminatorias_rondas set posiciones='+size+' where llave_id='+secondKey+' and numero=1;select public.consultar_ranking_publico_026();rollback;');
    const pendingBand=JSON.parse(incomplete.split(/\r?\n/).at(-1)).find(c=>c.id===2);
    for(const loser of losers) assert.equal(pendingBand.results.find(r=>r.playerId===loser.playerId).points,null);
  }
  const noScale=sql('begin;alter table public.eliminatorias_rondas disable trigger user;update public.eliminatorias_rondas set posiciones=64 where llave_id='+secondKey+' and numero=1;select public.consultar_ranking_publico_026();rollback;');
  const out=JSON.parse(noScale.split(/\r?\n/).at(-1)).find(c=>c.id===2);
  for(const loser of losers){const row=out.results.find(r=>r.playerId===loser.playerId);assert.equal(row.points,null);assert.equal(row.state,'sin_escala');}
  // Retirar publicación oculta los puntos también a usuarios autenticados.
  const hidden=sql('begin;alter table public.competencias disable trigger user;update public.competencias set publicada=false,inscripciones_habilitadas=false where id=4005;set local role anon;select public.consultar_ranking_publico_026();rollback;');
  assert.equal(JSON.parse(hidden.split(/\r?\n/).at(-1)).find(c=>c.id===2).results.length,0);

  // Auditoria de privacidad: reproduccion local, no inventa autorizaciones.
  const tournamentBeforeAudit=sql('set role anon;select public.consultar_torneos_publicos_025(4004);');
  const rankingBeforeAudit=sql('set role anon;select public.consultar_ranking_publico_026();');
  assert.ok(JSON.parse(rankingBeforeAudit.split(/\r?\n/).at(-1)).flatMap(s=>s.results).some(r=>r.playerId===4004));
  const minorAudit=sql("begin;update public.jugadores set fecha_nacimiento=(current_date-interval '10 years')::date where id=4004;set local role anon;select jsonb_build_object('torneos',public.consultar_torneos_publicos_025(4004),'ranking',public.consultar_ranking_publico_026());rollback;");
  const exposedAudit=JSON.parse(minorAudit.split(/\r?\n/).at(-1));
  assert.deepEqual(exposedAudit.torneos,JSON.parse(tournamentBeforeAudit.split(/\r?\n/).at(-1)));
  assert.deepEqual(exposedAudit.ranking,JSON.parse(rankingBeforeAudit.split(/\r?\n/).at(-1)));
  function auditKeys(value){if(Array.isArray(value))return value.forEach(auditKeys);if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){assert.doesNotMatch(key,/email|password|fecha_nacimiento|perfil_id|usuario_id|raw_user_meta_data|referencia|autoridad|registrado_por/);auditKeys(item);}}
  auditKeys(exposedAudit);
  console.log('Auditoria 025/026: sin columnas privadas; RIESGO reproducido: nacimiento menor no limita nombres ni ranking. Solo datos sinteticos.');
  console.log('026: siete fechas explícitas, exclusión jornada 8, permisos, datos privados, final confirmada, grupo único pendiente, semifinales sin puestos inventados, resolución, revocación e historial: OK');
`);
const temp=new URL('../../test-results/runner-ranking-026.mjs',import.meta.url);
fs.mkdirSync(new URL('../../test-results/',import.meta.url),{recursive:true});fs.writeFileSync(temp,source);
try{await import(pathToFileURL(fileURLToPath(temp)).href);}finally{fs.unlinkSync(temp);}
