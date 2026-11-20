// Aplica 027 DESPUÉS de terminar torneos y comprobar el ranking 026.
// Cluster temporal local; no lee credenciales ni utiliza Supabase.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const url=new URL('./026_ranking.test.mjs',import.meta.url);
let source=fs.readFileSync(url,'utf8').replaceAll(',import.meta.url',','+JSON.stringify(url.href));
const marker='const temp=new URL';
assert.equal(source.split(marker).length,2);
source=source.replace(marker,String.raw`
before("  console.log('023 PostgreSQL temporal:",String.raw__TICK__
  const historicalSnapshot027=()=>sql("select jsonb_build_array((select jsonb_agg(to_jsonb(p) order by id) from public.partidos p),(select jsonb_agg(to_jsonb(r) order by id) from public.resultados_partidos r),(select jsonb_agg(to_jsonb(e) order by id) from public.resultados_partidos_eventos e),(select jsonb_agg(to_jsonb(p) order by id) from public.eliminatorias_partidos p),(select jsonb_agg(to_jsonb(c) order by llave_id) from public.eliminatorias_cuadros c))");
  const previous027=historicalSnapshot027(),previousRanking027=readRanking();
  sql(file('supabase/migrations/027_mesas_programacion.sql'));
  assert.equal(historicalSnapshot027(),previous027,'027 conserva íntegros partidos, actas, confirmaciones y campeones anteriores');
  assert.deepEqual(readRanking(),previousRanking027,'027 conserva el ranking oficial anterior');
  assert.equal(sql('select count(*) from public.programacion_reservas'),'0');
  console.log('027: migración sobre torneos terminados conserva resultados confirmados, campeones y ranking 026: OK');
__TICK__);
`.replaceAll('__TICK__',String.fromCharCode(96))+marker);
const temp=new URL('../../test-results/runner-historica-027.mjs',import.meta.url);
fs.mkdirSync(new URL('../../test-results/',import.meta.url),{recursive:true});fs.writeFileSync(temp,source);
try{await import(pathToFileURL(fileURLToPath(temp)).href);}finally{fs.unlinkSync(temp);}
