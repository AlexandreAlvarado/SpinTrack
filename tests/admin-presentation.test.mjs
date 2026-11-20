import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Module from "node:module";
import ts from "typescript";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const root = new URL("../src/", import.meta.url);
const base = "/panel/administrador";
const anchor = { default: props => React.createElement("a", props) };
const roles = { ROLE_LABELS: { administrador: "Administrador", juez_general: "Juez General" }, ROLE_PATHS: { administrador: base, juez_general: "/panel/juez-general" } };
function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(path, root));
  const mod = new Module(filename);
  mod.require = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "react/jsx-runtime") return jsx;
    if (name === "next/link") return anchor;
    if (name === "next/form") return { default: props => React.createElement("form", props) };
    if (name.startsWith("@/lib/")) return load(name.slice(2) + ".ts", mocks);
    if (name.startsWith("./")) {
      const url = new URL(name + ".ts", new URL(path, root));
      return load(url.href, mocks);
    }
    assert.fail("Unexpected import: " + name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const routes = [base, base + "/competencias", base + "/jugadores", base + "/arbitraje", base + "/catalogos/clubes", base + "/catalogos/localidades", base + "/temporadas-deportivas", base + "/categorias-niveles", base + "/ranking"];
for (const current of routes) test("menú agrupado, rutas únicas y sección activa: " + current, () => {
  const { AdminNavigation } = load("components/admin-navigation.tsx", { "next/navigation": { usePathname: () => current } });
  const html = renderToStaticMarkup(React.createElement(AdminNavigation));
  for (const label of ["Gestión de la Liga", "Organización", "Configuración", "Clubes", "Localidades", "Reglamentos y categorías", "Categorías y niveles"]) assert.ok(html.includes(label), label);
  const links = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>/g)];
  assert.deepEqual(links.map(item => item[1]).sort(), [...routes].sort());
  assert.equal(links.filter(item => item[0].includes('aria-current="page"')).length, 1);
  assert.ok(links.find(item => item[1] === current)[0].includes('aria-current="page"'));
  if (current.includes("/temporadas-deportivas") || current.includes("/categorias-niveles")) assert.match(html, /<details open="">/);
});

test("shell: título del administrador, menú móvil y distinción con Juez General", () => {
  const { DashboardShell } = load("components/dashboard-shell.tsx", {
    "@/lib/roles": roles,
    "@/components/admin-navigation": { AdminNavigation: () => React.createElement("nav", null, "Gestión administrativa") },
    "@/components/judge-navigation": { JudgeNavigation: () => React.createElement("nav", null, "Mi panel · Dirección deportiva") },
  });
  const admin = renderToStaticMarkup(React.createElement(DashboardShell, { role: "administrador", nombre: "Prueba" }));
  assert.match(admin, /Panel de administración/);assert.match(admin, /Menú del panel/);assert.match(admin, /lg:hidden/);assert.match(admin, /hidden lg:block/);
  assert.ok(!admin.includes("Mi panel"));assert.ok(!admin.includes("Dirección deportiva"));
  const judge = renderToStaticMarkup(React.createElement(DashboardShell, { role: "juez_general", nombre: "Prueba" }));
  assert.match(judge, /Juez General/);assert.match(judge, /Mi panel/);assert.match(judge, /Dirección deportiva/);assert.ok(!judge.includes("Gestión administrativa"));
});

test("una sesión muestra ambos paneles solo con arbitraje habilitado", () => {
  const { DashboardShell } = load("components/dashboard-shell.tsx", {
    "@/lib/roles": { ROLE_LABELS: { jugador: "Jugador" }, ROLE_PATHS: { jugador: "/panel/jugador" } },
    "@/components/admin-navigation": { AdminNavigation: () => null },
    "@/components/judge-navigation": { JudgeNavigation: () => null },
  });
  for (const enabled of [true, false]) {
    const html = renderToStaticMarkup(React.createElement(DashboardShell, { role: "jugador", nombre: "Titular", arbitrajeHabilitado: enabled }));
    assert.equal(html.includes('href="/panel/arbitro/resultados"'), enabled);
    assert.ok(html.includes('href="/panel/jugador"'));
    assert.ok(!html.includes("Cerrar sesión"));
    assert.ok(!html.includes("<form"));
  }
});

