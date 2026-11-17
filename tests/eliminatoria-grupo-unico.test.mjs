import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { proposeBracket, persistableProposal, simulatedInput } from './_loader-eliminatorias.mjs';

test('019 conserva una final nueva para el grupo único y no inventa campeón', () => {
  const input = simulatedInput(2);
  const proposal = proposeBracket(input);
  const persisted = persistableProposal(input, proposal);
  assert.equal(proposal.rondas.length, 0);
  assert.equal(persisted.version_regla, 19);
  assert.equal(persisted.clasificados, 2);
  assert.equal(persisted.posiciones, 2);
  assert.equal(persisted.pases_automaticos, 0);
  assert.equal(persisted.rondas.length, 0);
});

test('019 declara sus RPC y no modifica migraciones anteriores', () => {
  const migration = fs.readFileSync(new URL('../supabase/migrations/019_final_grupo_unico.sql', import.meta.url), 'utf8');
  assert.match(migration, /guardar_propuesta_eliminatoria_019/);
  assert.match(migration, /confirmar_llave_eliminatoria_019/);
  assert.match(migration, /version_regla.*19/);
  assert.match(migration, /create or replace function public\.iniciar_eliminatoria_018/);
});
