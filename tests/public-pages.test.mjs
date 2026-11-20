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
  mod.require = name => { if (name === "@/lib/legal" && !Object.hasOwn(mocks, name)) return { LEGAL_REVIEW_PENDING: false, PERSONAL_DATA_REVIEW_PENDING: false }; assert.ok(Object.hasOwn(mocks, name), `Dependencia inesperada: ${name}`); return mocks[name]; };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const link = { default: ({ children, ...props }) => jsx.jsx("a", { ...props, children }) };
const icons = Object.fromEntries(["ArrowRight", "CalendarDays", "MapPin", "Trophy", "Users", "HeartHandshake", "GraduationCap", "ExternalLink"].map(name => [name, () => null]));
const common = { "react/jsx-runtime": jsx, "next/link": link, "lucide-react": icons };
const { DateList } = load("../src/components/date-list.tsx", { ...common, "@/lib/format": { formatDate: value => value } });
const ranking = load("../src/lib/ranking.ts");
const board = load("../src/components/public-ranking.tsx", { ...common, react: React, "@/lib/ranking": ranking });
const html = element => renderToStaticMarkup(element);
const publicData = { temporadas: [], jornadas: [], competencias: [], detalle: null };
const tournaments = load("../src/lib/public-tournaments.ts", { "@/lib/config": { supabaseConfigured: () => false }, "@/lib/supabase/server": {} });
const publicMocks = { "@/lib/public-tournaments": { ...tournaments, getPublicTournaments: async () => ({ data: publicData, unavailable: false }) }, "@/components/public-tournament": { CompetitionCards: () => null, PublicReadNotice: () => null } };

async function home() {
  const page = load("../src/app/page.tsx", { ...common, ...publicMocks, "@/components/date-list": { DateList } });
  return html(await page.default());
}
test("inicio público institucional, sin botones de autenticación ni logo repetido", async () => {
  const markup = await home();
  assert.match(markup, /El tenis de mesa que une a/);
  assert.match(markup, /Futrono, Paillaco, Panguipulli, Lago Ranco y La Unión/);
  assert.match(markup, /respeto y la cooperación/);
  assert.match(markup, /href="\/calendario"/); assert.match(markup, /href="\/ranking"/);
  assert.doesNotMatch(markup, /href="\/(login|registro)"|logo-liga-los-rios|Acceso a usuarios|Crear cuenta/);
  assert.match(markup, /No hay próximas jornadas publicadas/);
  assert.match(markup, /Crear una cuenta en esta PWA no equivale a una inscripción deportiva/);
});
test("hero contiene únicamente las dos acciones deportivas", async () => {
  const hero = (await home()).split("</section>")[0];
  assert.equal((hero.match(/<a /g) ?? []).length, 2);
  assert.match(hero, /Ver calendario/); assert.match(hero, /Consultar ranking/);
});
test("calendario renderiza sin auth ni consultas privadas", async () => {
  const page = load("../src/app/calendario/page.tsx", { ...common, ...publicMocks, "@/components/date-list": { DateList } });
  const markup = html(await page.default({ searchParams: Promise.resolve({}) }));
  assert.match(markup, /Calendario de competencias/);
  assert.match(markup, /No necesitas iniciar sesión/);
  assert.match(markup, /Todavía no hay fechas publicadas/);
});
test("ranking público sin Auth ni extracción externa, con RPC público", async () => {
  const page = load("../src/app/ranking/page.tsx", { ...common, "@/components/public-ranking": board, "@/lib/ranking-data": { getSeasonRanking: async () => ({ scopes: [], unavailable: false }) } });
  const markup = html(await page.default());
  assert.match(markup, /sin iniciar sesión/);
  assert.match(markup, /Pendiente de configuración autorizada/);
  assert.match(markup, /seis mejores puntuaciones de siete fechas/);
  assert.doesNotMatch(markup, /<iframe|href="\/login"|netlify|<tbody>|<ol/);
});
test("ranking pendiente sin ceros ni clasificaciones ficticias", () => {
  const markup = html(React.createElement(board.PublicRanking));
  assert.doesNotMatch(markup, /<tbody>|<ol|0 puntos|0 jugadores/);
  assert.match(markup, /Pendiente de configuración autorizada/);
});
test("ranking calcula publicación confirmada, accesible y compacta", () => {
  const scope = { id: 1, seasonId: 1, seasonLabel: "Temporada de prueba", label: "Categoría autorizada de prueba", dates: Array.from({ length: 7 }, (_, i) => ({ id: i + 1, number: i + 1, label: `Fecha ${i + 1}`, complete: false })), results: [{ playerId: 1, name: "PRUEBA <segura>", date: 1, place: 1, points: 100, state: "confirmado" }] };
  const markup = html(React.createElement(board.PublicRanking, { scopes: [scope] }));
  assert.match(markup, /PRUEBA &lt;segura&gt;/);
  for (const label of ["Temporada", "Categoría / modalidad individual", "Jugador", "Total 7", "Mejores 6", "Desempate / estado", "Provisional"]) assert.ok(markup.includes(label), label);
  assert.equal((markup.match(/title="Fecha pendiente"/g) ?? []).length, 7);
  assert.match(markup, /overflow-x-auto/);assert.match(markup, /role="region"/);
});
test("registro continúa accesible desde login", () => {
  const { AuthForm } = load("../src/components/auth-form.tsx", { ...common, "@/lib/legal": { LEGAL_VERSION: "2026-11-19.1" }, "next/image": { default: () => null }, "@/app/actions": { login: "/test-login", register: "/test-register" }, "@/app/recovery-actions": { requestRecovery: "/recover", resetPassword: "/reset" }, "@/components/auth-controls": { PasswordField: () => null, AuthSubmit: ({children}) => jsx.jsx("button", {children}) } });
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

