import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Module from "node:module";
import ts from "typescript";

// Módulos evaluados en memoria: estas pruebas nunca conectan con Supabase.
function load(relativePath, mocks = {}) {
  const filename = fileURLToPath(new URL(relativePath, import.meta.url));
  const loaded = new Module(filename);
  loaded.require = name => {
    assert.ok(Object.hasOwn(mocks, name), `Dependencia no simulada: ${name}`);
    return mocks[name];
  };
  loaded._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return loaded.exports;
}
const catalogs = load("../src/lib/catalogos.ts");
const players = load("../src/lib/jugadores.ts", { "@/lib/catalogos": catalogs });
const { validatePlayer, validBirthDate, todayInChile } = players;
const account = "e0020000-0000-0000-0000-000000000004";
function form(extra = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ nombre_completo: "Nombre de prueba", activo: "true", ...extra })) data.set(key, value);
  return data;
}

test("jugador sin cuenta, nacimiento, localidad ni club es válido", () => {
  const result = validatePlayer(form(), "2026-11-02");
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.payload, { nombre_completo: "Nombre de prueba", fecha_nacimiento: null, localidad_procedencia_id: null, club_id: null, perfil_id: null, activo: true });
});

test("fecha real, años bisiestos y límites del calendario", () => {
  for (const date of ["2016-02-29", "2000-02-29", "2026-11-02", "0001-01-01"]) assert.equal(validBirthDate(date, "2026-11-02"), true, date);
  for (const date of ["2015-02-29", "1900-02-29", "2026-04-31", "2026-00-01", "2026-13-01", "2026-01-00", "0000-01-01", "2026-11-03", "infinity", "02/11/2026", "2026-1-1"]) assert.equal(validBirthDate(date, "2026-11-02"), false, date);
});

test("hoy se calcula en America/Santiago y no según el día UTC", () => {
  assert.equal(todayInChile(new Date("2026-11-03T01:00:00Z")), "2026-11-02");
});

test("no trunca nombres, acepta 160 caracteres y rechaza blancos", () => {
  assert.deepEqual(validatePlayer(form({ nombre_completo: "x".repeat(160) })).errors, {});
  assert.ok(validatePlayer(form({ nombre_completo: "x".repeat(161) })).errors.nombre_completo);
  assert.ok(validatePlayer(form({ nombre_completo: " \t " })).errors.nombre_completo);
  assert.equal(validatePlayer(form({ nombre_completo: "  Ana María  " })).payload.nombre_completo, "Ana María");
});

test("relaciones son independientes; UUID se valida y normaliza", () => {
  const result = validatePlayer(form({ localidad_procedencia_id: "12", club_id: "34", perfil_id: account.toUpperCase(), fecha_nacimiento: "2016-02-29" }));
  assert.deepEqual(result.errors, {});
  assert.equal(result.payload.localidad_procedencia_id, 12);
  assert.equal(result.payload.club_id, 34);
  assert.equal(result.payload.perfil_id, account);
  assert.equal(result.payload.fecha_nacimiento, "2016-02-29");
});

test("rechaza fechas futuras, relaciones manipuladas, UUID inválido y estados ambiguos", () => {
  const result = validatePlayer(form({ fecha_nacimiento: "2026-11-03", localidad_procedencia_id: "-1", club_id: "1.5", perfil_id: "otra-persona", activo: "on" }), "2026-11-02");
  for (const field of ["fecha_nacimiento", "localidad_procedencia_id", "club_id", "perfil_id", "activo"]) assert.ok(result.errors[field], field);
});

test("no acepta columnas de identidad, rol ni condición federativa del cliente", () => {
  const result = validatePlayer(form({ id: "123", creado_en: "ayer", rol: "administrador", federado: "true" }));
  for (const field of ["id", "creado_en", "rol", "federado"]) assert.equal(Object.hasOwn(result.payload, field), false);
});

test("no acepta archivos como campos opcionales", () => {
  const data = form();
  data.set("perfil_id", new Blob(["dato"]), "archivo.txt");
  assert.ok(validatePlayer(data).errors.perfil_id);
});

