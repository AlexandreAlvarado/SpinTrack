import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Module from "node:module";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";

function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const mod = new Module(filename);
  mod.require = name => { assert.ok(Object.hasOwn(mocks, name), `Dependencia inesperada: ${name}`); return mocks[name]; };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const link = { default: ({ children, ...props }) => jsx.jsx("a", { ...props, children }) };
const icons = Object.fromEntries(["ArrowRight", "CalendarDays", "MapPin", "Trophy", "Users", "HeartHandshake", "GraduationCap", "ExternalLink"].map(name => [name, () => null]));
const common = { "react/jsx-runtime": jsx, "next/link": link, "lucide-react": icons };
const { DateList } = load("../src/components/date-list.tsx", { ...common, "@/lib/format": { formatDate: value => value } });
const board = load("../src/components/public-ranking.tsx", { ...common, react: React });
const config = load("../src/lib/public-ranking.ts");
const html = element => renderToStaticMarkup(element);

async function home() {
  const page = load("../src/app/page.tsx", { ...common, "@/components/date-list": { DateList }, "@/lib/fechas": { getPublishedDates: async () => [] } });
  return html(await page.default());
}
test("inicio público institucional, sin botones de autenticación ni logo repetido", async () => {
  const markup = await home();
  assert.match(markup, /El tenis de mesa que une a/);
  assert.match(markup, /Futrono, Paillaco, Panguipulli, Lago Ranco y La Unión/);
  assert.match(markup, /respeto y la cooperación/);
  assert.match(markup, /href="\/calendario"/); assert.match(markup, /href="\/ranking"/);
  assert.doesNotMatch(markup, /href="\/(login|registro)"|logo-liga-los-rios|Acceso a usuarios|Crear cuenta/);
  assert.match(markup, /Todavía no hay fechas publicadas/);
  assert.match(markup, /Crear una cuenta en esta PWA no equivale a una inscripción deportiva/);
});
test("hero contiene únicamente las dos acciones deportivas", async () => {
  const hero = (await home()).split("</section>")[0];
  assert.equal((hero.match(/<a /g) ?? []).length, 2);
  assert.match(hero, /Ver calendario/); assert.match(hero, /Consultar ranking/);
});
test("calendario renderiza sin auth ni consultas privadas", async () => {
  const page = load("../src/app/calendario/page.tsx", { ...common, "@/components/date-list": { DateList }, "@/lib/fechas": { getPublishedDates: async () => [] } });
  const markup = html(await page.default());
  assert.match(markup, /Calendario de competencias/);
  assert.match(markup, /No necesitas iniciar sesión/);
  assert.match(markup, /Todavía no hay fechas publicadas/);
});
test("ranking público sin Auth, conexión Supabase ni extracción externa", () => {
  const page = load("../src/app/ranking/page.tsx", { ...common, "@/components/public-ranking": board, "@/lib/public-ranking": config });
  const markup = html(page.default());
  assert.match(markup, /sin iniciar sesión/);
  assert.match(markup, /ranking interno aún no está disponible/);
  assert.ok(markup.includes(`href="${config.EXTERNAL_RANKING_URL}"`));
  assert.match(markup, /target="_blank" rel="noopener noreferrer"/);
  assert.match(markup, /seis mejores puntuaciones de siete fechas/);
  assert.doesNotMatch(markup, /<iframe|href="\/login"|<tbody>|<ol/);
});
test("ranking pendiente: filtros inactivos y estados sin ceros ni clasificaciones ficticias", () => {
  const markup = html(React.createElement(board.PublicRanking));
  assert.match(markup, /<fieldset disabled=""/);
  for (const label of ["Buscar jugador o ciudad", "Categoría", "Podio de la categoría", "Ranking acumulado", "Ranking de premiación", "Fechas disputadas"]) assert.ok(markup.includes(label), label);
  assert.doesNotMatch(markup, /<tbody>|<ol|0 puntos|0 jugadores/);
  assert.match(markup, /no se considera disputada ni puntuada/);
});
test("componente admite publicaciones explícitas sin calcular ni reordenar posiciones", () => {
  // Datos sintéticos exclusivos de prueba; nunca se entregan desde la ruta pública.
  const entry = { position: 7, name: "PRUEBA <segura>", origin: "Origen de prueba", points: 12 };
  const publication = { seasonLabel: "Temporada de prueba", updatedLabel: "Publicación de prueba", dates: ["Jornada de prueba"], categories: [{ id: "prueba", label: "Categoría de prueba", podium: [], accumulated: [entry], awards: [] }] };
  const markup = html(React.createElement(board.PublicRanking, { publication }));
  assert.match(markup, /PRUEBA &lt;segura&gt;/);
  assert.match(markup, /<td class="font-bold">7<\/td>/);
  assert.match(markup, /<td class="font-bold">12<\/td>/);
  assert.match(markup, /Jornada de prueba/);
  assert.match(markup, /No hay resultados para estos filtros/);
  assert.doesNotMatch(markup, /<fieldset disabled/);
});
test("registro continúa accesible desde login", () => {
  const { AuthForm } = load("../src/components/auth-form.tsx", { ...common, "next/image": { default: () => null }, "@/app/actions": { login: "/test-login", register: "/test-register" }, "@/app/recovery-actions": { requestRecovery: "/recover", resetPassword: "/reset" }, "@/components/auth-controls": { PasswordField: () => null, AuthSubmit: ({children}) => jsx.jsx("button", {children}) } });
  assert.match(html(React.createElement(AuthForm, { mode: "login" })), /href="\/registro"/);
});
test("consulta del calendario filtra solo fechas publicadas con cliente de sesión normal", async () => {
  const calls = [];
  const { getPublishedDates } = load("../src/lib/fechas.ts", { "@/lib/config": { supabaseConfigured: () => true }, "@/lib/supabase/server": { createClient: async () => ({ from(table) {
    assert.equal(table, "fechas");
    return { select(fields) { assert.equal(fields, "id, numero, fecha, comuna, recinto, estado"); return this; }, eq(...args) { calls.push(args); return this; }, order: async () => ({ data: [], error: null }) };
  } }) } });
  assert.deepEqual(await getPublishedDates(), []);
  assert.deepEqual(calls, [["estado", "publicada"]]);
});

