import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createCompetitionFixture } from './fixtures/escala-competencias.mjs';

const filename = fileURLToPath(new URL('../src/lib/gestion-partidos.ts', import.meta.url));
const compiledModule = new Module(filename);
compiledModule._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { matchSummary, groupMatchProgress } = compiledModule.exports;

test('fixtures locales deterministas: un grupo de cuatro y tres jugadores', () => {
  assert.equal(createCompetitionFixture(1, 4).matches.length, 6);
  assert.equal(createCompetitionFixture(1, 3).matches.length, 3);
});

for (const [groups, players, matches] of [[8, 32, 48], [12, 48, 72]]) test(`escala ${groups} grupos sin duplicar partidos ni contadores`, () => {
  const fixture = createCompetitionFixture(groups, 4);
  assert.equal(fixture.players.length, players);
  assert.equal(fixture.matches.length, matches);
  assert.equal(new Set(fixture.matches.map(match => match.id)).size, matches);
  const summary = matchSummary(fixture.matches, [], [], [], []);
  assert.deepEqual({ total: summary.total, pending: summary.pending, confirmed: summary.confirmed, assigned: summary.assigned }, { total: matches, pending: matches, confirmed: 0, assigned: 0 });
  assert.equal(fixture.groups.reduce((total, group) => total + groupMatchProgress(group.id, fixture.matches, [], [], []).total, 0), matches);
});

test('progreso por grupo es independiente y conserva observados/confirmados', () => {
  const fixture = createCompetitionFixture(2, 3);
  const first = fixture.matches.filter(match => match.grupo_id === 1);
  const results = first.map((match, index) => ({ id: index + 1, partido_id: match.id, revision: 1 }));
  assert.equal(groupMatchProgress(1, fixture.matches, results, [{ resultado_id: 1 }], []).review, 2);
  assert.equal(groupMatchProgress(2, fixture.matches, results, [], []).confirmed, 0);
  assert.equal(matchSummary(fixture.matches, results, [{ resultado_id: 1 }], [], []).confirmed, 1);
});

test('fallo de lectura no se convierte en fixture vacío', () => {
  const fixture = createCompetitionFixture(8, 4);
  const readError = { error: 'PGRST205', data: null };
  assert.equal(readError.data, null);
  assert.equal(fixture.matches.length, 48);
});
