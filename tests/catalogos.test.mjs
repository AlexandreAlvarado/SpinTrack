import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Module from "node:module";
import ts from "typescript";

// Cargar solo las funciones puras sin generar archivos ni conectar a Supabase.
const filename = fileURLToPath(new URL("../src/lib/catalogos.ts", import.meta.url));
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = new Module(filename);
loaded._compile(compiled, filename);
const { isCatalog, validId, validateCatalog, catalogError } = loaded.exports;

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test("solo admite las tres tablas autorizadas, no propiedades heredadas", () => {
  for (const name of ["localidades", "asociaciones", "clubes"]) assert.equal(isCatalog(name), true);
  for (const name of ["perfiles", "jugadores", "__proto__", "constructor", "toString"]) assert.equal(isCatalog(name), false);
});

test("rechaza IDs negativos, decimales, ambiguos y fuera del rango seguro", () => {
  assert.equal(validId("42"), true);
  for (const id of ["", "0", "-1", "1.2", "1e2", " 1", "01", "9007199254740992"]) assert.equal(validId(id), false);
});

test("localidad: recorta extremos, respeta opcionales y no acepta columnas adicionales", () => {
  const result = validateCatalog("localidades", form({ nombre: "  Nombre válido  ", region: " ", pais: "", activo: "true", id: "123", creado_en: "ayer", rol: "administrador" }));
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.payload, { nombre: "Nombre válido", region: null, pais: null, activo: true });
});

test("rechaza blancos, textos largos y estados manipulados sin truncar los datos", () => {
  const result = validateCatalog("localidades", form({ nombre: " \t ", region: "x".repeat(151), pais: "x".repeat(101), activo: "on" }));
  assert.deepEqual(Object.keys(result.errors).sort(), ["activo", "nombre", "pais", "region"]);
  assert.equal(result.values.region.length, 151);
});

test("acepta longitudes máximas de PostgreSQL", () => {
  const result = validateCatalog("localidades", form({ nombre: "x".repeat(150), region: "x".repeat(150), pais: "x".repeat(100), activo: "false" }));
  assert.deepEqual(result.errors, {});
  assert.equal(result.payload.activo, false);
});

test("club conserva localidad y asociación independientes y opcionales", () => {
  const result = validateCatalog("clubes", form({ nombre: "Club", localidad_id: "12", asociacion_id: "34", activo: "false" }));
  assert.deepEqual(result.payload, { nombre: "Club", localidad_id: 12, asociacion_id: 34, activo: false });
  assert.deepEqual(result.errors, {});
  const optional = validateCatalog("clubes", form({ nombre: "Club", localidad_id: "", asociacion_id: "", activo: "true" }));
  assert.equal(optional.payload.localidad_id, null);
  assert.equal(optional.payload.asociacion_id, null);
});

test("asociación no puede escribir columnas de club; detecta relaciones inválidas", () => {
  const association = validateCatalog("asociaciones", form({ nombre: "Asociación", localidad_id: "-1", asociacion_id: "9", activo: "true" }));
  assert.ok(association.errors.localidad_id);
  assert.equal(Object.hasOwn(association.payload, "asociacion_id"), false);
  const club = validateCatalog("clubes", form({ nombre: "Club", localidad_id: "1.2", asociacion_id: "abc", activo: "true" }));
  assert.ok(club.errors.localidad_id);
  assert.ok(club.errors.asociacion_id);
});

test("rechaza archivos en campos de texto", () => {
  const data = form({ nombre: "Club", activo: "true" });
  data.set("nombre", new Blob(["archivo"]), "archivo.txt");
  assert.ok(validateCatalog("clubes", data).errors.nombre);
});

test("traduce errores de FK y RLS sin exponer detalles de la base", () => {
  assert.match(catalogError("23503"), /ya no existe/);
  assert.match(catalogError("42501"), /permisos/);
  assert.match(catalogError("desconocido"), /No se pudo guardar/);
});

