// Reejecuta TODAS las aserciones 025/028/029 con 032 ya instalada.
// Ningún cambio a runners históricos ni conexiones remotas.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const mode = process.argv[2];
const cases = {
  '025': ['025_lectura_publica.test.mjs', "  sql(file('supabase/migrations/025_lectura_torneos_publicos.sql'));", `
  for (const name032 of ['026_ranking_oficial_2026.sql','027_mesas_programacion.sql','028_jornadas_y_aceptacion_legal.sql','029_editar_perfil_deportivo.sql','032_publicacion_deportiva_segura.sql']) sql(file('supabase/migrations/'+name032));
`],
  '028': ['028_jornadas_legal.test.mjs', "  sql(file('supabase/migrations/028_jornadas_y_aceptacion_legal.sql'));", `
  sql(file('supabase/migrations/029_editar_perfil_deportivo.sql'));
  sql(file('supabase/migrations/032_publicacion_deportiva_segura.sql'));
`],
  '029': ['029_perfil_deportivo.test.mjs', "  const uid029=", `  sql(file('supabase/migrations/032_publicacion_deportiva_segura.sql'));
`],
};
assert.ok(Object.hasOwn(cases, mode), 'Usar 025, 028 o 029');
const [filename, marker, insertion] = cases[mode];
const original = new URL('./'+filename, import.meta.url);
let source = fs.readFileSync(original,'utf8')
  .replaceAll(',import.meta.url)', ','+JSON.stringify(original.href)+')')
  .replaceAll(', import.meta.url)', ', '+JSON.stringify(original.href)+')');
assert.equal(source.split(marker).length,2);
source = source.replace(marker, mode==='029' ? insertion+marker : marker+insertion);
// El escenario 029 genera su runner con una URL fija: mantener secuencial.
const runner = fileURLToPath(new URL('../../test-results/032-private-'+mode+'.mjs', import.meta.url));
fs.writeFileSync(runner,source);
try { await import(pathToFileURL(runner).href); } finally { fs.unlinkSync(runner); }
console.log('032: regresión completa '+mode+' aprobada después de instalar 032.');
