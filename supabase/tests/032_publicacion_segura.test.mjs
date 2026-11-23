// Exclusivamente PostgreSQL temporal, loopback y fixtures sintéticos. No lee .env.
// Conserva todas las aserciones históricas 026 y añade la comparación antes/después.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const base = new URL('./026_ranking.test.mjs', import.meta.url);
let source = fs.readFileSync(base, 'utf8').replaceAll(',import.meta.url)', ','+JSON.stringify(base.href)+')');
const marker = 'const temp=new URL(';
assert.equal(source.split(marker).length, 2);
const checks = fs.readFileSync(new URL('./fixtures/032_assertions.mjs.txt', import.meta.url), 'utf8');
source = source.replace(marker, () => 'before("  console.log(\'023 PostgreSQL temporal:", ' + JSON.stringify(checks) + ');\n' + marker);
source = source.replace('runner-ranking-026.mjs', 'runner-ranking-032.mjs');
const runner = fileURLToPath(new URL('../../test-results/032-wrapper.mjs', import.meta.url));
fs.writeFileSync(runner, source);
try { await import(pathToFileURL(runner).href); } finally { fs.unlinkSync(runner); }
