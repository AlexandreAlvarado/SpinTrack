import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Module from 'node:module';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const mod = new Module(filename);
  mod.require = key => { if (key === "@/lib/legal" && !Object.hasOwn(mocks, key)) return { LEGAL_REVIEW_PENDING: false, PERSONAL_DATA_REVIEW_PENDING: false }; assert.ok(Object.hasOwn(mocks, key), key); return mocks[key]; };
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const catalogs = load('../src/lib/catalogos.ts');
const players = load('../src/lib/jugadores.ts', { '@/lib/catalogos': catalogs });
const domain = load('../src/lib/perfil-deportivo.ts', { './jugadores': players, './catalogos': catalogs });
const form = (overrides = {}) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ jugador_id: '1', fecha_nacimiento: '', club_id: '', localidad_procedencia_id: '', esperado: '{"fecha_nacimiento":null,"club_id":null,"localidad_procedencia_id":null}', ...overrides })) data.set(key, value);
  return data;
};
test('datos opcionales; payload explícito ignora identidad y permisos manipulados', () => {
  assert.deepEqual(domain.validateSportsProfile(form({ rol: 'administrador', perfil_id: 'otro', arbitraje_habilitado: 'true', activo: 'true' })), {
    p_jugador_id: 1, p_fecha_nacimiento: null, p_club_id: null, p_localidad_id: null,
    p_esperado: { fecha_nacimiento: null, club_id: null, localidad_procedencia_id: null },
  });
});
for (const invalid of [{ jugador_id: '-1' }, { club_id: '9007199254740992' }, { localidad_procedencia_id: 'x' }, { fecha_nacimiento: '2025-02-29' }, { fecha_nacimiento: '2999-01-01' }, { esperado: 'null' }, { esperado: '[' }]) {
  test(`rechaza datos inválidos ${JSON.stringify(invalid)}`, () => assert.equal(domain.validateSportsProfile(form(invalid)), null));
}
function actions({ denied = false, error = null, legal = { PERSONAL_DATA_REVIEW_PENDING: false } } = {}) {
  const calls = [];
  const action = load('../src/app/panel/jugador/perfil/actions.ts', {
    'next/navigation': { redirect: path => { throw Error(path); } },
    'next/cache': { revalidatePath: path => calls.push(path) },
    '@/lib/auth': { requireProfile: async () => { if (denied) throw Error('sin sesión'); return { id: 'own' }; } },
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async (name, payload) => { calls.push({ name, payload }); return { error }; } }) },
    '@/lib/perfil-deportivo': domain,
    '@/lib/legal': legal,
  });
  return { action, calls };
}
test('edición autorizada usa RPC autenticada y refresca ambas vistas', async () => {
  const { action, calls } = actions();
  await assert.rejects(() => action.saveSportsProfile(form()), { message: '/panel/jugador/perfil?ok=1' });
  assert.equal(calls[0].name, 'editar_mi_perfil_deportivo_029');
  assert.deepEqual(calls.slice(1), ['/panel/jugador', '/panel/jugador/perfil']);
});
test('sin sesión no ejecuta escrituras', async () => {
  const { action, calls } = actions({ denied: true });
  await assert.rejects(() => action.saveSportsProfile(form()), /sin sesión/);
  assert.equal(calls.length, 0);
});

test('configuración real mantiene el veto de autoservicio; no se presenta la RPC 029 como UI habilitada', async () => {
  const legal=load('../src/lib/legal.ts');
  assert.equal(legal.PERSONAL_DATA_REVIEW_PENDING,true);
  const {action,calls}=actions({legal});
  await assert.rejects(()=>action.saveSportsProfile(form()),/error=revision/);
  assert.deepEqual(calls,[]);
});
test('datos inválidos no ejecutan RPC', async () => {
  const { action, calls } = actions();
  await assert.rejects(() => action.saveSportsProfile(form({ club_id: '-1' })), /error=datos/);
  assert.equal(calls.length, 0);
});
test('conflicto concurrente no anuncia éxito', async () => {
  const { action, calls } = actions({ error: { code: '40001' } });
  await assert.rejects(() => action.saveSportsProfile(form()), /error=cambio/);
  assert.equal(calls.length, 1);
});

