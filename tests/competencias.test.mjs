import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Module from "node:module";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const loaded = new Module(filename);
  loaded.require = name => { assert.ok(Object.hasOwn(mocks, name), name); return mocks[name]; };
  loaded._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
const catalogs = load("../src/lib/catalogos.ts");
const domain = load("../src/lib/competencias.ts", { "./catalogos": catalogs });
const suggestions = load("../src/lib/preparacion-rapida.ts", { "./preparacion-deportiva": { STAGES: [] } });
const overview = load("../src/components/journey-overview.tsx", {
  "react/jsx-runtime": jsx,
  "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
  "@/lib/competencias": domain,
});
function form(extra = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ categoria_temporada_id: "3", tarifa_clp: "", inscripcion_abre_en: "", inscripcion_cierra_en: "", activo: "true", publicada: "false", inscripciones_habilitadas: "false", ...extra })) result.set(key, value);
  return result;
}
const draft = { id: 5, temporada_id: 1, fecha_id: 2, categoria_temporada_id: 3, tarifa_clp: null, inscripcion_abre_en: null, inscripcion_cierra_en: null, activo: true, publicada: false, inscripciones_habilitadas: false };
const approved = { competencia_id: 5, configuracion_aprobada: true, estado_deportivo: "preparada", inicio_programado: "2026-08-08T16:00:00Z", minimo_participantes: 4 };
const complete = { ...draft, tarifa_clp: 0, publicada: true, inscripcion_abre_en: "2026-08-01T16:00:00Z", inscripcion_cierra_en: "2026-08-06T23:00:00Z" };

