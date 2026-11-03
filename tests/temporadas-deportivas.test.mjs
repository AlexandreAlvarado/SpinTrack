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
const domain = load("../src/lib/temporadas-deportivas.ts");
const catalogs = load("../src/lib/catalogos.ts");
function form(extra = {}, kind = "reglamentos") {
  const f = new FormData();
  const defaults = kind === "reglamentos" ? { version: "v1", titulo: "Bases oficiales", referencia_documental: "Acta documental", estado_revision: "pendiente" } : { categoria_id: "1", nivel_id: "2", rama: "", criterio_nacimiento: "pendiente", activo: "true" };
  for (const [key, value] of Object.entries({ ...defaults, ...extra })) f.set(key, value);
  return f;
}
test("exactamente diez combinaciones individuales; sin combinaciones ajenas ni propiedades heredadas", () => {
  assert.equal(Object.values(domain.COMBINATIONS).flat().length, 10);
  for (const [category, levels] of Object.entries(domain.COMBINATIONS)) for (const level of levels) assert.equal(domain.allowedCombination(category, level, null), true);
  for (const [c, n] of [["peneca", "federado"], ["tc", "inicial"], ["dobles", "unica"], ["constructor", "inicial"]]) assert.equal(domain.allowedCombination(c, n, null), false);
  assert.equal(domain.allowedCombination("tc", "unica", "varones"), false);
  assert.equal(domain.allowedCombination("tc", "unica", "damas"), true);
});
test("reglamento pendiente no equivale a validado; exige confirmación y referencia", () => {
  assert.deepEqual(domain.validateSeasonForm("reglamentos", false, form(), 2026).errors, {});
  const pending = domain.validateSeasonForm("reglamentos", false, form({ estado_revision: "validado" }), 2026);
  assert.ok(pending.errors.confirmacion_liga); assert.ok(pending.errors.referencia_aprobacion);
  assert.deepEqual(domain.validateSeasonForm("reglamentos", false, form({ estado_revision: "validado", confirmacion_liga: "true", referencia_aprobacion: "Acta real" }), 2026).errors, {});
});
test("texto requerido, límites, hash y estados se validan sin truncar", () => {
  for (const extra of [{ version: "" }, { titulo: "x".repeat(201) }, { referencia_documental: "" }, { hash_documento: "no" }, { estado_revision: "aprobado" }]) assert.ok(Object.keys(domain.validateSeasonForm("reglamentos", false, form(extra), 2026).errors).length);
  assert.deepEqual(domain.validateSeasonForm("reglamentos", false, form({ hash_documento: "a".repeat(64) }), 2026).errors, {});
});
test("identidad, auditoría y confirmación nunca se incluyen en UPDATE", () => {
  const r = domain.validateSeasonForm("reglamentos", true, form({ temporada_id: "99", version: "otra", registrado_por: "otro", confirmado: "true" }), 2026);
  for (const key of ["temporada_id", "version", "registrado_por", "confirmado", "confirmacion_liga"]) assert.equal(Object.hasOwn(r.payload, key), false);
  const c = domain.validateSeasonForm("categorias", true, form({ categoria_id: "99", nivel_id: "99", codigo: "ajeno" }, "categorias"), 2026);
  for (const key of ["categoria_id", "nivel_id", "codigo"]) assert.equal(Object.hasOwn(c.payload, key), false);
});
test("nacimiento pendiente admite nulos, rango inclusivo válido y sin límite sin años", () => {
  for (const extra of [{}, { criterio_nacimiento: "sin_limite" }, { criterio_nacimiento: "rango_anios", anio_nacimiento_desde: "2015", anio_nacimiento_hasta: "2017" }]) assert.deepEqual(domain.validateSeasonForm("categorias", false, form(extra, "categorias"), 2026).errors, {});
});
test("rechaza rangos incompletos, futuros, invertidos, decimales y años con criterio pendiente", () => {
  for (const extra of [{ criterio_nacimiento: "rango_anios" }, { criterio_nacimiento: "rango_anios", anio_nacimiento_desde: "2026", anio_nacimiento_hasta: "2027" }, { criterio_nacimiento: "rango_anios", anio_nacimiento_desde: "2017", anio_nacimiento_hasta: "2015" }, { criterio_nacimiento: "rango_anios", anio_nacimiento_desde: "1.5", anio_nacimiento_hasta: "2017" }, { anio_nacimiento_desde: "2015" }]) assert.ok(Object.keys(domain.validateSeasonForm("categorias", false, form(extra, "categorias"), 2026).errors).length);
});
test("valida identificadores, rama, estado y archivos inesperados", () => {
  for (const extra of [{ categoria_id: "1e2" }, { nivel_id: "-1" }, { reglamento_id: "0" }, { rama: "otra" }, { activo: "on" }]) assert.ok(Object.keys(domain.validateSeasonForm("categorias", false, form(extra, "categorias"), 2026).errors).length);
  const f = form(); f.set("titulo", new Blob(["x"]), "archivo.txt");
  assert.ok(domain.validateSeasonForm("reglamentos", false, f, 2026).errors.titulo);
});
function harness({ deny = false, foreign = false, error = null, absent = false, category = "peneca", level = "inicial" } = {}) {
  const calls = { clients: 0, writes: [], filters: [], invalidated: [] };
  const actions = load("../src/app/panel/administrador/temporadas-deportivas/actions.ts", {
    "@/lib/temporadas-deportivas": domain, "@/lib/catalogos": catalogs,
    "@/lib/auth": { requireRole: async role => { assert.equal(role, "administrador"); if (deny) throw new Error("denegado"); } },
    "next/cache": { revalidatePath: p => calls.invalidated.push(p) },
    "@/lib/supabase/server": { createClient: async () => {
      calls.clients++;
      return { from: table => {
        let writing = false;
        const result = async () => writing ? { data: absent || error ? null : { id: 1 }, error } : { data: table === "temporadas" ? { id: 1, anio: 2026 } : table === "categorias" ? { codigo: category, activo: true } : table === "niveles" ? { codigo: level, activo: true } : table === "reglamentos_temporada" ? (foreign ? null : { id: 3, temporada_id: 1 }) : { id: 1, temporada_id: 1, categoria_id: 1, nivel_id: 2 }, error: null };
        const b = { select: () => b, eq: (k, v) => { calls.filters.push([table, k, v]); return b; }, insert: p => { writing = true; calls.writes.push({ table, p, mode: "insert" }); return b; }, update: p => { writing = true; calls.writes.push({ table, p, mode: "update" }); return b; }, maybeSingle: result, single: result };
        return b;
      } };
    } },
  });
  return { calls, save: actions.saveSeasonConfiguration };
}
test("Administrador se comprueba antes de conectar para ambos tipos y operaciones", async () => {
  const h = harness({ deny: true });
  for (const kind of ["reglamentos", "categorias"]) for (const id of [null, 1]) await assert.rejects(h.save(kind, 1, id, {}, form()), /denegado/);
  assert.equal(h.calls.clients, 0);
});
test("no permite tablas ni identificadores manipulados", async () => {
  const h = harness();
  for (const args of [["perfiles", 1, null], ["reglamentos", -1, null], ["categorias", 1, -1]]) assert.ok((await h.save(...args, {}, form())).error);
  assert.equal(h.calls.clients, 0);
});
test("inserción usa temporada del servidor y excluye auditoría; edición omite identidad", async () => {
  const h = harness();
  assert.ok((await h.save("reglamentos", 1, null, {}, form({ temporada_id: "9", registrado_por: "otro" }))).success);
  assert.equal(h.calls.writes[0].p.temporada_id, 1); assert.equal(h.calls.writes[0].p.registrado_por, undefined);
  assert.ok((await h.save("reglamentos", 1, 3, {}, form())).success);
  assert.equal(h.calls.writes[1].p.version, undefined); assert.equal(h.calls.writes[1].p.temporada_id, undefined);
});
test("referencias de otra temporada se rechazan antes de escribir", async () => {
  const h = harness({ foreign: true });
  assert.ok((await h.save("categorias", 1, null, {}, form({ reglamento_id: "3" }, "categorias"))).errors.reglamento_id);
  assert.equal(h.calls.writes.length, 0);
  assert.ok(h.calls.filters.some(([t, k, v]) => t === "reglamentos_temporada" && k === "temporada_id" && v === 1));
});
test("combinaciones ajenas al Excel no se escriben", async () => {
  const h = harness({ level: "federado" });
  assert.ok((await h.save("categorias", 1, null, {}, form({}, "categorias"))).error);
  assert.equal(h.calls.writes.length, 0);
});
test("edición de categoría usa identidad real, solo cambia configuración y no elimina", async () => {
  const h = harness();
  assert.ok((await h.save("categorias", 1, 1, {}, form({ categoria_id: "99", nivel_id: "99", activo: "false" }, "categorias"))).success);
  assert.equal(h.calls.writes[0].mode, "update"); assert.equal(h.calls.writes[0].p.activo, false);
  assert.equal(h.calls.writes[0].p.categoria_id, undefined); assert.equal(h.calls.writes[0].p.codigo, undefined);
});
test("duplicados, restricciones, RLS y fila ausente no anuncian éxito", async () => {
  for (const code of ["23505", "23503", "23514", "42501"]) {
    const h = harness({ error: { code, message: "detalle secreto" } });
    const state = await h.save("reglamentos", 1, null, {}, form());
    assert.ok(state.error); assert.equal(state.success, undefined); assert.doesNotMatch(state.error, /detalle secreto/); assert.equal(h.calls.invalidated.length, 0);
  }
  assert.ok((await harness({ absent: true }).save("reglamentos", 1, null, {}, form())).error);
});

