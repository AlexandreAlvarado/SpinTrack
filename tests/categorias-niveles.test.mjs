import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Module from "node:module";
import ts from "typescript";

function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const loaded = new Module(filename);
  loaded.require = name => { assert.ok(Object.hasOwn(mocks, name), `Dependencia no simulada: ${name}`); return mocks[name]; };
  loaded._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return loaded.exports;
}
const domain = load("../src/lib/categorias-niveles.ts");
const catalogs = load("../src/lib/catalogos.ts");
const { TAXONOMIES, isTaxonomy, validateTaxonomy, taxonomyError } = domain;
function form(extra = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ codigo: "peneca", nombre: "Peneca", activo: "true", ...extra })) data.set(key, value);
  return data;
}

test("catálogos limitados a las dos tablas; sin propiedades heredadas", () => {
  assert.equal(isTaxonomy("categorias"), true);
  assert.equal(isTaxonomy("niveles"), true);
  for (const table of ["jugadores", "categorias_temporada", "__proto__", "constructor"]) assert.equal(isTaxonomy(table), false);
});

test("los nueve conceptos permitidos se validan, pero no se insertan automáticamente", () => {
  assert.equal(Object.keys(TAXONOMIES.categorias.codes).length, 5);
  assert.equal(Object.keys(TAXONOMIES.niveles.codes).length, 4);
  for (const table of ["categorias", "niveles"]) {
    for (const [codigo, nombre] of Object.entries(TAXONOMIES[table].codes)) assert.deepEqual(validateTaxonomy(table, false, form({ codigo, nombre })).errors, {});
  }
});

test("rechaza códigos excluidos, ajenos al catálogo, vacíos o heredados", () => {
  for (const codigo of ["dobles", "inicial", "", "PENECA", "constructor", "tc_damas"]) assert.ok(validateTaxonomy("categorias", false, form({ codigo })).errors.codigo);
  assert.ok(validateTaxonomy("niveles", false, form()).errors.codigo);
});

test("nombre obligatorio, máximo 100, sin truncamiento y con exclusión individual", () => {
  for (const nombre of [" \t ", "x".repeat(101), "DOBLES", "Torneo Dobles mixtos"]) assert.ok(validateTaxonomy("categorias", false, form({ nombre })).errors.nombre);
  assert.deepEqual(validateTaxonomy("categorias", false, form({ nombre: "x".repeat(100) })).errors, {});
  assert.equal(validateTaxonomy("categorias", false, form({ nombre: "  Peneca  " })).payload.nombre, "Peneca");
});

test("orden opcional respeta integer PostgreSQL y no admite decimales o negativos", () => {
  for (const order of ["", "0", "1", "2147483647"]) assert.deepEqual(validateTaxonomy("categorias", false, form({ orden_presentacion: order })).errors, {});
  for (const order of ["-1", "1.5", "1e2", "2147483648", "NaN"]) assert.ok(validateTaxonomy("categorias", false, form({ orden_presentacion: order })).errors.orden_presentacion);
  assert.equal(validateTaxonomy("categorias", false, form()).payload.orden_presentacion, null);
});

test("UPDATE excluye código y campos protegidos; niveles excluye orden", () => {
  const result = validateTaxonomy("niveles", true, form({ codigo: "dobles", nombre: "Inicial", id: "1", creado_en: "ayer", orden_presentacion: "5", rol: "administrador" }));
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.payload, { nombre: "Inicial", activo: true });
});

test("estado explícito y archivos rechazados en formulario", () => {
  assert.ok(validateTaxonomy("categorias", false, form({ activo: "on" })).errors.activo);
  const data = form(); data.set("nombre", new Blob(["dato"]), "archivo.txt");
  assert.ok(validateTaxonomy("categorias", false, data).errors.nombre);
});

test("duplicado y fuente referenciada tienen mensajes distintos sin revelar errores crudos", () => {
  assert.match(taxonomyError({ code: "23505" }), /ya está registrado/);
  assert.match(taxonomyError({ code: "23514", message: "Fuente ya referenciada: detalle interno" }), /asociado a una temporada/);
  assert.doesNotMatch(taxonomyError({ code: "23514", message: "Fuente ya referenciada: detalle interno" }), /detalle interno/);
  assert.match(taxonomyError({ code: "23514", message: "otra restricción" }), /restricciones/);
});

