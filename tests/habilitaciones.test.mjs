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
const playersDomain = load("../src/lib/jugadores.ts", { "@/lib/catalogos": catalogs });
const domain = load("../src/lib/habilitaciones.ts", { "./jugadores": playersDomain });
const player = { id: 7, nombre_completo: "Nombre repetido", fecha_nacimiento: "2010-04-10", localidad_procedencia_id: 1, club_id: 1, perfil_id: null, activo: true };
const category = { id: 3, temporada_id: 1, categoria_id: 1, nivel_id: 1, codigo: "juvenil_inicial", rama: "mixta", criterio_nacimiento: "rango_anios", anio_nacimiento_desde: 2007, anio_nacimiento_hasta: 2010, reglamento_id: 4, activo: true, catalogos_activos: true };
const rule = { id: 4, temporada_id: 1, titulo: "Reglamento", version: "test", estado_revision: "validado", referencia_aprobacion: "Resolución formal de prueba" };
const record = { id: 9, jugador_id: 7, categoria_temporada_id: 3, estado: "pendiente", tipo_resolucion: "ordinaria", motivo: null, referencia_evidencia: null, validado_por: null, validado_en: null, creado_en: "2026-01-01T12:00:00Z" };
const valid = { estado: "habilitado", tipo_resolucion: "ordinaria", motivo: "Antecedentes revisados", referencia_evidencia: "Referencia formal", confirmacion: "revisada" };
const form = (extra = {}) => { const f = new FormData(); for (const [k, v] of Object.entries(extra)) f.set(k, v); return f; };

function harness(options = {}) {
  const calls = { clients: 0, writes: [], reads: [], invalidated: [] };
  const rows = { temporadas: [{ id: 1, nombre: "Temporada de prueba", anio: 2026 }], categorias_temporada: [category], reglamentos_temporada: [rule], categorias: [{ id: 1, nombre: "Juvenil", activo: true }], niveles: [{ id: 1, nombre: "Inicial", activo: true }], jugadores: [player], habilitaciones_jugador_categoria: [], clubes: [{ id: 1, nombre: "Club registrado" }], localidades: [{ id: 1, nombre: "Procedencia registrada" }], ...options.rows };
  const requireRole = async role => { assert.equal(role, "juez_general"); if ((options.role ?? role) !== role) throw new Error("acceso denegado"); return { rol: role, nombre: "Juez" }; };
  const createClient = async () => {
    calls.clients++;
    if (options.offline) throw new Error("detalle privado de conexión");
    return { from(table) {
      assert.ok(Object.hasOwn(rows, table), table);
      let mode = "read", payload, range; const filters = [];
      const query = {
        select() { return query; }, eq(k, v) { filters.push([k, v]); return query; }, is(k, v) { filters.push([k, v]); return query; }, order() { return query; }, range(a, b) { range = [a, b]; return query; },
        insert(v) { mode = "insert"; payload = v; return query; }, update(v) { mode = "update"; payload = v; return query; },
        async run(single = false) {
          const selected = rows[table].filter(r => filters.every(([k, v]) => r[k] === v));
          if (mode !== "read") {
            calls.writes.push({ table, mode, payload, filters });
            if (options.writeError) return { data: null, error: { code: options.writeError, message: "detalle SQL privado" } };
            if (options.absentWrite || (mode === "update" && !selected.length)) return { data: null, error: null };
            const data = { ...(selected[0] ?? record), ...payload, id: 9 };
            data.validado_por = payload.estado === "pendiente" || options.missingAudit ? null : "juez-postgres";
            data.validado_en = payload.estado === "pendiente" || options.missingAudit ? null : "2026-11-03T12:00:00Z";
            return { data, error: null };
          }
          calls.reads.push({ table, filters, range });
          if (options.readError === table) return { data: null, error: { code: "42501" } };
          const result = range ? selected.slice(range[0], range[1] + 1) : selected;
          return { data: single ? result[0] ?? null : result, error: null };
        },
        maybeSingle() { return query.run(true); }, then(ok, fail) { return query.run().then(ok, fail); },
      };
      return query;
    } };
  };
  const actions = load("../src/app/panel/juez-general/habilitaciones/actions.ts", { "next/cache": { revalidatePath: path => calls.invalidated.push(path) }, "@/lib/auth": { requireRole }, "@/lib/supabase/server": { createClient }, "@/lib/catalogos": catalogs, "@/lib/jugadores": playersDomain, "@/lib/habilitaciones": domain });
  return { calls, actions, createClient, requireRole };
}
const save = (h, extra = {}, revision = null) => h.actions.saveHabilitation(1, 3, 7, revision, {}, form({ ...valid, ...extra }));