function renderForm(kind, record = null, state = {}, pending = false) {
  const { SeasonConfigurationForm } = load("../src/components/season-configuration-form.tsx", {
    "react/jsx-runtime": jsx,
    react: { useActionState: () => [state, "/simulada", pending], useState: React.useState },
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "@/lib/temporadas-deportivas": domain,
    "@/app/panel/administrador/temporadas-deportivas/actions": { saveSeasonConfiguration: () => {} },
  });
  return renderToStaticMarkup(React.createElement(SeasonConfigurationForm, { kind, seasonId: 1, record, categories: [{ id: 1, codigo: "peneca", nombre: "Peneca", activo: true }], levels: [], rules: [{ id: 3, version: "v1", titulo: "Bases", estado_revision: "pendiente" }], cancelHref: "/volver" }));
}
test("formulario de reglamentos inicia pendiente, sin confirmación automática, y muestra errores", () => {
  const html = renderForm("reglamentos", null, { error: "Revisa datos", errors: { titulo: "Título requerido" } });
  assert.match(html, /role="alert"/); assert.match(html, /Título requerido/);
  assert.match(html, /value="pendiente" selected=""/); assert.doesNotMatch(html, /checked=""/);
  assert.match(html, /name="referencia_aprobacion"/); assert.match(html, /name="confirmacion_liga"/);
});
test("edición no ofrece campos de identidad; muestra código y configuración pendiente", () => {
  const html = renderForm("categorias", { id: 1, codigo: "peneca_inicial", categoria_id: 1, nivel_id: 2, rama: null, criterio_nacimiento: "pendiente", activo: true });
  assert.match(html, /peneca_inicial/); assert.doesNotMatch(html, /name="categoria_id"|name="nivel_id"|name="temporada_id"|name="codigo"/);
  assert.match(html, /Pendiente de confirmar/); assert.match(html, /v1 — Bases \(pendiente\)/);
});
test("formulario distingue guardando, éxito y errores", () => {
  assert.match(renderForm("reglamentos", null, {}, true), /fieldset disabled=""/);
  assert.match(renderForm("reglamentos", null, {}, true), /Guardando…/);
  assert.match(renderForm("reglamentos", null, { success: "Guardado" }), /role="status"/);
});