const seasons = [{ id: 4, nombre: "Temporada de prueba", anio: 2026 }];
const dates = [
  { id: 8, temporada_id: 4, numero: 1, fecha: "2026-11-07", comuna: "Comuna de prueba", recinto: "Recinto de prueba", estado: "publicada" },
  { id: 9, temporada_id: 4, numero: 2, fecha: "2026-11-14", comuna: "Otra comuna", recinto: "Otro recinto", estado: "borrador" },
];
function harness({ rows = {}, failed = [], deny = false, captureCatalog = false } = {}) {
  const calls = { roles: [], forms: [] };
  const action = kind => async () => { calls.forms.push(kind); };
  const createSeason = action("season"), createEventDate = action("date");
  const mocks = {
    "@/components/player-import": { PlayerImport: () => React.createElement("section", null, "Importador de prueba") },
    "@/lib/auth": { requireRole: async role => { calls.roles.push(role); if (deny) throw Error("denied"); return { rol: role, nombre: "Prueba" }; } },
    "@/lib/supabase/server": { createClient: async () => ({ from: table => {
      const result = { data: rows[table] ?? [], error: failed.includes(table) ? {} : null, count: (rows[table] ?? []).length };
      const query = new Proxy({}, { get: (_target, key) => key === "then" ? resolve => Promise.resolve(resolve(result)) : () => query });return query;
    } }) },
    "@/lib/admin-options": { getCatalogOptions: async () => ({ data: [], error: false }), getProfileOptions: async () => ({ data: [], error: false }) },
    "@/components/dashboard-shell": { DashboardShell: ({ children }) => React.createElement("main", null, children) },
    "@/app/actions": { createSeason, createEventDate },
    "next/navigation": { notFound: () => { throw Error("notFound"); } },
  };
  for (const [module, names] of Object.entries({ "catalog-form": ["CatalogForm", "CatalogStatusButton"], "taxonomy-form": ["TaxonomyFeedback", "TaxonomyForm", "TaxonomyStatusButton"], "player-form": ["PlayerForm", "PlayerStatusButton"], "season-configuration-form": ["SeasonConfigurationForm"], "competition-form": ["CompetitionForm"], "journey-overview": ["JourneyOverview"] })) mocks["@/components/" + module] = Object.fromEntries(names.map(name => [name, () => null]));
  const catalogProps = [];
  if (captureCatalog) mocks["@/components/catalog-form"] = { CatalogForm: props => { catalogProps.push(props); return null; }, CatalogStatusButton: () => null };
  return { calls, mocks, catalogProps, createSeason, createEventDate, page: load("app/panel/administrador/page.tsx", mocks).default };
}
function elements(node, type) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(item => elements(item, type));
  return [...(node.type === type ? [node] : []), ...elements(node.props?.children, type)];
}

test("inicio: resumen real, tabla y gestión contextual, sin formularios ni catálogos repetidos", async () => {
  const h = harness({ rows: { temporadas: seasons, fechas: dates } });
  const tree = await h.page({ searchParams: Promise.resolve({}) });const html = renderToStaticMarkup(tree);
  assert.equal(elements(tree, "form").length, 0);assert.ok(!html.includes("Catálogos administrativos"));
  for (const label of ["Jornadas registradas", "Jornadas publicadas", "Comuna de prueba", "Recinto de prueba", "Publicada", "Borrador", "+ Nueva jornada", "Nueva temporada"]) assert.ok(html.includes(label), label);
  assert.ok(html.includes("competencias?temporada=4&amp;fecha=8"));assert.ok(html.includes("competencias?temporada=4&amp;fecha=9"));
  assert.match(html, /<th scope="col"[^>]*>Comuna/);assert.match(html, /overflow-x-auto/);assert.ok(!html.includes(">Editar jornada<"));
  assert.deepEqual(h.calls.roles, ["administrador"]);
});
for (const [query, action, fields] of [
  [{ crear: "temporada" }, "createSeason", ["nombre", "anio"]],
  [{ crear: "jornada" }, "createEventDate", ["temporada_id", "numero", "fecha", "comuna", "recinto", "estado"]],
  [{ error: "temporada" }, "createSeason", ["nombre", "anio"]],
  [{ error: "fecha" }, "createEventDate", ["temporada_id", "numero", "fecha", "comuna", "recinto", "estado"]],
]) test("formulario bajo demanda y misma operación: " + JSON.stringify(query), async () => {
  const h = harness({ rows: { temporadas: seasons } });const tree = await h.page({ searchParams: Promise.resolve(query) });
  const forms = elements(tree, "form");assert.equal(forms.length, 1);assert.equal(forms[0].props.action, h[action]);
  const controls = [...elements(forms[0], "input"), ...elements(forms[0], "select")];assert.deepEqual(controls.map(item => item.props.name).sort(), fields.sort());
  for (const control of controls.filter(item => item.props.name !== "estado")) assert.equal(control.props.required, true);
  assert.ok(elements(forms[0], anchor.default).some(item => item.props.href === base));
  if (query.error) assert.ok(elements(tree, "p").some(item => item.props.role === "alert"));
});

test("sin temporadas, error de lectura y confirmación de guardado", async () => {
  const empty = harness();const tree = await empty.page({ searchParams: Promise.resolve({ crear: "jornada" }) });
  assert.equal(elements(tree, "form").length, 0);assert.match(renderToStaticMarkup(tree), /Primero debes/);
  const broken = harness({ failed: ["temporadas", "fechas"] });const html = renderToStaticMarkup(await broken.page({ searchParams: Promise.resolve({ crear: "jornada" }) }));
  assert.match(html, /role="alert"/);assert.ok(!html.includes("Aún no hay jornadas"));assert.ok(!html.includes("Guardar jornada"));
  for (const [ok, message] of [["temporada", "Temporada creada correctamente."], ["fecha", "Jornada creada correctamente."]]) {
    const html = renderToStaticMarkup(await empty.page({ searchParams: Promise.resolve({ ok }) }));assert.ok(html.includes(message));assert.match(html, /role="status"/);
  }
});

