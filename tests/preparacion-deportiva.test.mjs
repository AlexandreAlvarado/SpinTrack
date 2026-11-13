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
const competitions = load("../src/lib/competencias.ts", { "./catalogos": catalogs });
const domain = load("../src/lib/preparacion-deportiva.ts", { "./competencias": competitions });
const quickDomain = load("../src/lib/preparacion-rapida.ts", { "./preparacion-deportiva": domain });
const c = { id: 5, temporada_id: 1, fecha_id: 2, categoria_temporada_id: 3, activo: true, publicada: false, inscripciones_habilitadas: false, tarifa_clp: null, inscripcion_abre_en: null, inscripcion_cierra_en: null };
const date = { id: 2, temporada_id: 1, numero: 4, fecha: "2026-08-08", comuna: "Prueba", recinto: "Recinto compartido", estado: "borrador" };
const category = { id: 3, temporada_id: 1, categoria_id: 1, nivel_id: 1, codigo: "juvenil_inicial", rama: "mixta", criterio_nacimiento: "rango_anios", reglamento_id: 4, activo: true, catalogos_activos: true };
const rule = { id: 4, temporada_id: 1, titulo: "Reglas de prueba", version: "test", estado_revision: "validado", referencia_aprobacion: "Resolución de prueba" };
const p = { competencia_id: 5, temporada_id: 1, configuracion_aprobada: false, estado_deportivo: "pendiente", inicio_programado: "2026-08-08T16:00:00Z", minimo_participantes: 4, grupo_minimo: 3, grupo_maximo: 4, formato_competencia: "grupos_eliminacion_simple", reglamento_id: 4, motivo_resolucion: null, referencia_resolucion: null, actualizado_en: "2026-08-01T10:00:00Z", actualizado_por: "juez", aprobado_por: null, aprobado_en: null };
const formats = domain.STAGES.map(etapa => ({ competencia_id: 5, etapa, mejor_de: 3, referencia_resolucion: null, actualizado_en: "revision-sets", actualizado_por: "juez" }));
function form(extra = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}
const valid = { inicio_programado: "2026-08-08T12:00", minimo_participantes: "4", grupo_minimo: "3", grupo_maximo: "4", formato_competencia: "grupos_eliminacion_simple" };

