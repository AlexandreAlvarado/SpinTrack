import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const roots = ['src', 'documentacion', 'supabase/migrations/013_asignaciones_arbitros_resultados.sql', 'supabase/migrations/014_acceso_lectura_arbitros.sql', 'supabase/migrations/015_clasificacion_grupos.sql'];
const extensions = new Set(['.ts', '.tsx', '.md', '.sql']);
const bad = /[\u00c3\u00c2\ufffd]|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
function collect(entry) {
  const absolute = path.join(root, entry);
  if (fs.statSync(absolute).isFile()) return [absolute];
  const result = [];
  for (const item of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(absolute, item.name);
    if (item.isDirectory()) result.push(...collect(path.relative(root, child)));
    else if (extensions.has(path.extname(item.name))) result.push(child);
  }
  return result;
}
test('textos visibles conservan UTF-8 y no contienen mojibake', () => {
  const failures = [];
  for (const file of roots.flatMap(collect)) {
    const content = fs.readFileSync(file, 'utf8');
    const matches = [...content.matchAll(bad)];
    if (matches.length) failures.push(`${path.relative(root, file)}: ${matches.slice(0, 4).map(m => JSON.stringify(m[0])).join(', ')}`);
  }
  assert.deepEqual(failures, []);
});