for (const [route, path, params] of [
  [base, "page.tsx", {}],
  [base + "/competencias", "competencias/page.tsx", {}],
  [base + "/jugadores", "jugadores/page.tsx", {}],
  [base + "/temporadas-deportivas", "temporadas-deportivas/page.tsx", {}],
  [base + "/categorias-niveles", "categorias-niveles/page.tsx", {}],
  ...["clubes", "localidades"].map(catalogo => [base + "/catalogos/" + catalogo, "catalogos/[catalogo]/page.tsx", { catalogo }]),
]) test("ruta administrativa conserva guarda y presentación sin menú repetido: " + route, async () => {
  const h = harness();const Page = load("app/panel/administrador/" + path, h.mocks).default;
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}), params: Promise.resolve(params) }));
  assert.ok(html.includes("<main>"));assert.ok(!html.includes('aria-label="Gestión administrativa"'));assert.deepEqual(h.calls.roles, ["administrador"]);
  const denied = harness({ deny: true });const Guarded = load("app/panel/administrador/" + path, denied.mocks).default;
  await assert.rejects(() => Guarded({ searchParams: Promise.resolve({}), params: Promise.resolve(params) }), /denied/);
});


test("catálogos: clubes y localidades reciben opciones de localidad", async () => {
  const h = harness({ captureCatalog: true });
  const Page = load("app/panel/administrador/catalogos/[catalogo]/page.tsx", h.mocks).default;
  for (const catalogo of ["clubes", "localidades"]) {
    renderToStaticMarkup(await Page({ params: Promise.resolve({ catalogo }), searchParams: Promise.resolve({}) }));
    const props = h.catalogProps.at(-1);
    assert.ok(props);
    assert.ok(Array.isArray(props.localidades));
    assert.equal(Object.hasOwn(props, "asociaciones"), false);
  }
});

for (const scenario of ["season", "date", "invalid-season", "invalid-date", "denied", "write-error"]) test("operaciones originales de creación: " + scenario, async () => {
  const writes = [], invalidated = [];
  const actions = load("app/actions.ts", {
    "next/navigation": { redirect: path => { throw Error(path); } },
    "next/cache": { revalidatePath: path => invalidated.push(path) },
    "@/lib/auth": { requireRole: async role => { assert.equal(role, "administrador"); if (scenario === "denied") throw Error("denied"); } },
    "@/lib/config": {}, "@/lib/auth-flow": {},
    "@/lib/supabase/server": { createClient: async () => ({ from: table => ({ insert: async values => { writes.push({ table, values });return { error: scenario === "write-error" ? {} : null }; } }) }) },
  });
  const isDate = scenario.includes("date");
  const values = isDate ? { temporada_id: "4", numero: "3", fecha: "2026-11-21", comuna: "Comuna de prueba", recinto: "Recinto de prueba", estado: "borrador" } : { nombre: "Temporada de prueba", anio: "2026" };
  if (scenario === "invalid-season") values.nombre = "";
  if (scenario === "invalid-date") values.recinto = "";
  const form = new FormData();for (const [key, value] of Object.entries(values)) form.set(key, value);
  const suffix = isDate ? "fecha" : "temporada";
  const expected = scenario === "denied" ? "denied" : base + "?" + (scenario.startsWith("invalid") || scenario === "write-error" ? "error=" : "ok=") + suffix;
  await assert.rejects(() => (isDate ? actions.createEventDate : actions.createSeason)(form), { message: expected });
  if (scenario.startsWith("invalid") || scenario === "denied") assert.equal(writes.length, 0);
  else {
    assert.deepEqual(writes, [{ table: isDate ? "fechas" : "temporadas", values: isDate ? { ...values, temporada_id: 4, numero: 3 } : { ...values, anio: 2026 } }]);
    if (scenario !== "write-error") assert.ok(invalidated.includes(base));
  }
});

test("jugadores: importación y registro a petición, filtros avanzados y tabla adaptable", async () => {
  const h = harness({ rows: { jugadores: [{ id: 4, nombre_completo: "Persona real verificada", fecha_nacimiento: null, activo: true, perfil_id: null, club_id: null, localidad_procedencia_id: null }] } });
  const Page = load("app/panel/administrador/jugadores/page.tsx", h.mocks).default;
  const PlayerForm = h.mocks["@/components/player-form"].PlayerForm;
  const Import = h.mocks["@/components/player-import"].PlayerImport;
  for (const [query, manual, importing] of [[{},0,0],[{agregar:"si"},1,0],[{importar:"si"},0,1]]) {
    const tree = await Page({ searchParams: Promise.resolve(query) });
    assert.equal(elements(tree, PlayerForm).length, manual);assert.equal(elements(tree, Import).length, importing);
    const html = renderToStaticMarkup(tree);
    assert.match(html,/Importar Excel/);assert.match(html,/Agregar jugador/);assert.match(html,/table-fixed/);
    assert.doesNotMatch(html,/overflow-x-auto/);assert.match(html,/<details[^>]*><summary[^>]*>Filtros avanzados/);
  }
});