function harness({ deny = false, result = { data: { id: 1 }, error: null }, offline = false } = {}) {
  const calls = { clients: 0, writes: [], invalidated: [], filters: [] };
  const actions = load("../src/app/panel/administrador/jugadores/actions.ts", {
    "next/cache": { revalidatePath: path => calls.invalidated.push(path) },
    "@/lib/auth": { requireRole: async role => {
      assert.equal(role, "administrador");
      if (deny) throw new Error("Acceso denegado");
    } },
    "@/lib/catalogos": catalogs,
    "@/lib/jugadores": players,
    "@/lib/supabase/server": { createClient: async () => {
      calls.clients++;
      if (offline) throw new Error("detalle interno que no debe exponerse");
      return { from: table => {
        assert.equal(table, "jugadores");
        const builder = {
          insert: payload => { calls.writes.push({ operation: "insert", payload }); return builder; },
          update: payload => { calls.writes.push({ operation: "update", payload }); return builder; },
          eq: (column, value) => { calls.filters.push([column, value]); return builder; },
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

test("crear, editar, vincular y activar requieren Administrador antes de conectar", async () => {
  const { actions, calls } = harness({ deny: true });
  await assert.rejects(actions.savePlayer(null, {}, form()), /Acceso denegado/);
  await assert.rejects(actions.savePlayer(1, {}, form({ perfil_id: account })), /Acceso denegado/);
  await assert.rejects(actions.setPlayerActive(1, false), /Acceso denegado/);
  assert.equal(calls.clients, 0);
  assert.equal(calls.writes.length, 0);
});

test("validaciones del servidor impiden escrituras inválidas", async () => {
  const { actions, calls } = harness();
  assert.ok((await actions.savePlayer(-1, {}, form())).error);
  assert.ok((await actions.savePlayer(null, {}, form({ nombre_completo: " " }))).error);
  assert.ok((await actions.setPlayerActive(1, "false")).error);
  assert.equal(calls.clients, 0);
});

test("homónimos se insertan por separado, sin upsert ni fusión", async () => {
  const { actions, calls } = harness();
  assert.ok((await actions.savePlayer(null, {}, form())).success);
  assert.ok((await actions.savePlayer(null, {}, form())).success);
  assert.deepEqual(calls.writes.map(item => item.operation), ["insert", "insert"]);
  assert.equal(calls.writes[0].payload.perfil_id, null);
});

test("Administrador puede vincular y desvincular; la edición se filtra por ID", async () => {
  const { actions, calls } = harness();
  assert.ok((await actions.savePlayer(7, {}, form({ perfil_id: account }))).success);
  assert.ok((await actions.savePlayer(7, {}, form({ perfil_id: "" }))).success);
  assert.equal(calls.writes[0].payload.perfil_id, account);
  assert.equal(calls.writes[1].payload.perfil_id, null);
  assert.deepEqual(calls.filters, [["id", 7], ["id", 7]]);
});

test("cuenta duplicada, FK inexistente, RLS y registro ausente no anuncian éxito", async () => {
  for (const code of ["23505", "23503", "42501", null]) {
    const { actions, calls } = harness({ result: { data: null, error: code ? { code } : null } });
    const state = await actions.savePlayer(1, {}, form({ perfil_id: account }));
    assert.ok(state.error);
    assert.equal(state.success, undefined);
    assert.equal(state.values.perfil_id, account);
    assert.equal(calls.invalidated.length, 0);
    if (code === "23505") assert.match(state.error, /otro jugador/);
  }
});

test("desactivar actualiza solo activo y conserva cuenta, nacimiento y relaciones", async () => {
  const { actions, calls } = harness();
  assert.ok((await actions.setPlayerActive(7, false)).success);
  assert.deepEqual(calls.writes, [{ operation: "update", payload: { activo: false } }]);
  assert.deepEqual(calls.filters, [["id", 7]]);
  assert.deepEqual(calls.invalidated, [players.PLAYERS_PATH]);
});

test("error de red conserva formulario y no expone detalles internos", async () => {
  const { actions, calls } = harness({ offline: true });
  const state = await actions.savePlayer(null, {}, form());
  assert.ok(state.error);
  assert.doesNotMatch(state.error, /detalle interno/);
  assert.equal(state.values.nombre_completo, "Nombre de prueba");
  assert.equal(calls.invalidated.length, 0);
});