function harness(options = {}) {
  const calls = { clients: 0, writes: [], reads: [], invalidated: [] };
  const rows = { temporadas: [{ id: 1, nombre: "Temporada de prueba", anio: 2026 }], fechas: [date], competencias: [c], categorias_temporada: [category], reglamentos_temporada: [rule], categorias: [{ id: 1, nombre: "Juvenil", activo: true }], niveles: [{ id: 1, nombre: "Inicial", activo: true }], competencia_control_deportivo: [p], competencia_formatos_sets: formats, ...options.rows };
  const role = options.role ?? "juez_general";
  const requireRole = async expected => { assert.equal(expected, "juez_general"); if (role !== expected) throw new Error("acceso denegado"); return { rol: role, nombre: "Juez de prueba" }; };
  const createClient = async () => {
    calls.clients++;
    if (options.offline) throw new Error("secreto de conexión");
    return { from(table) {
      assert.ok(Object.hasOwn(rows, table), table);
      const filters = []; let mode = "read", payload, range = null;
      const query = {
        select() { return query; }, eq(k, v) { filters.push([k, v]); return query; }, in(k, vs) { filters.push([k, vs]); return query; },
        order() { return query; }, range(a, b) { range = [a, b]; return query; },
        insert(v) { mode = "insert"; payload = v; return query; }, update(v) { mode = "update"; payload = v; return query; },
        async run(single = false) {
          const selected = (rows[table] ?? []).filter(r => filters.every(([k, v]) => Array.isArray(v) ? v.includes(r[k]) : r[k] === v));
          if (mode !== "read") {
            calls.writes.push({ table, mode, payload, filters });
            if (options.writeError) return { data: null, error: options.writeError };
            if (options.absentWrite || (mode === "update" && !selected.length)) return { data: null, error: null };
            const result = { ...(selected[0] ?? {}), ...payload };
            if (payload.configuracion_aprobada && !options.missingAudit) Object.assign(result, { aprobado_por: "juez-postgres", aprobado_en: "2026-08-01T12:00:00Z" });
            return { data: single ? result : [result], error: null };
          }
          calls.reads.push({ table, filters });
          if (options.readError === table) return { data: null, error: { code: "42501" } };
          const result = range ? selected.slice(range[0], range[1] + 1) : selected;
          return { data: single ? result[0] ?? null : result, error: null };
        },
        maybeSingle() { return query.run(true); }, then(ok, fail) { return query.run().then(ok, fail); },
      };
      return query;
    } };
  };
  const actions = load("../src/app/panel/juez-general/preparacion/actions.ts", { "next/cache": { revalidatePath: path => calls.invalidated.push(path) }, "@/lib/auth": { requireRole }, "@/lib/supabase/server": { createClient }, "@/lib/catalogos": catalogs, "@/lib/competencias": competitions, "@/lib/preparacion-deportiva": domain });
  return { calls, actions, createClient, requireRole };
}
const save = (h, f = valid, revision = p.actualizado_en) => h.actions.savePreparation(1, 2, 5, revision, {}, form(f));
const stage = (h, f = { mejor_de: "5" }, revision = "revision-sets") => h.actions.saveStageFormat(1, 2, 5, "grupos", revision, {}, form(f));
const approve = h => h.actions.approvePreparation(1, 2, 5, p.actualizado_en, {}, form({ confirmacion: "revisada" }));