function harness({ deny = false, result = { data: { id: 1 }, error: null }, offline = false } = {}) {
  const calls = { clients: 0, writes: [], filters: [], invalidated: [] };
  const actions = load("../src/app/panel/administrador/categorias-niveles/actions.ts", {
    "next/cache": { revalidatePath: path => calls.invalidated.push(path) },
    "@/lib/catalogos": catalogs,
    "@/lib/categorias-niveles": domain,
    "@/lib/auth": { requireRole: async role => { assert.equal(role, "administrador"); if (deny) throw new Error("Acceso denegado"); } },
    "@/lib/supabase/server": { createClient: async () => {
      calls.clients++;
      if (offline) throw new Error("detalle privado");
      return { from: table => {
        assert.ok(["categorias", "niveles"].includes(table));
        const builder = {
          insert: payload => { calls.writes.push({ operation: "insert", table, payload }); return builder; },
          update: payload => { calls.writes.push({ operation: "update", table, payload }); return builder; },
          eq: (key, value) => { calls.filters.push([key, value]); return builder; },
          select: () => builder,
          single: async () => result,
          maybeSingle: async () => result,
        };
        return builder;
      } };
    } },
  });
  return { actions, calls };
}

test("todas las escrituras comprueban Administrador antes de conectar", async () => {
  const { actions, calls } = harness({ deny: true });
  await assert.rejects(actions.saveTaxonomy("categorias", null, {}, form()), /Acceso denegado/);
  await assert.rejects(actions.saveTaxonomy("niveles", 1, {}, form({ nombre: "Inicial" })), /Acceso denegado/);
  await assert.rejects(actions.setTaxonomyActive("categorias", 1, false), /Acceso denegado/);
  assert.equal(calls.clients, 0);
});

test("campos inválidos o tabla manipulada no generan escrituras", async () => {
  const { actions, calls } = harness();
  assert.ok((await actions.saveTaxonomy("perfiles", null, {}, form())).error);
  assert.ok((await actions.saveTaxonomy("categorias", -1, {}, form())).error);
  assert.ok((await actions.saveTaxonomy("categorias", null, {}, form({ codigo: "dobles" }))).error);
  assert.ok((await actions.setTaxonomyActive("niveles", 1, "false")).error);
  assert.equal(calls.clients, 0);
});

test("crear solo escribe columnas permitidas; editar no intenta cambiar código", async () => {
  const { actions, calls } = harness();
  assert.ok((await actions.saveTaxonomy("categorias", null, {}, form({ id: "123" }))).success);
  assert.ok((await actions.saveTaxonomy("niveles", 3, {}, form({ codigo: "dobles", nombre: "Inicial", orden_presentacion: "5" }))).success);
  assert.deepEqual(calls.writes[0], { operation: "insert", table: "categorias", payload: { nombre: "Peneca", codigo: "peneca", orden_presentacion: null, activo: true } });
  assert.deepEqual(calls.writes[1], { operation: "update", table: "niveles", payload: { nombre: "Inicial", activo: true } });
  assert.deepEqual(calls.filters, [["id", 3]]);
});

test("duplicado, bloqueo de temporada y RLS conservan formulario y no anuncian éxito", async () => {
  for (const error of [{ code: "23505" }, { code: "23514", message: "Fuente ya referenciada:" }, { code: "42501" }]) {
    const { actions, calls } = harness({ result: { data: null, error } });
    const state = await actions.saveTaxonomy("categorias", null, {}, form());
    assert.ok(state.error); assert.equal(state.success, undefined);
    assert.equal(state.values.codigo, "peneca"); assert.equal(calls.invalidated.length, 0);
  }
});

test("activación/desactivación es asignación de estado, nunca borrado", async () => {
  const { actions, calls } = harness();
  assert.ok((await actions.setTaxonomyActive("categorias", 1, false)).success);
  assert.ok((await actions.setTaxonomyActive("niveles", 2, true)).success);
  assert.deepEqual(calls.writes.map(item => item.payload), [{ activo: false }, { activo: true }]);
  assert.ok(calls.writes.every(item => item.operation === "update"));
});

test("fila ausente, bloqueo de estado y error de red son fallos explícitos", async () => {
  const absent = harness({ result: { data: null, error: null } });
  assert.ok((await absent.actions.setTaxonomyActive("categorias", 1, false)).error);
  const locked = harness({ result: { data: null, error: { code: "23514", message: "Fuente ya referenciada:" } } });
  assert.match((await locked.actions.setTaxonomyActive("niveles", 1, false)).error, /no pueden|impide/);
  const offline = harness({ offline: true });
  const state = await offline.actions.saveTaxonomy("categorias", null, {}, form());
  assert.ok(state.error); assert.doesNotMatch(state.error, /detalle privado/);
  assert.equal(state.values.nombre, "Peneca");
});
