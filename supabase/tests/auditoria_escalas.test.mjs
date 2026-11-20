// Ejecuta RPC reales en el clúster temporal del runner 023, sin Supabase.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const url = new URL('./023_habilitacion_arbitraje.test.mjs', import.meta.url);
for (const groups of [2, 4]) {
  let source = fs.readFileSync(url, 'utf8').replaceAll('import.meta.url', JSON.stringify(url.href));
  // La concurrencia se verifica en 025/026; esta suite comprueba estados,
  // sin el umbral de 700 ms sensible a la carga de una compilación paralela.
  const timingStart = source.indexOf('  const holder=concurrent(');
  const timingEnd = source.indexOf('  await holder;', timingStart);
  assert.ok(timingStart > 0 && timingEnd > timingStart);
  source = source.slice(0, timingStart) + source.slice(timingEnd + '  await holder;'.length);
  const replace = (from, to) => { assert.ok(source.includes(from), from); source = source.replaceAll(from, to); };
  if (groups === 4) {
    replace('generate_series(4009,4012)', 'generate_series(4009,4020)');
    replace('array[4005,4006,4007,4008,4009,4010,4011,4012]', 'array[4005,4006,4007,4008,4009,4010,4011,4012,4013,4014,4015,4016,4017,4018,4019,4020]');
    replace('{"numero":2,"jugador_ids":[4009,4010,4011,4012]}]', '{"numero":2,"jugador_ids":[4009,4010,4011,4012]},{"numero":3,"jugador_ids":[4013,4014,4015,4016]},{"numero":4,"jugador_ids":[4017,4018,4019,4020]}]');
    replace('and ronda_numero=2`)', 'and ronda_numero=2 order by id limit 1`)');
  }
  source = source.replace('y concurrencia aprobados.', 'aprobados (umbral temporal auxiliar omitido).');
  const marker = "  console.log('023 PostgreSQL temporal:";
  assert.equal(source.split(marker).length, 2);
  source = source.replace(marker, String.raw`
  assert.equal(secondMatches.length, GROUPS * 6);
  assert.equal(new Set(secondMatches.map(m => [m.grupo_id, ...[m.jugador_a_id,m.jugador_b_id].sort((a,b)=>a-b)].join(':'))).size, GROUPS * 6);
  assert.equal(bracket.clasificados, GROUPS * 2);
  const rounds = JSON.parse(sql('select json_agg(r order by numero) from public.eliminatorias_rondas r where llave_id='+secondKey));
  assert.deepEqual(rounds.map(r=>r.posiciones), GROUPS === 2 ? [4,2] : [8,4,2]);
  for(const round of rounds) {
    const remaining = JSON.parse(sql("select coalesce(json_agg(p order by id),'[]') from public.eliminatorias_partidos p where llave_id="+secondKey+" and ronda_numero="+round.numero+" and estado<>'confirmado'"));
    for(const match of remaining) {
      assert.ok(match.jugador_a_id && match.jugador_b_id);
      assert.notEqual(match.jugador_a_id,match.jugador_b_id);
      const nextBefore = sql('select coalesce(json_agg(p order by id),\'[]\') from public.eliminatorias_partidos p where llave_id='+secondKey+' and ronda_numero>' +round.numero);
      sql(judge+"select public.operar_eliminatoria_018("+match.id+",'asignar',0,'Auditoria local','e0040000-0000-0000-0000-000000000005');");
      const sets = JSON.stringify(Array.from({length:(match.mejor_de+1)/2},()=>({a:11,b:5})));
      sql(legacy+"select public.operar_eliminatoria_018("+match.id+",'enviar',0,'Auditoria local',null,'"+sets+"');");
      assert.equal(sql('select coalesce(json_agg(p order by id),\'[]\') from public.eliminatorias_partidos p where llave_id='+secondKey+' and ronda_numero>'+round.numero),nextBefore,'Enviar no avanza jugadores');
      sql(judge+"select public.operar_eliminatoria_018("+match.id+",'confirmar',1,'Auditoria local');");
      const snapshot = "select jsonb_build_object('partidos',(select jsonb_agg(p order by id) from public.eliminatorias_partidos p where llave_id="+secondKey+"),'eventos',(select jsonb_agg(e order by id) from public.eliminatorias_eventos e where llave_id="+secondKey+"),'cuadro',(select to_jsonb(c) from public.eliminatorias_cuadros c where llave_id="+secondKey+"))";
      const confirmed = sql(snapshot);
      // La RPC es idempotente para la misma confirmación y revisión.
      sql(judge+"select public.operar_eliminatoria_018("+match.id+",'confirmar',1,'Duplicada');");
      assert.equal(sql(snapshot),confirmed,'Reconfirmar no duplica encuentros, eventos ni avance');
    }
  }
  check('(select count(*)='+ (GROUPS*2-1)+' from public.eliminatorias_partidos where llave_id='+secondKey+')','Sin encuentros duplicados');
  check("(select estado='finalizado' and campeon_id is not null and finalista_id is not null and campeon_id<>finalista_id from public.eliminatorias_cuadros where llave_id="+secondKey+')','Final y campeon confirmados');
  console.log('Auditoria '+(GROUPS*4)+' jugadores: grupos, dos clasificados, rondas, envio sin avance, confirmacion, duplicados y campeon: OK');
`.replaceAll('GROUPS', String(groups)) + marker);
  const temporary = new URL(`../../test-results/runner-auditoria-${groups}.mjs`, import.meta.url);
  fs.mkdirSync(new URL('../../test-results/', import.meta.url), { recursive: true });
  fs.writeFileSync(temporary, source);
  try { await import(pathToFileURL(fileURLToPath(temporary)).href); }
  finally { fs.unlinkSync(temporary); }
}
