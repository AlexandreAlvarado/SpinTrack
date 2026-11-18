// Reutiliza el escenario deportivo 023 completo, exclusivamente en PostgreSQL temporal.
// Los puntos de control no modifican el runner anterior ni conectan a Supabase.
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const sourceUrl = new URL('./023_habilitacion_arbitraje.test.mjs', import.meta.url);
let source = fs.readFileSync(sourceUrl,'utf8').replaceAll('import.meta.url',JSON.stringify(sourceUrl.href));
function before(marker,code) {
  assert.equal(source.split(marker).length,2,`Punto de control único: ${marker}`);
  source=source.replace(marker,code+'\n'+marker);
}
function after(marker,code) {
  assert.equal(source.split(marker).length,2,`Punto de control único: ${marker}`);
  source=source.replace(marker,marker+'\n'+code);
}
before('  const session = suffix =>',String.raw`
  sql(file('supabase/migrations/025_lectura_torneos_publicos.sql'));
  const readPublic = (id=4004) => {
    const result=sql("set role anon;select set_config('request.jwt.claims','{}',false);select public.consultar_torneos_publicos_025("+id+");");
    const parsed=JSON.parse(result.split(/\r?\n/).at(-1));
    assert.doesNotMatch(JSON.stringify(parsed),/actor_id|perfil_id|autor_id|referencia|snapshot|revision|email|raw_user_meta_data|validado_por/);
    return parsed;
  };
  const baseline=readPublic();
  assert.equal(baseline.detalle.grupos.length,1);
  assert.equal(baseline.detalle.grupos[0].jugadores.length,4);
  assert.equal(baseline.detalle.grupos[0].clasificacion.length,0);
  assert.ok(baseline.detalle.grupos[0].partidos.every(m=>m.estado==='pendiente' && m.sets===null && m.ganador===null));
  assert.equal(readPublic(999999).detalle,null);
  assert.equal(readPublic(4005).detalle.grupos.length,0);
  // Publicación retirada y jornada borrador ocultan incluso accesos directos.
  for(const mutation of [
    "alter table public.competencias disable trigger user;update public.competencias set publicada=false,inscripciones_habilitadas=false where id=4004;",
    "alter table public.fechas disable trigger user;update public.fechas set estado='borrador' where id=(select fecha_id from public.competencias where id=4004);"
  ]) {
    for(const role of ['anon','authenticated']) {
      const result=sql("begin;"+mutation+"select set_config('request.jwt.claims','{\"sub\":\"e0040000-0000-0000-0000-000000000001\"}',true);set local role "+role+";select public.consultar_torneos_publicos_025(4004);rollback;");
      const hidden=JSON.parse(result.split(/\r?\n/).at(-1));
      assert.equal(hidden.detalle,null);assert.ok(!hidden.competencias.some(c=>c.id===4004));
    }
  }
  const publicFinishedJourney=sql("begin;alter table public.fechas disable trigger user;update public.fechas set estado='finalizada' where id=(select fecha_id from public.competencias where id=4004);set local role anon;select public.consultar_torneos_publicos_025(4004);rollback;");
  assert.ok(JSON.parse(publicFinishedJourney.split(/\r?\n/).at(-1)).detalle);
  sql("set role anon;select public.reject004('select * from public.resultados_partidos','42501');select public.reject004('select * from public.eliminatorias_actas','42501');select public.reject004('select * from public.clasificaciones_grupos_aprobaciones','42501');");
  sql("set role anon;select public.reject004('select * from public.perfiles','42501');");
  console.log('025: anónimo, publicación, borradores, jornada finalizada, grupos sin resultados y tablas privadas: OK');
`);
after('  sql(player+capture(other));',String.raw`
  assert.ok(readPublic().detalle.grupos[0].partidos.every(m=>m.estado==='pendiente' && m.sets===null));
`);
before('  const proposal={version_regla:19',String.raw`
  const approved=readPublic();
  assert.equal(approved.detalle.grupos[0].clasificacion.length,4);
  assert.ok(approved.detalle.grupos[0].partidos.every(m=>m.estado==='confirmado'));
  // Una corrección pendiente invalida la clasificación aprobada y no expone el acta nueva.
  const stale=sql("begin;alter table public.resultados_partidos disable trigger user;insert into public.resultados_partidos(partido_id,revision,tipo,sets,mejor_de,sets_a,sets_b,ganador_id,referencia_reglas,referencia,autor_id,motivo_correccion) select partido_id,revision+1,tipo,sets,mejor_de,sets_a,sets_b,ganador_id,referencia_reglas,referencia,autor_id,'Corrección sintética local' from public.resultados_partidos where partido_id="+other+" order by revision desc limit 1;set local role anon;select public.consultar_torneos_publicos_025(4004);rollback;");
  assert.equal(JSON.parse(stale.split(/\r?\n/).at(-1)).detalle.grupos[0].clasificacion.length,0);
`);
before('  // Habilitar de nuevo al finalista:',String.raw`
  const single=readPublic();
  assert.equal(single.detalle.rondas.length,1);assert.equal(single.detalle.rondas[0].nombre,'Final');
  assert.equal(single.detalle.rondas[0].partidos.length,1);
  assert.equal(single.competencias.find(c=>c.id===4004).campeon,null);
`);
after("  sql(legacy+operate('enviar',1));",String.raw`
  const pending=readPublic().detalle.rondas[0].partidos[0];
  assert.equal(pending.estado,'pendiente');assert.equal(pending.sets,null);assert.equal(pending.ganador,null);
`);
before("  console.log('023 PostgreSQL temporal:",String.raw`
  const champion=readPublic();
  assert.ok(champion.competencias.find(c=>c.id===4004).campeon);
  assert.ok(champion.competencias.find(c=>c.id===4004).subcampeon);
  assert.equal(champion.detalle.rondas[0].partidos[0].estado,'confirmado');
  const multi=readPublic(4005);
  assert.equal(multi.detalle.grupos.length,2);assert.equal(multi.detalle.rondas.length,2);
  assert.ok(multi.detalle.rondas[0].partidos.every(m=>m.estado==='confirmado'));
  assert.ok(multi.detalle.rondas[1].partidos[0].a);assert.ok(multi.detalle.rondas[1].partidos[0].b);
  assert.equal(multi.competencias.find(c=>c.id===4005).campeon,null);
  console.log('025: clasificación vigente y obsoleta, final única, marcador pendiente oculto, campeón confirmado, múltiples grupos y avance automático: OK');
`);
const temporary = new URL('../../test-results/runner-public-025.mjs',import.meta.url);
fs.mkdirSync(new URL('../../test-results/',import.meta.url),{recursive:true});
fs.writeFileSync(temporary,source);
try { await import(pathToFileURL(fileURLToPath(temporary)).href); }
finally { fs.unlinkSync(temporary); }
