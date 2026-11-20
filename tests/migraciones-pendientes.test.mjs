import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('030 retirada de migraciones; copia histórica conserva los bloqueos solo como referencia', () => {
  assert.equal(fs.existsSync(new URL('../supabase/migrations/030_resguardo_revision_institucional.sql', import.meta.url)), false);
  const archived = read('supabase/referencias-retiradas/030_resguardo_revision_institucional.sql');
  for (const name of ['resguardo_alta_revision_030', 'resguardo_aceptacion_revision_030', 'ranking_interno_revision_030', 'torneos_internos_revision_030']) assert.ok(archived.includes(name));
  for (const name of fs.readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter(name => /^0(0[1-9]|[12]\d)_/.test(name))) {
    assert.doesNotMatch(read('supabase/migrations/' + name), /create trigger resguardo_(alta|aceptacion)_revision_030/);
  }
});
test('aprobación legal no levanta restricciones independientes de datos personales', () => {
  const legal = read('src/lib/legal.ts');
  assert.match(legal, /LEGAL_REVIEW_PENDING = false/);
  assert.match(legal, /PERSONAL_DATA_REVIEW_PENDING = true/);
  assert.match(read('documentacion/RETIRO_030.md'), /NO ejecutar 031/);
});
test('031 archivada sin formar parte de las migraciones pendientes', () => {
  assert.equal(fs.existsSync(new URL('../supabase/migrations/031_activar_aceptacion_aprobada.sql', import.meta.url)), false);
  assert.match(read('supabase/referencias-retiradas/031_activar_aceptacion_aprobada.sql'), /drop trigger if exists resguardo_alta_revision_030/);
  const pending = fs.readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter(name => /^\d+_.*\.sql$/.test(name) && Number(name.split('_')[0]) > 28);
  assert.deepEqual(pending, ['029_editar_perfil_deportivo.sql']);
});