test("borrador conserva tarifa y plazos nulos sin inventar valores", () => {
  const result = domain.validateCompetition(form(), false);
  assert.deepEqual(result.errors, {});
  for (const key of ["tarifa_clp", "inscripcion_abre_en", "inscripcion_cierra_en"]) assert.equal(result.payload[key], null);
  assert.equal(result.payload.publicada, false); assert.equal(result.payload.inscripciones_habilitadas, false);
});
test("tarifa permite cero explícito y respeta límites integer PostgreSQL", () => {
  assert.deepEqual(domain.validateCompetition(form({ tarifa_clp: "0", cupo_maximo: "2147483647" }), false).errors, {});
  for (const extra of [{ tarifa_clp: "-1" }, { tarifa_clp: "4.000" }, { tarifa_clp: "1e3" }, { tarifa_clp: "2147483648" }]) assert.ok(Object.keys(domain.validateCompetition(form(extra), false).errors).length);
});
test("el máximo general no se configura ni se envía, incluso si se manipula el formulario", async () => {
  for (const cupo_maximo of ["1", "0", "-1", "99999999999999999999", "texto"]) {
    const result = domain.validateCompetition(form({ cupo_maximo }), false);
    assert.deepEqual(result.errors, {}); assert.equal(Object.hasOwn(result.payload, "cupo_maximo"), false);
  }
  assert.ok(!domain.COMPETITION_COLUMNS.includes("cupo_maximo"));
  const h = harness({ record: { ...draft, cupo_maximo: 1 }, sports: approved });
  assert.ok((await h.save(5, { cupo_maximo: "2" })).success);
  assert.equal(Object.hasOwn(h.calls.writes[0].p, "cupo_maximo"), false);
  assert.doesNotMatch(renderForm(), /name="cupo_maximo"|Cupo máximo opcional/);
});
test("campos inválidos, estados manipulados y archivos no generan payload válido", () => {
  for (const extra of [{ categoria_temporada_id: "-1" }, { categoria_temporada_id: "9007199254740992" }, { activo: "on" }, { publicada: "sí" }, { inscripciones_habilitadas: "on" }, { activo: "false", publicada: "true" }]) assert.ok(Object.keys(domain.validateCompetition(form(extra), false).errors).length);
  const f = form(); f.set("tarifa_clp", new Blob(["0"]), "x.txt");
  assert.ok(domain.validateCompetition(f, false).errors.tarifa_clp);
});
test("UPDATE ignora campos de identidad, auditoría y decisiones deportivas sobrepuestos", () => {
  const result = domain.validateCompetition(form({ temporada_id: "99", fecha_id: "99", categoria_temporada_id: "99", configuracion_aprobada: "true", inicio_programado: "mañana", creado_en: "ayer" }), true);
  assert.deepEqual(result.errors, {});
  for (const key of ["temporada_id", "fecha_id", "categoria_temporada_id", "configuracion_aprobada", "inicio_programado", "creado_en"]) assert.equal(Object.hasOwn(result.payload, key), false);
});
test("America/Santiago convierte verano e invierno con offsets distintos", () => {
  assert.deepEqual(domain.santiagoCandidates("2026-01-15T12:00"), ["2026-01-15T15:00:00.000Z"]);
  assert.deepEqual(domain.santiagoCandidates("2026-07-15T12:00"), ["2026-07-15T16:00:00.000Z"]);
  assert.equal(domain.localDateTime("2026-07-15T16:00:00Z"), "2026-07-15T12:00:00");
  assert.match(domain.displayLeagueTime(null), /Pendiente/);
});
test("rechaza fechas imposibles y hora inexistente por cambio de horario", () => {
  for (const value of ["0000-01-01T12:00", "2026-02-30T12:00", "2026-02-29T12:00", "2026-09-06T00:30", "2026-01-01T25:00", "2026-01-01T12:00Z"]) assert.deepEqual(domain.santiagoCandidates(value), []);
  assert.equal(domain.santiagoCandidates("2028-02-29T12:00").length, 1);
});
test("hora repetida requiere elección explícita y conserva ambas ocurrencias al editar", () => {
  const choices = domain.santiagoCandidates("2026-04-04T23:30");
  assert.deepEqual(choices, ["2026-04-05T02:30:00.000Z", "2026-04-05T03:30:00.000Z"]);
  assert.ok(domain.validateCompetition(form({ inscripcion_abre_en: "2026-04-04T23:30" }), false).errors.inscripcion_abre_en);
  for (const [i, occurrence] of ["primera", "segunda"].entries()) {
    assert.equal(domain.validateCompetition(form({ inscripcion_abre_en: "2026-04-04T23:30", inscripcion_abre_en_ocurrencia: occurrence }), false).payload.inscripcion_abre_en, choices[i]);
    assert.equal(domain.repeatedHourChoice(choices[i]), occurrence);
  }
});
test("conversión independiente de la zona del proceso y preserva segundos/milisegundos", () => {
  const original = process.env.TZ;
  try {
    for (const zone of ["UTC", "Asia/Tokyo", "America/New_York"]) {
      process.env.TZ = zone;
      const iso = "2026-07-15T16:05:12.120Z";
      assert.deepEqual(domain.santiagoCandidates(domain.localDateTime(iso)), [iso]);
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});
test("apertura y cierre opcionales, pero orden estricto cuando ambos existen", () => {
  for (const end of ["2026-08-01T11:00", "2026-08-01T12:00"]) assert.ok(domain.validateCompetition(form({ inscripcion_abre_en: "2026-08-01T12:00", inscripcion_cierra_en: end }), false).errors.inscripcion_cierra_en);
  assert.deepEqual(domain.validateCompetition(form({ inscripcion_cierra_en: "2026-08-01T12:00" }), false).errors, {});
});
test("habilitación exige aprobación, fecha publicada, estado preparada, tarifa y período", () => {
  const date = { estado: "publicada", fecha: "2026-08-08" };
  assert.ok(domain.openingBlockers(draft, { ...date, estado: "borrador" }, null).length >= 5);
  assert.deepEqual(domain.openingBlockers(complete, date, approved), []);
  for (const sports of [{ ...approved, configuracion_aprobada: false }, { ...approved, estado_deportivo: "en_curso" }]) assert.ok(domain.openingBlockers(complete, date, sports).length);
  assert.deepEqual(domain.openingBlockers({ ...complete, cupo_maximo: 1 }, date, approved), []);
  assert.ok(domain.openingBlockers({ ...complete, inscripcion_cierra_en: "2026-08-08T17:00:00Z" }, date, approved).some(x => /inicio/.test(x)));
});

function harness({ deny = false, date = { id: 2, temporada_id: 1, fecha: "2026-08-08", estado: "publicada" }, category = { id: 3, activo: true }, record = draft, sports = null, sportsError = false, writeError = null, absentWrite = false, offline = false } = {}) {
  const calls = { clients: 0, writes: [], filters: [], invalidated: [] };
  const { saveCompetition } = load("../src/app/panel/administrador/competencias/actions.ts", {
    "@/lib/competencias": domain, "@/lib/catalogos": catalogs,
    "@/lib/auth": { requireRole: async role => { assert.equal(role, "administrador"); if (deny) throw new Error("denegado"); } },
    "next/cache": { revalidatePath: path => calls.invalidated.push(path) },
    "@/lib/supabase/server": { createClient: async () => {
      calls.clients++; if (offline) throw new Error("secreto interno");
      return { from: table => {
        assert.ok(["fechas", "categorias_temporada", "competencias", "competencia_control_deportivo"].includes(table));
        let writing = false;
        const finish = async () => writing ? { data: writeError || absentWrite ? null : { id: 5 }, error: writeError } : { data: table === "fechas" ? date : table === "categorias_temporada" ? category : table === "competencias" ? record : sports, error: table === "competencia_control_deportivo" && sportsError ? { code: "42501" } : null };
        const b = { select: () => b, eq: (k, v) => { calls.filters.push([table, k, v]); return b; }, insert: p => { writing = true; calls.writes.push({ table, p, mode: "insert" }); return b; }, update: p => { writing = true; calls.writes.push({ table, p, mode: "update" }); return b; }, single: finish, maybeSingle: finish };
        return b;
      } };
    } },
  });
  return { calls, save: (id = null, extra = {}) => saveCompetition(1, 2, id, {}, form(extra)), raw: saveCompetition };
}
test("cada escritura comprueba Administrador antes de conectar", async () => {
  const h = harness({ deny: true });
  for (const id of [null, 5]) await assert.rejects(h.save(id), /denegado/);
  assert.equal(h.calls.clients, 0);
});
test("identificadores de ámbito y campos inválidos no generan escrituras", async () => {
  const h = harness();
  for (const args of [[0, 2, null], [1, -1, null], [1, 2, -1]]) assert.ok((await h.raw(...args, {}, form())).error);
  assert.ok((await h.save(null, { inscripcion_abre_en: "inválida" })).errors.inscripcion_abre_en);
  assert.equal(h.calls.clients, 0);
});
test("fecha o categoría de otra temporada son rechazadas antes de escribir", async () => {
  for (const options of [{ date: null }, { category: null }]) {
    const h = harness(options); assert.ok((await h.save()).error); assert.equal(h.calls.writes.length, 0);
  }
  const h = harness(); await h.save();
  for (const table of ["fechas", "categorias_temporada"]) assert.ok(h.calls.filters.some(([t, k, v]) => t === table && k === "temporada_id" && v === 1));
});
test("creación de borrador solo escribe competencias y columnas permitidas", async () => {
  const h = harness();
  assert.ok((await h.save(null, { temporada_id: "999", fecha_id: "999", configuracion_aprobada: "true" })).success);
  assert.equal(h.calls.writes.length, 1);
  assert.deepEqual(h.calls.writes[0], { table: "competencias", mode: "insert", p: { categoria_temporada_id: 3, inscripcion_abre_en: null, inscripcion_cierra_en: null, activo: true, publicada: false, inscripciones_habilitadas: false, temporada_id: 1, fecha_id: 2 } });
});
test("rechaza categoría inactiva y no publica ni habilita sin aprobación deportiva", async () => {
  assert.ok((await harness({ category: { id: 3, activo: false } }).save()).error);
  for (const id of [null, 5]) for (const extra of [{ publicada: "true" }, { inscripciones_habilitadas: "true" }]) {
    const h = harness(); assert.ok((await h.save(id, extra)).error); assert.equal(h.calls.writes.length, 0);
  }
});
test("edición usa identidad guardada, filtra temporada/fecha y permite desactivar sin borrar", async () => {
  const h = harness();
  assert.ok((await h.save(5, { categoria_temporada_id: "99", fecha_id: "99", activo: "false" })).success);
  const write = h.calls.writes[0]; assert.equal(write.mode, "update"); assert.equal(write.p.activo, false);
  for (const key of ["temporada_id", "fecha_id", "categoria_temporada_id"]) assert.equal(Object.hasOwn(write.p, key), false);
  assert.ok(h.calls.filters.some(([t, k, v]) => t === "competencias" && k === "fecha_id" && v === 2));
});
test("lectura deportiva fallida no se confunde con ausencia de aprobación", async () => {
  const h = harness({ sportsError: true }); assert.match((await h.save(5)).error, /comprobar la aprobación/); assert.equal(h.calls.writes.length, 0);
});
test("competencia inexistente no se actualiza ni se anuncia éxito", async () => {
  const h = harness({ record: null }); assert.ok((await h.save(5)).error); assert.equal(h.calls.writes.length, 0);
});
test("condiciones publicadas se retiran primero sin cambiarlas en el mismo guardado", async () => {
  const h = harness({ record: { ...draft, publicada: true, tarifa_clp: 4000 }, sports: approved });
  assert.match((await h.save(5, { inscripcion_abre_en: "2026-08-01T12:00" })).error, /Primero guarda/);
  assert.equal(h.calls.writes.length, 0);
  assert.ok((await h.save(5, { tarifa_clp: "5000" })).success);
  assert.equal(Object.hasOwn(h.calls.writes[0].p, "tarifa_clp"), false);
});
test("retirar publicación preserva precisión temporal de PostgreSQL", async () => {
  const timestamp = "2026-08-01T16:00:00.123456+00:00";
  const h = harness({ record: { ...draft, publicada: true, inscripcion_abre_en: timestamp }, sports: approved });
  assert.ok((await h.save(5, { inscripcion_abre_en: "2026-08-01T12:00:00.123" })).success);
  assert.equal(h.calls.writes[0].p.inscripcion_abre_en, timestamp);
});
test("habilitación aprobada válida; rechaza fecha en borrador y cierre posterior", async () => {
  const extra = { publicada: "true", inscripciones_habilitadas: "true", tarifa_clp: "0", inscripcion_abre_en: "2026-08-01T12:00", inscripcion_cierra_en: "2026-08-06T20:00" };
  assert.ok((await harness({ sports: approved, record: { ...draft, tarifa_clp: 0 } }).save(5, extra)).success);
  for (const [options, fields] of [[{ sports: approved, date: { id: 2, fecha: "2026-08-08", estado: "borrador" } }, {}], [{ sports: approved }, { inscripcion_cierra_en: "2026-08-09T12:00" }]]) {
    const h = harness(options); assert.ok((await h.save(5, { ...extra, ...fields })).error); assert.equal(h.calls.writes.length, 0);
  }
});
test("duplicados, integridad, RLS y errores de red se traducen sin filtrar detalles", async () => {
  for (const code of ["23505", "23503", "23514", "42501"]) {
    const h = harness({ writeError: { code, message: "secreto interno" } });
    const state = await h.save(); assert.ok(state.error); assert.equal(state.success, undefined); assert.doesNotMatch(state.error, /secreto interno/); assert.equal(h.calls.invalidated.length, 0);
  }
  assert.ok((await harness({ absentWrite: true }).save()).error);
  assert.doesNotMatch((await harness({ offline: true }).save()).error, /secreto interno/);
});

function renderForm({ record = null, sports = null, state = {}, pending = false, registeredCategoryIds = [], initialCategoryId = null, readOnly = false } = {}) {
  const { CompetitionForm } = load("../src/components/competition-form.tsx", {
    react: { useActionState: () => [state, "/simulada", pending] }, "react/jsx-runtime": jsx,
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "@/lib/competencias": domain, "@/app/panel/administrador/competencias/actions": { saveCompetition: () => {} },
  });
  return renderToStaticMarkup(React.createElement(CompetitionForm, { seasonId: 1, date: { id: 2, fecha: "2026-08-08", estado: "publicada" }, record, sports, readOnly, registeredCategoryIds, initialCategoryId, categories: [{ id: 3, label: "Peneca / Inicial", activo: true }, { id: 4, label: "Inactiva", activo: false }], cancelHref: "/volver" }));
}
test("formulario nuevo muestra pendiente, horario Santiago y opciones protegidas", () => {
  const html = renderForm();
  assert.match(html, /Sin aprobación deportiva/); assert.match(html, /America\/Santiago/);
  assert.match(html, /value="true" disabled=""/); assert.doesNotMatch(html, /value="4"/);
  assert.doesNotMatch(html, /2026-11-07|name="inicio_programado"|name="configuracion_aprobada"/);
});
test("edición no expone identidad editable y bloquea condiciones ya publicadas", () => {
  const html = renderForm({ record: { ...draft, publicada: true }, sports: approved });
  assert.doesNotMatch(html, /name="categoria_temporada_id"|name="fecha_id"|name="temporada_id"/);
  assert.match(html, /readOnly=""/); assert.match(html, /Aprobación deportiva registrada/);
});
test("formulario distingue carga, errores y éxito", () => {
  assert.match(renderForm({ pending: true }), /fieldset disabled=""/);
  assert.match(renderForm({ pending: true }), /Guardando…/);
  assert.match(renderForm({ state: { error: "Error", errors: { tarifa_clp: "Revisa tarifa" } } }), /role="alert"/);
  assert.match(renderForm({ state: { success: "Guardado" } }), /role="status"/);
});

async function renderPage(query = {}, { fail = false, denied = false, rows = {} } = {}) {
  const calls = [];
  const fixtures = {
    temporadas: [{ id: 1, nombre: "Temporada 2026", anio: 2026 }],
    fechas: [{ id: 2, temporada_id: 1, numero: 4, fecha: "2026-08-08", comuna: "La Unión", recinto: "Recinto", estado: "borrador" }, { id: 99, temporada_id: 9, numero: 1, fecha: "2027-01-01", comuna: "Ajena", recinto: "Otro", estado: "publicada" }],
    categorias_temporada: [{ id: 3, temporada_id: 1, categoria_id: 1, nivel_id: 1, codigo: "peneca_inicial", rama: null, activo: true }],
    categorias: [{ id: 1, codigo: "peneca", nombre: "Peneca", activo: true }], niveles: [{ id: 1, codigo: "inicial", nombre: "Inicial", activo: true }], competencias: [], competencia_control_deportivo: [], ...rows,
  };
  const { default: Page } = load("../src/app/panel/administrador/competencias/page.tsx", {
    "react/jsx-runtime": jsx,
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/form": { default: ({ children, ...props }) => React.createElement("form", props, children) },
    "@/components/dashboard-shell": { DashboardShell: ({ children }) => React.createElement("main", null, children) },
    "@/components/admin-navigation": { AdminNavigation: () => null },
    "@/components/competition-form": { CompetitionForm: ({ record, readOnly = false }) => React.createElement("div", { "data-testid": "competition-form", "data-record": record?.id ?? "new", "data-read-only": String(readOnly) }, "Formulario disponible") },
    "@/lib/preparacion-rapida": suggestions,
    "@/lib/catalogos": catalogs, "@/lib/competencias": domain,
    "@/lib/auth": { requireRole: async role => { assert.equal(role, "administrador"); if (denied) throw new Error("denegado"); return { rol: role, nombre: "Administrador" }; } },
    "@/lib/supabase/server": { createClient: async () => ({ from: table => {
      calls.push(table); const filters = []; let start = 0, end = 499;
      const b = { select: () => b, order: () => b, range: (a, z) => { start = a; end = z; return b; }, eq: (k, v) => { filters.push([k, v]); return b; }, then: resolve => resolve({ error: fail ? { code: "42501" } : null, data: (fixtures[table] ?? []).filter(row => filters.every(([k, v]) => row[k] === v)).slice(start, end + 1) }) };
      return b;
    } }) },
  });
  const element = await Page({ searchParams: Promise.resolve(query) });
  return { html: renderToStaticMarkup(element), calls };
}
test("página exige Administrador y selecciona temporada antes de consultar fechas", async () => {
  await assert.rejects(renderPage({}, { denied: true }), /denegado/);
  const result = await renderPage();
  assert.deepEqual(result.calls, ["temporadas"]);
  assert.doesNotMatch(result.html, /data-testid="competition-form"/);
});
test("página filtra fechas por temporada y no ofrece referencias cruzadas", async () => {
  const result = await renderPage({ temporada: "1", fecha: "99" });
  assert.doesNotMatch(result.html, /Ajena|data-testid="competition-form"/);
  assert.match(result.html, /Selecciona una jornada válida/);
  assert.ok(!result.calls.includes("competencias"));
});
test("listado vacío y error de consulta son estados distintos y bloquea formulario en error", async () => {
  const query = { temporada: "1", fecha: "2" };
  const empty = await renderPage(query);
  assert.match(empty.html, /Por crear/); assert.doesNotMatch(empty.html, /data-testid="competition-form"/);
  assert.match(empty.html, /Jornada en borrador: inscripciones bloqueadas/);
  const failed = await renderPage(query, { fail: true });
  assert.match(failed.html, /role="alert"/); assert.doesNotMatch(failed.html, /Todavía no hay competencias|data-testid="competition-form"/);
});
test("listado muestra aprobación solo desde control deportivo y filtra sin mutaciones", async () => {
  const result = await renderPage({ temporada: "1", fecha: "2" }, { rows: { competencias: [draft] } });
  assert.match(result.html, /Pendiente/);
  assert.doesNotMatch(result.html, /Tarifa:|data-testid="competition-form"/);
  const review = await renderPage({ temporada: "1", fecha: "2", revisar: "5" }, { rows: { competencias: [draft] } });
  assert.match(review.html, /data-testid="competition-form"/);
  assert.doesNotMatch(review.html, /Tarifa:|competition-review/);
  const filtered = await renderPage({ temporada: "1", fecha: "2", q: "inexistente" }, { rows: { competencias: [draft] } });
  assert.match(filtered.html, /No hay competencias para estos filtros/);
});

test("plazos se comparan con el día local de la jornada, no con la fecha UTC", () => {
  const date = { fecha: "2026-11-14" };
  const valid = { inscripcion_abre_en: null, inscripcion_cierra_en: "2026-11-15T02:59:59Z" };
  assert.deepEqual(domain.competitionTimingIssues(valid, date, null).errors, {});
  const invalid = domain.competitionTimingIssues({ ...valid, inscripcion_cierra_en: "2026-11-15T03:00:00Z" }, date, null);
  assert.match(invalid.errors.inscripcion_cierra_en, /día de la jornada/);
  assert.ok(domain.competitionTimingIssues({ inscripcion_abre_en: "2026-11-15T03:00:00Z", inscripcion_cierra_en: null }, date, null).errors.inscripcion_abre_en);
});
test("plazos pendientes siguen permitidos; conocidos no superan inicio aunque aún no esté aprobado", () => {
  const date = { fecha: "2026-08-08" };
  assert.deepEqual(domain.competitionTimingIssues(draft, date, null), { errors: {}, sportsIssue: null });
  const sports = { ...approved, configuracion_aprobada: false };
  assert.ok(domain.competitionTimingIssues({ ...draft, inscripcion_abre_en: "2026-08-08T16:01:00Z" }, date, sports).errors.inscripcion_abre_en);
  assert.deepEqual(domain.competitionTimingIssues({ ...draft, inscripcion_cierra_en: sports.inicio_programado }, date, sports).errors, {});
});
test("inicio deportivo pertenece al día de la jornada en Santiago y no se corrige automáticamente", () => {
  const date = { fecha: "2026-11-14" };
  assert.equal(domain.competitionTimingIssues(draft, date, { ...approved, inicio_programado: "2026-11-15T01:00:00Z" }).sportsIssue, null);
  assert.match(domain.competitionTimingIssues(draft, date, { ...approved, inicio_programado: "2026-11-14T01:00:00Z" }).sportsIssue, /Juez General/);
});
test("servidor rechaza plazos posteriores a la jornada antes de cualquier escritura", async () => {
  const h = harness();
  const result = await h.save(null, { inscripcion_abre_en: "2026-08-09T10:00", inscripcion_cierra_en: "2026-08-10T10:00", fecha: "2026-08-20", inicio_programado: "2026-08-20T12:00" });
  assert.ok(result.errors.inscripcion_abre_en); assert.ok(result.errors.inscripcion_cierra_en);
  assert.equal(h.calls.writes.length, 0);
  assert.equal(result.values.inscripcion_abre_en, "2026-08-09T10:00");
});
test("servidor no publica ni habilita un inicio deportivo fuera de la jornada", async () => {
  const sports = { ...approved, inicio_programado: "2026-08-09T16:00:00Z" };
  const h = harness({ sports });
  assert.match((await h.save(5, { publicada: "true" })).error, /día de esta jornada/);
  assert.equal(h.calls.writes.length, 0);
});
test("retirar publicación o desactivar conserva plazos históricos sin introducir nuevos errores", async () => {
  const record = { ...draft, publicada: true, inscripcion_cierra_en: "2026-08-09T16:00:00Z" };
  const h = harness({ record });
  assert.ok((await h.save(5, { inscripcion_cierra_en: "2026-08-09T12:00", activo: "false" })).success);
  assert.equal(h.calls.writes[0].p.inscripcion_cierra_en, record.inscripcion_cierra_en);
  const manipulated = harness({ record: { ...record, publicada: false } });
  assert.ok((await manipulated.save(5, { inscripcion_cierra_en: "2026-08-10T12:00", activo: "false" })).errors.inscripcion_cierra_en);
  assert.equal(manipulated.calls.writes.length, 0);
  const reactivation = harness({ record: { ...record, publicada: false, activo: false } });
  assert.ok((await reactivation.save(5, { inscripcion_cierra_en: "2026-08-09T12:00", activo: "true" })).errors.inscripcion_cierra_en);
});
test("totales se refieren a toda la jornada y distinguen estados no excluyentes", () => {
  const competitions = [draft, { ...complete, id: 6, inscripciones_habilitadas: true }, { ...draft, id: 7, activo: false }];
  assert.deepEqual(domain.journeySummary(competitions, [{ ...approved, competencia_id: 6 }, { ...approved, competencia_id: 999 }]), { configured: 3, active: 2, pending: 1, published: 1, enabled: 1 });
  assert.deepEqual(domain.journeySummary([], []), { configured: 0, active: 0, pending: 0, published: 0, enabled: 0 });
});
test("agrupa inicios iguales por instante, permite distintos y no inventa duración ni conflictos", () => {
  const competitions = [draft, { ...draft, id: 6 }, { ...draft, id: 7 }, { ...draft, id: 8 }, { ...draft, id: 9, activo: false }];
  const controls = [{ ...approved }, { ...approved, competencia_id: 6, inicio_programado: "2026-08-08T12:00:00-04:00" }, { ...approved, competencia_id: 7, inicio_programado: "2026-08-08T18:00:00Z" }];
  const before = JSON.stringify([competitions, controls]);
  const result = domain.journeyStarts(competitions, controls);
  assert.deepEqual(result.groups.map(g => g.competitionIds), [[5, 6], [7]]);
  assert.deepEqual(result.pending, [8]);
  assert.equal(JSON.stringify([competitions, controls]), before);
});
test("formulario evita asociar de nuevo una categoría, incluso si su competencia está inactiva", () => {
  const html = renderForm({ registeredCategoryIds: [3], initialCategoryId: 3 });
  assert.match(html, /Ya asociada \(editar\)/); assert.match(html, /fieldset disabled=""/);
  assert.doesNotMatch(html, /value="3"[^>]*selected=""/);
  const available = renderForm({ initialCategoryId: 3 });
  assert.match(available, /value="3" selected=""/);
});
test("jornada muestra categorías asociadas y por asociar, con inicios en solo lectura", () => {
  const html = renderToStaticMarkup(React.createElement(overview.JourneyOverview, {
    date: { numero: 8, fecha: "2026-11-14", comuna: "Comuna", recinto: "Recinto", estado: "publicada" },
    competitions: [draft, { ...draft, id: 6, categoria_temporada_id: 4 }], controls: [approved, { ...approved, competencia_id: 6 }],
    categories: [{ id: 3, label: "Categoría uno", activo: true }, { id: 4, label: "Categoría dos", activo: true }, { id: 5, label: "Categoría tres", activo: true }], baseHref: "/panel/administrador/competencias?temporada=1&fecha=2",
  }));
  assert.match(html, /Recinto compartido/); assert.match(html, /14-11-2026/);
  assert.match(html, /Sin competencia asociada/); assert.match(html, /categoria=5/);
  assert.match(html, /Mismo inicio: posible simultaneidad, no verificada/);
  assert.match(html, /inicios distintos también pueden solaparse/);
  assert.doesNotMatch(html, /name="inicio_programado"/);
});
test("búsqueda no altera contadores ni cobertura de categorías de la jornada", async () => {
  const query = { temporada: "1", fecha: "2", q: "inexistente" };
  const result = await renderPage(query, { rows: { competencias: [draft, { ...draft, id: 6, categoria_temporada_id: 4 }], categorias_temporada: [{ id: 3, categoria_id: 1, nivel_id: 1, temporada_id: 1, codigo: "peneca_inicial", activo: true }, { id: 4, categoria_id: 1, nivel_id: 1, temporada_id: 1, codigo: "otra", activo: true }] } });
  assert.match(result.html, /2 competencias registradas/);
  assert.doesNotMatch(result.html, /Competencias configuradas<\/dt>|panel-card.*Editar \/ revisar/);
  assert.match(result.html, /No hay competencias para estos filtros/);
});
test("la jornada adicional se carga dinámicamente y no crea registros por categoría", async () => {
  const result = await renderPage({ temporada: "1", fecha: "8" }, { rows: { fechas: [{ id: 2, temporada_id: 1, numero: 7, fecha: "2026-11-07", comuna: "Valdivia", recinto: "Uno", estado: "borrador" }, { id: 8, temporada_id: 1, numero: 8, fecha: "2026-11-14", comuna: "Valdivia", recinto: "Dos", estado: "publicada" }] } });
  assert.match(result.html, /07-11-2026/); assert.match(result.html, /14-11-2026/);
  assert.match(result.html, /Jornada 8 · 14-11-2026 · Valdivia · Dos/);
  assert.doesNotMatch(result.html, /No se establece automáticamente el 7 de noviembre/);
});
test("valor heredado se advierte para revisión sin volver a mostrar un campo de cupo", async () => {
  const result = await renderPage({ temporada: "1", fecha: "2" }, { rows: { competencias: [{ ...draft, cupo_maximo: 1 }] } });
  assert.match(result.html, /Hay valores heredados de máximo general/);
  assert.match(result.html, /#5/);
  assert.doesNotMatch(result.html, /name="cupo_maximo"|Cupo:/);
});


test("vista compacta: cinco columnas, sin tarjetas deportivas ni formulario permanente", async () => {
  const { html } = await renderPage({ temporada: "1", fecha: "2" });
  for (const title of ["Categoría", "Estado administrativo", "Inicio deportivo", "Inscripciones", "Acción"]) assert.ok(html.includes(title), title);
  assert.ok(html.includes('aria-label="Competencias de la jornada"'));
  assert.ok(html.includes("table-fixed"));assert.ok(html.includes("md:table-row"));assert.ok(html.includes("md:hidden"));
  assert.ok(!html.includes("overflow-x-auto"));assert.ok(!html.includes("data-testid=\"competition-form\""));
  for (const text of ["Una jornada, múltiples competencias", "futura simultaneidad", "Competencias configuradas", "Categorías asociadas y por asociar"]) assert.ok(!html.includes(text), text);
});

test("categorías activas se cargan automáticamente; Crear solo para faltantes", async () => {
  const rows = { competencias: [{ ...draft, activo: false }], categorias_temporada: [
    { id: 3, temporada_id: 1, categoria_id: 1, nivel_id: 1, codigo: "asociada", activo: true },
    { id: 4, temporada_id: 1, categoria_id: 1, nivel_id: 1, codigo: "faltante", activo: true },
    { id: 6, temporada_id: 1, categoria_id: 1, nivel_id: 1, codigo: "inactiva", activo: false },
  ] };
  const { html } = await renderPage({ temporada: "1", fecha: "2" }, { rows });
  assert.ok(html.includes("categoria=4"));assert.ok(!html.includes("categoria=3"));assert.ok(!html.includes("categoria=6"));
  assert.ok(html.includes("gestionar=5"));assert.ok(html.includes("gestionar=5"));assert.ok(html.includes("Inactiva"));assert.ok(html.includes("1 categorías por crear"));
  const create = await renderPage({ temporada: "1", fecha: "2", categoria: "4" }, { rows });assert.ok(create.html.includes('data-testid="competition-form"'));
  const existing = await renderPage({ temporada: "1", fecha: "2", categoria: "3" }, { rows });
  assert.ok(!existing.html.includes('data-testid="competition-form"'));assert.ok(existing.html.includes("Categoría asociada a la competencia #5"));assert.ok(!existing.html.includes('role="alert"'));
  const inactive = await renderPage({ temporada: "1", fecha: "2", categoria: "6" }, { rows });assert.ok(inactive.html.includes('role="alert"'));assert.ok(!inactive.html.includes('data-testid="competition-form"'));
});

test("no oculta competencias con categoría inactiva o no disponible", async () => {
  const rows = { competencias: [draft, { ...draft, id: 6, categoria_temporada_id: 99, activo: false }], categorias_temporada: [{ id: 3, temporada_id: 1, categoria_id: 1, nivel_id: 1, activo: false }] };
  const { html } = await renderPage({ temporada: "1", fecha: "2" }, { rows });
  assert.ok(html.includes("gestionar=5"));assert.ok(html.includes("gestionar=6"));assert.ok(html.includes("Categoría #99"));assert.ok(!html.includes("categoria=99"));assert.ok(!html.includes("categoria=3"));
});

test("Crear y Editar abren solo la competencia solicitada; IDs ajenos no abren formulario", async () => {
  for (const query of [{ categoria: "3" }, { editar: "5" }]) {
    const result = await renderPage({ temporada: "1", fecha: "2", ...query }, { rows: { competencias: query.editar ? [draft] : [] } });assert.ok(result.html.includes('data-testid="competition-form"'));
  }
  for (const query of [{ categoria: "999" }, { editar: "999" }, { revisar: "999" }]) {
    const result = await renderPage({ temporada: "1", fecha: "2", ...query });assert.ok(result.html.includes('role="alert"'));assert.ok(!result.html.includes('data-testid="competition-form"'));
  }
});

test("sugerencias oficiales limitadas a su jornada, sin reemplazar inicio guardado", async () => {
  const date = { id: 2, temporada_id: 1, numero: 7, fecha: "2026-11-07", comuna: "Comuna", recinto: "Recinto", estado: "publicada" };
  const rows = { fechas: [date] };
  const suggested = await renderPage({ temporada: "1", fecha: "2" }, { rows });assert.ok(suggested.html.includes("13:00"));assert.ok(suggested.html.includes("Sugerido · sin guardar"));assert.ok(!suggested.html.includes('name="inicio_programado"'));
  const other = await renderPage({ temporada: "1", fecha: "2" }, { rows: { fechas: [{ ...date, fecha: "2026-11-14" }] } });assert.ok(!other.html.includes("Sugerido · sin guardar"));
  const saved = await renderPage({ temporada: "1", fecha: "2" }, { rows: { ...rows, competencias: [draft], competencia_control_deportivo: [{ ...approved, temporada_id: 1, inicio_programado: "2026-11-07T17:15:00Z" }] } });assert.ok(saved.html.includes("14:15"));assert.ok(!saved.html.includes("Sugerido · sin guardar"));
});

test("tabla advierte un inicio deportivo de otro día y conserva acceso a revisión", async () => {
  const { html } = await renderPage({ temporada: "1", fecha: "2" }, { rows: { competencias: [draft], competencia_control_deportivo: [{ ...approved, temporada_id: 1, inicio_programado: "2026-08-09T17:00:00Z" }] } });
  assert.ok(html.includes("Fecha por revisar"));assert.ok(html.includes("gestionar=5"));
});

test("configuración avanzada conserva campos y abre automáticamente errores o condiciones protegidas", () => {
  const compact = renderForm();assert.ok(compact.includes("Configuración avanzada: plazos"));assert.ok(!compact.includes('<details open="">'));
  for (const name of ["inscripcion_abre_en", "inscripcion_cierra_en", "inscripcion_abre_en_ocurrencia", "inscripcion_cierra_en_ocurrencia", "activo", "publicada", "inscripciones_habilitadas"]) assert.ok(compact.includes('name="' + name + '"'), name);
  assert.ok(renderForm({ state: { errors: { inscripcion_abre_en: "Inválida" } } }).includes('<details open="">'));
  assert.ok(renderForm({ record: { ...draft, publicada: true } }).includes('<details open="">'));
});


test("una acción Gestionar y una vista, incluidos enlaces anteriores", async () => {
  const rows = { competencias: [draft] };
  const list = await renderPage({ temporada: "1", fecha: "2" }, { rows });
  assert.equal((list.html.match(/gestionar=5/g) ?? []).length, 1);assert.ok(list.html.includes("Gestionar"));
  assert.ok(!list.html.includes("editar=5"));assert.ok(!list.html.includes("revisar=5"));assert.ok(!list.html.includes("Ver/Revisar"));
  for (const key of ["gestionar", "editar", "revisar"]) {
    const { html } = await renderPage({ temporada: "1", fecha: "2", [key]: "5" }, { rows });
    assert.equal((html.match(/data-testid="competition-form"/g) ?? []).length, 1);assert.ok(html.includes('data-record="5"'));assert.ok(!html.includes('id="competition-review"'));
  }
  const unavailable = await renderPage({ temporada: "1", fecha: "2", gestionar: "5" }, { rows: { competencias: [draft], categorias_temporada: [] } });
  assert.ok(unavailable.html.includes('data-read-only="true"'));
});

test("gestión sin importes, lectura y condiciones publicadas protegidas", () => {
  for (const record of [null, draft, { ...draft, tarifa_clp: 7654321, publicada: true }]) {
    const html = renderForm({ record, sports: approved });assert.ok(!/tarifa|7654321|CLP/.test(html));
  }
  const readonly = renderForm({ record: draft, readOnly: true });assert.ok(readonly.includes("Solo lectura"));assert.ok(readonly.includes('fieldset disabled=""'));assert.ok(!readonly.includes("Guardar competencia"));assert.ok(readonly.includes("Volver al listado"));
});

test("guardar omite valores financieros forjados y conserva el valor heredado", async () => {
  const stored = { ...draft, tarifa_clp: 4321 };
  const h = harness({ record: stored });const result = await h.save(5, { tarifa_clp: "999999" });
  assert.ok(result.success);assert.equal(Object.hasOwn(h.calls.writes[0].p, "tarifa_clp"), false);assert.equal(stored.tarifa_clp, 4321);assert.equal(Object.hasOwn(result.values, "tarifa_clp"), false);
  const created = harness();assert.ok((await created.save(null, { tarifa_clp: "0" })).success);assert.equal(Object.hasOwn(created.calls.writes[0].p, "tarifa_clp"), false);
});

test("dependencia heredada nula bloquea habilitación, sin ceros ficticios ni escrituras", async () => {
  const h = harness({ sports: approved, record: draft });
  const result = await h.save(5, { tarifa_clp: "0", publicada: "true", inscripciones_habilitadas: "true", inscripcion_abre_en: "2026-08-01T12:00", inscripcion_cierra_en: "2026-08-06T20:00" });
  assert.ok(result.error.includes("actualización del esquema"));assert.equal(h.calls.writes.length, 0);
});