test('foto esperada completa, tipos y campos exactos; no permite borrar valores previos', () => {
  const snapshot = { fecha_nacimiento: '2000-01-01', club_id: 2, localidad_procedencia_id: 3 };
  const values = { fecha_nacimiento: snapshot.fecha_nacimiento, club_id: '2', localidad_procedencia_id: '3', esperado: JSON.stringify(snapshot) };
  assert.ok(domain.validateSportsProfile(form(values)));
  for (const key of ['fecha_nacimiento', 'club_id', 'localidad_procedencia_id']) assert.equal(domain.validateSportsProfile(form({ ...values, [key]: '' })), null);
  for (const invalid of [{}, { ...snapshot, rol: 'administrador' }, { ...snapshot, club_id: '2' }, { ...snapshot, localidad_procedencia_id: -1 }, { ...snapshot, fecha_nacimiento: 'imposible' }]) {
    assert.equal(domain.validateSportsProfile(form({ ...values, esperado: JSON.stringify(invalid) })), null);
  }
  const missing = form(values); missing.delete('club_id');
  assert.equal(domain.validateSportsProfile(missing), null);
});
test('antecedentes deportivos exigen revisión administrativa y no anuncian éxito', async () => {
  const { action, calls } = actions({ error: { code: '55000' } });
  await assert.rejects(() => action.saveSportsProfile(form()), /error=antecedentes/);
  assert.equal(calls.length, 1);
});

async function render({ linked = true, failed = false, habilitado = false } = {}) {
  const player = { id: 1, perfil_id: 'own', nombre_completo: 'Deportista', activo: true, fecha_nacimiento: null, club_id: 2, localidad_procedencia_id: null };
  const db = { from(table) { const q = {
    select() { return q; }, eq(key, value) { assert.equal(key, 'perfil_id'); assert.equal(value, 'own'); return q; },
    maybeSingle: async () => ({ data: linked ? player : null, error: failed ? {} : null }),
    order() { return q; }, range: async () => ({ data: table === 'clubes' ? [{ id: 2, nombre: 'Club anterior', activo: false }, { id: 3, nombre: 'Club activo', activo: true }, { id: 4, nombre: 'Club oculto', activo: false }] : [], error: null }),
  }; return q; } };
  const page = load('../src/app/panel/jugador/perfil/page.tsx', {
    'react/jsx-runtime': jsx,
    'next/link': { default: ({ children, ...props }) => jsx.jsx('a', { ...props, children }) },
    '@/lib/auth': { requireProfile: async () => ({ id: 'own', nombre: 'Cuenta', arbitrajeHabilitado: habilitado }) },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/components/dashboard-shell': { DashboardShell: ({ children }) => children },
    '@/lib/jugadores': players,
    '@/components/auth-controls': { AuthSubmit: ({ children }) => jsx.jsx('button', { children }) },
    './actions': { saveSportsProfile() {} },
  });
  return renderToStaticMarkup(await page.default({ searchParams: Promise.resolve({}) }));
}
test('perfil vinculado muestra campos opcionales, permiso de solo lectura y catálogo actual inactivo', async () => {
  const html = await render({ habilitado: true });
  for (const name of ['fecha_nacimiento', 'club_id', 'localidad_procedencia_id']) assert.ok(html.includes(`name="${name}"`));
  for (const name of ['rol', 'perfil_id', 'arbitraje_habilitado', 'activo']) assert.ok(!html.includes(`name="${name}"`));
  assert.ok(html.includes('Habilitada'));
  assert.ok(html.includes('Club anterior (inactivo)'));
  assert.ok(html.includes('Club activo'));
  assert.ok(!html.includes('Club oculto'));
  assert.ok(!html.includes('required'));
});
test('cuenta sin ficha pide vinculación administrativa sin crear ni editar fichas', async () => {
  const html = await render({ linked: false });
  assert.ok(html.includes('Solicita la vinculación al Administrador'));
  assert.ok(!html.includes('<form'));
});
test('error de lectura impide presentar un formulario incompleto', async () => {
  const html = await render({ failed: true });
  assert.ok(html.includes('No pudimos comprobar'));
  assert.ok(!html.includes('<form'));
});