test("no hay habilitación automática por nombre, cuenta o coincidencia de nacimiento", () => {
  assert.deepEqual(domain.eligibilityIssues(player, category, rule), []);
  assert.ok(domain.validateHabilitation(form({ ...valid, confirmacion: "" })).errors.confirmacion);
  assert.ok(domain.validateHabilitation(form()).errors.estado);
  assert.deepEqual(domain.eligibilityIssues({ ...player, nombre_completo: "Cualquier nombre", perfil_id: "cuenta" }, category, rule), []);
});
test("rango de nacimiento inclusivo y fecha desconocida o fuera de rango", () => {
  for (const fecha_nacimiento of ["2007-01-01", "2010-12-31"]) assert.deepEqual(domain.eligibilityIssues({ ...player, fecha_nacimiento }, category, rule), []);
  for (const fecha_nacimiento of [null, "2006-12-31", "2011-01-01", "2010-02-30"]) assert.ok(domain.eligibilityIssues({ ...player, fecha_nacimiento }, category, rule).some(s => /Nacimiento/.test(s)));
  assert.deepEqual(domain.eligibilityIssues({ ...player, fecha_nacimiento: null }, { ...category, criterio_nacimiento: "sin_limite", anio_nacimiento_desde: null, anio_nacimiento_hasta: null }, rule), []);
});
test("excepción permite revisión de nacimiento, pero no omite requisitos pendientes", () => {
  assert.deepEqual(domain.eligibilityIssues({ ...player, fecha_nacimiento: null }, category, rule, true), []);
  for (const ct of [{ ...category, activo: false }, { ...category, rama: null }, { ...category, criterio_nacimiento: "pendiente" }, { ...category, catalogos_activos: false }]) assert.ok(domain.eligibilityIssues(player, ct, rule, true).length);
  assert.ok(domain.eligibilityIssues(player, category, { ...rule, estado_revision: "pendiente" }, true).length);
  assert.ok(domain.eligibilityIssues({ ...player, activo: false }, category, rule, true).length);
});
test("motivo y evidencia obligatorios para decisiones y excepciones pendientes", () => {
  for (const estado of ["habilitado", "no_habilitado"]) {
    assert.ok(domain.validateHabilitation(form({ ...valid, estado, motivo: " " })).errors.motivo);
    assert.ok(domain.validateHabilitation(form({ ...valid, estado, referencia_evidencia: "" })).errors.referencia_evidencia);
  }
  assert.deepEqual(domain.validateHabilitation(form({ estado: "pendiente", tipo_resolucion: "ordinaria" })).errors, {});
  assert.ok(domain.validateHabilitation(form({ estado: "pendiente", tipo_resolucion: "excepcion_documentada" })).errors.motivo);
  for (const estado of ["aceptada", "rechazada", "__proto__"]) assert.ok(domain.validateHabilitation(form({ ...valid, estado })).errors.estado);
  const f = form(valid); f.set("referencia_evidencia", new Blob(["x"]), "archivo"); assert.ok(domain.validateHabilitation(f).errors.referencia_evidencia);
});
test("Juez registra jugador sin cuenta; payload excluye identidad sobrepuesta y auditoría", async () => {
  const h = harness(); assert.ok((await save(h, { jugador_id: "99", categoria_temporada_id: "99", perfil_id: "falso", rol: "administrador", validado_por: "falso", validado_en: "ayer" })).success);
  const w = h.calls.writes[0]; assert.equal(w.table, "habilitaciones_jugador_categoria"); assert.equal(w.payload.jugador_id, 7); assert.equal(w.payload.categoria_temporada_id, 3);
  for (const key of ["perfil_id", "rol", "validado_por", "validado_en", "creado_en"]) assert.equal(Object.hasOwn(w.payload, key), false);
});
for (const role of ["administrador", "arbitro", "jugador"]) test(`${role} no puede guardar habilitaciones`, async () => {
  const h = harness({ role }); await assert.rejects(() => save(h), /acceso denegado/); assert.equal(h.calls.clients, 0); assert.equal(h.calls.writes.length, 0);
});
test("excepción documentada explícita y revisión manual permiten resolver caso fuera de rango", async () => {
  const ordinary = harness({ rows: { jugadores: [{ ...player, fecha_nacimiento: "2011-01-01" }] } });
  assert.match((await save(ordinary)).error, /fuera del rango/); assert.equal(ordinary.calls.writes.length, 0);
  const exceptional = harness({ rows: { jugadores: [{ ...player, fecha_nacimiento: null }] } });
  assert.ok((await save(exceptional, { tipo_resolucion: "excepcion_documentada" })).success);
  const missing = harness(); assert.ok((await save(missing, { tipo_resolucion: "excepcion_documentada", referencia_evidencia: "" })).error); assert.equal(missing.calls.writes.length, 0);
});
test("reglas pendientes o jugador inactivo no conceden habilitación ni aun con excepción", async () => {
  for (const rows of [{ reglamentos_temporada: [{ ...rule, estado_revision: "pendiente" }] }, { jugadores: [{ ...player, activo: false }] }, { categorias_temporada: [{ ...category, criterio_nacimiento: "pendiente" }] }, { categorias_temporada: [{ ...category, rama: null }] }, { categorias: [{ id: 1, activo: false }] }]) {
    const h = harness({ rows }); assert.ok((await save(h, { tipo_resolucion: "excepcion_documentada" })).error); assert.equal(h.calls.writes.length, 0);
  }
});
test("pendiente y no habilitado pueden documentar reglas todavía pendientes", async () => {
  for (const estado of ["pendiente", "no_habilitado"]) {
    const h = harness({ rows: { reglamentos_temporada: [{ ...rule, estado_revision: "pendiente" }] } });
    assert.ok((await save(h, { estado })).success); assert.equal(h.calls.writes[0].payload.estado, estado);
  }
});
test("actualiza solo la resolución vigente con comparación de campos nulos y valores", async () => {
  const h = harness({ rows: { habilitaciones_jugador_categoria: [record] } });
  assert.ok((await save(h, {}, domain.habilitationRevision(record))).success);
  const w = h.calls.writes[0]; assert.equal(w.mode, "update");
  assert.deepEqual(Object.keys(w.payload).sort(), ["estado", "motivo", "referencia_evidencia", "tipo_resolucion"]);
  assert.ok(w.filters.some(([k, v]) => k === "motivo" && v === null));
  assert.ok(w.filters.some(([k, v]) => k === "id" && v === record.id));
  const stale = harness({ rows: { habilitaciones_jugador_categoria: [{ ...record, motivo: "Otra revisión" }] } });
  assert.match((await save(stale, {}, domain.habilitationRevision(record))).error, /otra sesión/); assert.equal(stale.calls.writes.length, 0);
});
test("errores de PostgreSQL y respuestas incompletas no anuncian éxito", async () => {
  for (const writeError of ["42501", "23514", "23505", "23503", "XX000"]) {
    const h = harness({ writeError }); const result = await save(h); assert.ok(result.error); assert.equal(result.success, undefined); assert.doesNotMatch(result.error, /detalle SQL/);
  }
  for (const opts of [{ absentWrite: true }, { missingAudit: true }, { readError: "jugadores" }, { offline: true }]) {
    const result = await save(harness(opts)); assert.ok(result.error); assert.doesNotMatch(result.error, /detalle privado/);
  }
});
test("categoría de otra temporada y jugador inexistente no generan escrituras", async () => {
  for (const rows of [{ categorias_temporada: [{ ...category, temporada_id: 2 }] }, { jugadores: [] }]) {
    const h = harness({ rows }); assert.ok((await save(h)).error); assert.equal(h.calls.writes.length, 0);
  }
});
test("búsqueda conserva homónimos e IDs distintos y filtros distinguen ausencia de resolución", () => {
  const list = [player, { ...player, id: 8, perfil_id: "cuenta" }, { ...player, id: 10, nombre_completo: "Otra persona", activo: false }];
  const h = [{ ...record, jugador_id: 8 }, { ...record, id: 10, jugador_id: 10, estado: "no_habilitado", tipo_resolucion: "excepcion_documentada" }];
  assert.deepEqual(domain.filterHabilitationPlayers(list, h, { q: "NOMBRE REPETIDO" }).map(p => p.id), [7, 8]);
  assert.deepEqual(domain.filterHabilitationPlayers(list, h, { q: "#8" }).map(p => p.id), [8]);
  assert.deepEqual(domain.filterHabilitationPlayers(list, h, { estado: "sin_resolucion" }).map(p => p.id), [7]);
  assert.deepEqual(domain.filterHabilitationPlayers(list, h, { estado: "pendiente" }).map(p => p.id), [8]);
  assert.deepEqual(domain.filterHabilitationPlayers(list, h, { cuenta: "sin", activo: "inactivo", tipo: "excepcion_documentada" }).map(p => p.id), [10]);
});