function serverHarness(result = { data: { id: 1 }, error: null }, deny = false) {
  const calls = { clients: 0, writes: [], invalidated: [] };
  const mocks = {
    "next/cache": { revalidatePath: path => calls.invalidated.push(path) },
    "@/lib/auth": { requireRole: async role => {
      assert.equal(role, "administrador");
      if (deny) throw new Error("Acceso denegado");
    } },
    "@/lib/supabase/server": { createClient: async () => {
      calls.clients++;
      return { from: table => {
        const builder = {
          insert: payload => { calls.writes.push({ table, payload, operation: "insert" }); return builder; },
          update: payload => { calls.writes.push({ table, payload, operation: "update" }); return builder; },
          eq: () => builder,
          select: () => builder,
          single: async () => result,
          maybeSingle: async () => result,
        };
        return builder;
      } };
    } },
    "@/lib/catalogos": loaded.exports,
  };
  const actionFile = fileURLToPath(new URL("../src/app/panel/administrador/catalogos/actions.ts", import.meta.url));
  const actionModule = new Module(actionFile);
  actionModule.require = name => {
    assert.ok(Object.hasOwn(mocks, name), `Dependencia no simulada: ${name}`);
    return mocks[name];
  };
  actionModule._compile(ts.transpileModule(readFileSync(actionFile, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, actionFile);
  return { actions: actionModule.exports, calls };
}

test("ambas acciones deniegan acceso antes de crear un cliente o escribir", async () => {
  const { actions, calls } = serverHarness(undefined, true);
  await assert.rejects(actions.saveCatalog("clubes", null, {}, form({ nombre: "Nombre", activo: "true" })), /Acceso denegado/);
  await assert.rejects(actions.setCatalogActive("clubes", 1, false), /Acceso denegado/);
  assert.equal(calls.clients, 0);
  assert.equal(calls.writes.length, 0);
});

test("validación del servidor impide escrituras de tablas o campos manipulados", async () => {
  const { actions, calls } = serverHarness();
  assert.ok((await actions.saveCatalog("perfiles", null, {}, form({ nombre: "Nombre", activo: "true" }))).error);
  assert.ok((await actions.saveCatalog("clubes", null, {}, form({ nombre: " ", activo: "true" }))).error);
  assert.equal(calls.writes.length, 0);
  const state = await actions.saveCatalog("clubes", null, {}, form({ nombre: "Nombre", activo: "true", rol: "administrador", id: "123" }));
  assert.ok(state.success);
  assert.deepEqual(calls.writes[0], { table: "clubes", operation: "insert", payload: { nombre: "Nombre", localidad_id: null, asociacion_id: null, activo: true } });
  assert.equal(calls.invalidated.length, 3);
});

test("FK rechazada o actualización sin filas no anuncian éxito", async () => {
  for (const result of [{ data: null, error: { code: "23503" } }, { data: null, error: null }]) {
    const { actions, calls } = serverHarness(result);
    const state = await actions.saveCatalog("clubes", 1, {}, form({ nombre: "Nombre", activo: "true" }));
    assert.ok(state.error);
    assert.equal(state.success, undefined);
    assert.equal(calls.invalidated.length, 0);
  }
});

test("editar club sin selector conserva la asociación existente", async () => {
  const { actions, calls } = serverHarness();
  const state = await actions.saveCatalog("clubes", 1, {}, form({ nombre: "Club editado", localidad_id: "12", activo: "true" }));
  assert.ok(state.success);
  assert.deepEqual(calls.writes[0].payload, { nombre: "Club editado", localidad_id: 12, activo: true });
});

test("desactivar actualiza solo activo; no ejecuta borrado físico", async () => {
  const { actions, calls } = serverHarness();
  assert.ok((await actions.setCatalogActive("asociaciones", 1, false)).success);
  assert.deepEqual(calls.writes, [{ table: "asociaciones", operation: "update", payload: { activo: false } }]);
});
