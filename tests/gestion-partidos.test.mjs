import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const mod = new Module(filename);
  mod.require = name => { assert.ok(Object.hasOwn(mocks, name), name); return mocks[name]; };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const logic = load('../src/lib/gestion-partidos.ts');
const matches = [{ id: 1, grupo_id: 2, jugador_a_id: 10, jugador_b_id: 20 }, { id: 2, grupo_id: 2, jugador_a_id: 10, jugador_b_id: 30 }];
const result = { id: 5, partido_id: 1, revision: 1, tipo: 'ordinario' };
const assignment = { partido_id: 1, arbitro_id: 'ref', activo: true, arbitro_nombre: 'Ana' };
const summary = (results = [], events = [], observations = [], assignments = []) => logic.matchSummary(matches, results, events, observations, assignments);

test('partidos sin árbitro: conteos persistidos y asignación como siguiente acción', () => {
  assert.deepEqual(summary(), { total: 2, assigned: 0, pending: 2, review: 0, observed: 0, confirmed: 0, complete: false, action: 'Asignar árbitros' });
  assert.equal(summary([], [], [], [{ ...assignment, activo: false }]).assigned, 0);
});
test('con árbitros y resultados pendientes: revisión sin inventar resultados completos', () => {
  const value = summary([], [], [], [assignment, { ...assignment, partido_id: 2 }]);
  assert.equal(value.pending, 2);
  assert.equal(value.action, 'Revisar resultados');
  assert.equal(value.complete, false);
});
test('enviado, observado y confirmación solo de la última revisión', () => {
  assert.equal(summary([result]).review, 1);
  assert.equal(summary([result], [], [{ resultado_id: 5 }]).observed, 1);
  const correction = { ...result, id: 6, revision: 2 };
  const value = summary([correction, result], [{ resultado_id: 5 }], [{ resultado_id: 5 }]);
  assert.equal(value.confirmed, 0);
  assert.equal(value.review, 1);
  assert.equal(value.action, 'Revisar resultados');
});
test('todos confirmados ofrece clasificación; un lote vacío nunca está completo', () => {
  const value = summary([result, { ...result, id: 6, partido_id: 2 }], [{ resultado_id: 5 }, { resultado_id: 6 }]);
  assert.equal(value.confirmed, 2);
  assert.equal(value.complete, true);
  assert.equal(value.action, 'Consultar clasificación');
  assert.equal(logic.matchSummary([], [], [], [], []).complete, false);
});

function render({ results = [], events = [], observations = [], assignments = [] } = {}) {
  const forms = [], cards = [];
  const component = load('../src/components/match-management.tsx', {
    'react/jsx-runtime': jsx,
    react: { useMemo: factory => factory(), useState: initial => [initial, () => {}] },
    'next/link': { default: ({ href, children, ...props }) => jsx.jsx('a', { href, children, ...props }) },
    '@/lib/gestion-partidos': logic,
    './match-results': { ResultCard: props => { cards.push(props); return jsx.jsx('p', { children: 'Sets recibidos' }); } },
    './referee-assignment': { RefereeAssignment: props => { forms.push(props); return jsx.jsx('p', { children: 'Asignación explícita' }); } },
  });
  const html = renderToStaticMarkup(component.MatchManagement({ matches, groups: [{ id: 2, numero: 1 }], players: [{ id: 10, nombre_completo: 'Luz', perfil_id: 'self' }, { id: 20, nombre_completo: 'Sol' }, { id: 30, nombre_completo: 'Paz' }], bestOf: 3, results, events, observations, assignments, referees: [{ id: 'self', nombre_completo: 'Luz' }, { id: 'ref', nombre_completo: 'Ana' }], people: { ref: 'Ana' }, classificationHref: '/clasificacion?temporada=1&fecha=8&competencia=2' }));
  return { html, forms, cards };
}
test('vista agrupada evita autoarbitraje y solo ofrece asignaciones antes del historial', () => {
  const value = render();
  assert.match(value.html, /Grupo 1/);
  for (const form of value.forms) assert.deepEqual(form.referees.map(r => r.id), ['ref']);
  assert.equal(render({ results: [result], assignments: [assignment] }).forms.length, 1);
  assert.match(render({ results: [result] }).html, /Asignación bloqueada/);
});
test('revisión aparece primero, abre detalle y conserva sets e identidades sin duplicar captura', () => {
  const value = render({ results: [{ ...result, partido_id: 2 }], assignments: [assignment] });
  assert.ok(value.html.indexOf('Luz vs. Paz') < value.html.indexOf('Luz vs. Sol'));
  assert.match(value.html, /<details open=""><summary[^>]*>Ver sets/);
  assert.equal(value.cards[0].mode, 'judge');
  assert.deepEqual(value.cards[0].people, { ref: 'Ana' });
  assert.doesNotMatch(value.html, /name="a_0"|name="b_0"/);
});
test('completo muestra una sola acción principal y mantiene el contexto de clasificación', () => {
  const value = render({ results: [result, { ...result, id: 6, partido_id: 2 }], events: [{ resultado_id: 5 }, { resultado_id: 6 }] });
  assert.match(value.html, /Resultados completos/);
  assert.match(value.html, /href="\/clasificacion\?temporada=1&amp;fecha=8&amp;competencia=2"/);
  assert.equal((value.html.match(/class="btn-primary"/g) ?? []).length, 1);
  assert.doesNotMatch(value.html, /Generar borrador/);
});

test('asignación exige Juez y acción explícita; conflictos PostgreSQL no anuncian guardado', async () => {
  const calls = [], invalidated = [];
  let role = 'jugador', error = null;
  const actions = load('../src/app/panel/juez-general/resultados/actions.ts', {
    'next/cache': { revalidatePath: path => invalidated.push(path) },
    '@/lib/auth': { requireProfile: async () => ({ rol: role }) },
    '@/lib/catalogos': load('../src/lib/catalogos.ts'),
    '@/lib/resultados': {},
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async (name, args) => { calls.push({ name, args }); return { error }; } }) },
  });
  const form = new FormData();
  form.set('partido_id', '1'); form.set('arbitro_id', '11111111-1111-4111-8111-111111111111'); form.set('referencia', 'Designación revisada');
  assert.equal(calls.length, 0);
  assert.ok((await actions.assignReferee({}, form)).error);
  assert.equal(calls.length, 0);
  role = 'juez_general';
  for (const code of ['42501', '23514', '55000']) {
    error = { code };
    assert.ok((await actions.assignReferee({}, form)).error);
    assert.equal(invalidated.length, 0);
  }
  error = null;
  assert.ok((await actions.assignReferee({}, form)).success);
  assert.deepEqual(calls.at(-1), { name: 'asignar_arbitro_partido', args: { p_partido_id: 1, p_arbitro_id: form.get('arbitro_id'), p_referencia: 'Designación revisada' } });
  assert.ok(invalidated.includes('/panel/juez-general/partidos'));
  assert.ok(invalidated.includes('/panel/juez-general'));
});