const link = { default: ({ children, ...props }) => React.createElement("a", props, children) };
function page(h) {
  return load("../src/app/panel/juez-general/habilitaciones/page.tsx", { "react/jsx-runtime": jsx, "next/link": link, "next/form": { default: ({ children, ...props }) => React.createElement("form", props, children) }, "@/components/dashboard-shell": { DashboardShell: ({ children }) => children }, "@/components/judge-navigation": { JudgeNavigation: () => null }, "@/components/habilitation-form": { HabilitationForm: () => React.createElement("section", null, "Formulario de resolución") }, "@/lib/auth": { requireRole: h.requireRole }, "@/lib/supabase/server": { createClient: h.createClient }, "@/lib/catalogos": catalogs, "@/lib/jugadores": playersDomain, "@/lib/habilitaciones": domain }).default;
}
const renderPage = async (h, extra = {}) => renderToStaticMarkup(await page(h)({ searchParams: Promise.resolve({ temporada: "1", categoria: "3", ...extra }) }));
test("página muestra nacimiento, cuenta, motivo y revisión sin modificar jugadores", async () => {
  const h = harness({ rows: { habilitaciones_jugador_categoria: [{ ...record, estado: "no_habilitado", motivo: "Antecedentes insuficientes", referencia_evidencia: "Acta documentada" }] } });
  const html = await renderPage(h, { jugador: "7" });
  for (const text of ["Nombre repetido", "Sin cuenta vinculada", "10-04-2010", "Antecedentes insuficientes", "Acta documentada", "Club registrado", "Procedencia registrada", "Formulario de resolución"]) assert.ok(html.includes(text), text);
  assert.equal(h.calls.writes.length, 0);
  assert.ok(h.calls.reads.filter(r => r.table === "habilitaciones_jugador_categoria").every(r => r.filters.some(([k, v]) => k === "categoria_temporada_id" && v === 3)));
});
test("página pagina todos los jugadores sin truncar a 500 ni combinar homónimos", async () => {
  const list = Array.from({ length: 501 }, (_, i) => ({ ...player, id: i + 1 }));
  const h = harness({ rows: { jugadores: list } }); const html = await renderPage(h, { pagina: "21" });
  assert.match(html, /jugador #501/); assert.match(html, /Página 21 de 21/);
  assert.equal(h.calls.reads.filter(r => r.table === "jugadores").length, 2);
});
test("página maneja filtros vacíos, fallo de consulta y categoría inválida", async () => {
  assert.match(await renderPage(harness(), { q: "Inexistente" }), /No hay jugadores para estos filtros/);
  assert.match(await renderPage(harness({ readError: "reglamentos_temporada" }), { jugador: "7" }), /No se pudieron consultar/);
  const h = harness(); assert.match(await renderPage(h, { categoria: "999" }), /Selecciona una categoría válida/); assert.ok(!h.calls.reads.some(r => r.table === "jugadores"));
});
test("otros roles no pueden consultar la página privada", async () => {
  for (const role of ["administrador", "arbitro", "jugador"]) {
    const h = harness({ role }); await assert.rejects(() => renderPage(h), /acceso denegado/); assert.equal(h.calls.clients, 0);
  }
});
test("formulario usa estados reales, exige revisión explícita y no expone campos de cuenta/auditoría editables", () => {
  const competitions = load("../src/lib/competencias.ts", { "./catalogos": catalogs });
  const { HabilitationForm } = load("../src/components/habilitation-form.tsx", { "react/jsx-runtime": jsx, react: { useActionState: (_fn, state) => [state, undefined, false] }, "@/app/panel/juez-general/habilitaciones/actions": harness().actions, "@/lib/habilitaciones": domain, "@/lib/competencias": competitions });
  const html = renderToStaticMarkup(React.createElement(HabilitationForm, { seasonId: 1, categoryId: 3, playerId: 7, record: null, refreshHref: "/recargar" }));
  for (const state of ["pendiente", "habilitado", "no_habilitado", "ordinaria", "excepcion_documentada"]) assert.ok(html.includes(`value="${state}"`));
  for (const field of ["perfil_id", "validado_por", "validado_en", "creado_en", "jugador_id"]) assert.ok(!html.includes(`name="${field}"`));
  assert.match(html, /name="confirmacion"/); assert.doesNotMatch(html, /checked=""/);
});