test("borrador incompleto no inventa reglas y aprobación enumera pendientes", () => {
  const result = domain.validatePreparation(form(), date.fecha);
  assert.deepEqual(result.errors, {});
  assert.ok(Object.values(result.payload).every(v => v === null));
  assert.ok(domain.preparationBlockers(c, date, null, category, rule, []).length >= 10);
  assert.deepEqual(domain.preparationBlockers(c, date, p, category, rule, formats), []);
});
test("tamaños de grupo, mínimo excepcional y formato respetan restricciones 003", () => {
  for (const extra of [{ grupo_minimo: "2" }, { grupo_maximo: "5" }, { grupo_minimo: "4", grupo_maximo: "3" }, { minimo_participantes: "0" }, { minimo_participantes: "3" }, { formato_competencia: "otro" }]) assert.ok(Object.keys(domain.validatePreparation(form({ ...valid, ...extra }), date.fecha).errors).length);
  assert.deepEqual(domain.validatePreparation(form({ ...valid, minimo_participantes: "3", motivo_resolucion: "Resolución", referencia_resolucion: "Referencia" }), date.fecha).errors, {});
});
test("horario en Santiago exige mismo día y elección explícita para hora repetida", () => {
  assert.ok(domain.validatePreparation(form({ ...valid, inicio_programado: "2026-08-09T12:00" }), date.fecha).errors.inicio_programado);
  assert.ok(domain.validatePreparation(form({ ...valid, inicio_programado: "2026-09-06T00:30" }), "2026-09-06").errors.inicio_programado);
  assert.ok(domain.validatePreparation(form({ ...valid, inicio_programado: "2026-04-04T23:30" }), "2026-04-04").errors.inicio_programado);
  assert.equal(domain.validatePreparation(form({ ...valid, inicio_programado: "2026-04-04T23:30", ocurrencia: "segunda" }), "2026-04-04").payload.inicio_programado, "2026-04-05T03:30:00.000Z");
});
test("sets inválidos, archivos y campos administrativos no se incorporan", () => {
  for (const v of ["", "4", "7", "3.0", "3;delete"]) assert.ok(domain.validateStage(form({ mejor_de: v })).errors.mejor_de);
  const f = form({ ...valid, aprobado_por: "falso", tarifa_clp: "0", estado_deportivo: "finalizada", reglamento_id: "99" });
  f.set("grupo_minimo", new Blob(["3"]), "archivo");
  const result = domain.validatePreparation(f, date.fecha);
  assert.ok(result.errors.grupo_minimo);
  for (const k of ["aprobado_por", "tarifa_clp", "estado_deportivo", "reglamento_id"]) assert.equal(Object.hasOwn(result.payload, k), false);
});
test("Juez guarda borrador con sesión, sin auditoría ni cambios administrativos", async () => {
  const h = harness(); assert.ok((await save(h)).success);
  assert.equal(h.calls.writes[0].table, "competencia_control_deportivo");
  assert.equal(h.calls.writes[0].payload.reglamento_id, 4);
  for (const k of ["actualizado_por", "actualizado_en", "aprobado_por", "aprobado_en", "configuracion_aprobada", "estado_deportivo", "tarifa_clp"]) assert.equal(Object.hasOwn(h.calls.writes[0].payload, k), false);
});
for (const role of ["administrador", "arbitro", "jugador"]) test(`${role} no puede invocar ninguna acción del Juez`, async () => {
  const h = harness({ role });
  for (const operation of [save, stage, approve]) await assert.rejects(() => operation(h), /acceso denegado/);
  assert.equal(h.calls.clients, 0); assert.equal(h.calls.writes.length, 0);
});
test("creación de borrador conserva datos nulos y claves vienen del contexto", async () => {
  const h = harness({ rows: { competencia_control_deportivo: [] } });
  assert.ok((await save(h, {}, null)).success);
  assert.equal(h.calls.writes[0].mode, "insert");
  assert.equal(h.calls.writes[0].payload.competencia_id, 5);
  assert.equal(h.calls.writes[0].payload.inicio_programado, null);
});
test("sets se guardan por etapa con INSERT o UPDATE limitado, sin upsert de claves", async () => {
  const h = harness(); assert.ok((await stage(h)).success);
  assert.deepEqual(h.calls.writes[0].payload, { mejor_de: 5, referencia_resolucion: null });
  const fresh = harness({ rows: { competencia_formatos_sets: [] } });
  assert.ok((await stage(fresh, { mejor_de: "3" }, null)).success);
  assert.equal(fresh.calls.writes[0].payload.etapa, "grupos");
  const invalid = harness(); assert.ok((await stage(invalid, { mejor_de: "4" })).error); assert.equal(invalid.calls.writes.length, 0);
});
test("se rechaza aprobación incompleta y con reglamento pendiente sin escritura", async () => {
  for (const rows of [{ competencia_formatos_sets: formats.slice(1) }, { reglamentos_temporada: [{ ...rule, estado_revision: "pendiente" }] }, { competencia_control_deportivo: [{ ...p, grupo_minimo: null }] }, { categorias_temporada: [{ ...category, rama: null }] }]) {
    const h = harness({ rows }); assert.ok((await approve(h)).error); assert.equal(h.calls.writes.length, 0);
  }
});
test("guardar o aprobar horario incompatible con jornada/plazos no escribe", async () => {
  const h = harness(); assert.ok((await save(h, { ...valid, inicio_programado: "2026-08-09T12:00" })).errors.inicio_programado); assert.equal(h.calls.writes.length, 0);
  const wrong = harness({ rows: { competencia_control_deportivo: [{ ...p, inicio_programado: "2026-08-09T16:00:00Z" }] } });
  assert.match((await approve(wrong)).error, /día de la jornada/); assert.equal(wrong.calls.writes.length, 0);
  const late = harness({ rows: { competencias: [{ ...c, inscripcion_cierra_en: "2026-08-08T17:00:00Z" }] } });
  assert.match((await save(late)).error, /cierre de inscripciones/); assert.equal(late.calls.writes.length, 0);
});
test("aprobación solo confirma éxito con respuesta y auditoría de PostgreSQL", async () => {
  const h = harness(); assert.ok((await approve(h)).success);
  assert.deepEqual(h.calls.writes[0].payload, { configuracion_aprobada: true, estado_deportivo: "preparada" });
  for (const options of [{ writeError: { code: "23514" } }, { absentWrite: true }, { missingAudit: true }]) assert.ok((await approve(harness(options))).error);
});
test("aprobadas, publicadas y estados operativos quedan en lectura", async () => {
  for (const rows of [{ competencia_control_deportivo: [{ ...p, configuracion_aprobada: true, estado_deportivo: "preparada" }] }, { competencias: [{ ...c, publicada: true }] }, ...["en_curso", "suspendida", "finalizada", "cancelada"].map(estado_deportivo => ({ competencia_control_deportivo: [{ ...p, estado_deportivo }] }))]) {
    const h = harness({ rows });
    for (const operation of [save, stage, approve]) assert.ok((await operation(h)).error);
    assert.equal(h.calls.writes.length, 0);
  }
});
test("ediciones concurrentes y errores de consulta no se sobreescriben", async () => {
  const h = harness(); assert.match((await save(h, valid, "revision-vieja")).error, /otra sesión/); assert.equal(h.calls.writes.length, 0);
  assert.ok((await stage(h, { mejor_de: "3" }, "revision-vieja")).error); assert.equal(h.calls.writes.length, 0);
  assert.ok((await approve(harness({ readError: "competencia_formatos_sets" }))).error);
  assert.doesNotMatch((await save(harness({ offline: true }))).error, /secreto/);
});

const link = { default: ({ children, ...props }) => React.createElement("a", props, children) };
function page(h) {
  return load("../src/app/panel/juez-general/preparacion/page.tsx", {
    "react/jsx-runtime": jsx, "next/link": link, "next/form": { default: ({ children, ...props }) => React.createElement("form", props, children) },
    "@/components/dashboard-shell": { DashboardShell: ({ children }) => children }, "@/components/judge-navigation": { JudgeNavigation: () => React.createElement("nav", null, "Dirección deportiva") },
    "@/components/quick-preparation-table": { QuickPreparationTable: ({ rows }) => React.createElement("section", null, `Competencias individuales (${rows.length}) ${rows.map(r => `competencia #${r.competition.id} ${r.record?.estado_deportivo}`).join(" ")}`) },
    "@/lib/preparacion-rapida": quickDomain,
    "@/components/preparation-form": { PreparationForm: () => React.createElement("section", null, "Formulario deportivo") },
    "@/lib/auth": { requireRole: h.requireRole }, "@/lib/supabase/server": { createClient: h.createClient }, "@/lib/catalogos": catalogs, "@/lib/competencias": competitions, "@/lib/preparacion-deportiva": domain,
  }).default;
}
test("página lista múltiples competencias en la misma jornada, con estados independientes", async () => {
  const h = harness({ rows: { competencias: [c, { ...c, id: 6 }], competencia_control_deportivo: [p, { ...p, competencia_id: 6, estado_deportivo: "suspendida" }] } });
  const html = renderToStaticMarkup(await page(h)({ searchParams: Promise.resolve({ temporada: "1", fecha: "2" }) }));
  assert.match(html, /Competencias individuales \(<!-- -->2<!-- -->\)|Competencias individuales \(2\)/);
  assert.match(html, /competencia #5/); assert.match(html, /competencia #6/); assert.match(html, /suspendida/); assert.match(html, /no se impone una secuencia/);
  assert.equal(h.calls.writes.length, 0);
  assert.ok(h.calls.reads.filter(x => x.table === "competencias").every(x => x.filters.some(([key, v]) => key === "fecha_id" && v === 2)));
});
test("acceso a página permitido al Juez y rechazado al resto antes de consultar", async () => {
  for (const role of ["administrador", "arbitro", "jugador"]) {
    const h = harness({ role }); await assert.rejects(() => page(h)({ searchParams: Promise.resolve({}) }), /denegado/); assert.equal(h.calls.clients, 0);
  }
});
test("página maneja consulta fallida y jornada sin competencias", async () => {
  const failed = harness({ readError: "competencias" });
  assert.match(renderToStaticMarkup(await page(failed)({ searchParams: Promise.resolve({ temporada: "1", fecha: "2", competencia: "5" }) })), /formularios están bloqueados/);
  const empty = harness({ rows: { competencias: [] } });
  assert.match(renderToStaticMarkup(await page(empty)({ searchParams: Promise.resolve({ temporada: "1", fecha: "2" }) })), /No hay competencias asociadas/);
});
test("formulario muestra cinco etapas sin reglas precargadas ni controles administrativos", () => {
  const ui = load("../src/components/preparation-form.tsx", { "react/jsx-runtime": jsx, react: { useActionState: (_action, state) => [state, undefined, false], useState: initial => [initial, () => {}] }, "next/link": link, "@/app/panel/juez-general/preparacion/actions": harness().actions, "@/lib/preparacion-deportiva": domain, "@/lib/competencias": competitions });
  const html = renderToStaticMarkup(React.createElement(ui.PreparationForm, { seasonId: 1, dateId: 2, day: date.fecha, competition: c, record: null, formats: [], blockers: ["Falta reglamento"], refreshHref: "/recargar" }));
  for (const label of Object.values(domain.STAGE_LABELS)) assert.ok(html.includes(label));
  for (const forbidden of ["tarifa_clp", "publicada", "estado_deportivo", "aprobado_por", "reglamento_id"]) assert.ok(!html.includes(`name="${forbidden}"`));
  assert.match(html, /Falta reglamento/); assert.match(html, /Pendiente de configurar/);
});
test("guard real requireRole utiliza el perfil verificado, no el rol de metadata", async () => {
  for (const actual of ["juez_general", "administrador", "arbitro", "jugador"]) {
    const roles = { juez_general: "/panel/juez-general", administrador: "/panel/administrador", arbitro: "/panel/arbitro", jugador: "/panel/jugador" };
    const auth = load("../src/lib/auth.ts", {
      "next/navigation": { redirect: path => { throw new Error(`redirect:${path}`); } },
      "@/lib/config": { supabaseConfigured: () => true },
      "@/lib/roles": { isRole: r => Object.hasOwn(roles, r), ROLE_PATHS: roles },
      "@/lib/supabase/server": { createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims: { sub: "identidad-verificada", user_metadata: { rol: "juez_general" } } }, error: null }) }, from: table => {
        assert.equal(table, "perfiles");
        return { select: () => ({ eq: (key, value) => {
          assert.equal(key, "id"); assert.equal(value, "identidad-verificada");
          return { single: async () => ({ data: { id: value, rol: actual, nombre_completo: "Perfil real" }, error: null }) };
        } }) };
      } }) },
    });
    if (actual === "juez_general") assert.equal((await auth.requireRole("juez_general")).rol, actual);
    else await assert.rejects(() => auth.requireRole("juez_general"), new RegExp(`redirect:${roles[actual]}`));
  }
});
test("navegación propia del Juez no concede accesos administrativos", () => {
  const { JudgeNavigation } = load("../src/components/judge-navigation.tsx", { "react/jsx-runtime": jsx, "next/navigation": { usePathname: () => domain.JUDGE_PATH }, "next/link": link, "@/lib/preparacion-deportiva": domain, "@/lib/habilitaciones": { HABILITATIONS_PATH: "/panel/juez-general/habilitaciones" } });
  const html = renderToStaticMarkup(React.createElement(JudgeNavigation, { current: domain.JUDGE_PATH }));
  assert.match(html, /aria-current="page"/); assert.match(html, /Preparación deportiva/);
  assert.doesNotMatch(html, /administrador|tarifa|cuentas/);
});
