import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const root = new URL("..", import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), "utf8");

test("puestos finales dependen de la final confirmada, no del orden de grupo", () => {
  const mod = new Module("ranking-simulation");
  const mocks = {
    "react/jsx-runtime": jsx,
    react: { useState: value => [value, () => {}], useMemo: fn => fn() },
    "next/link": { default: ({ children }) => children },
    "@/lib/ranking-hypotheses": {
      simulateSingleGroupFinal: () => ({ awards: [], pending: [] }),
      simulateRankingHypotheses: () => ({ awards: [], pending: [] }),
    },
  };
  mod.require = name => { assert.ok(Object.hasOwn(mocks, name), name); return mocks[name]; };
  mod._compile(ts.transpileModule(read("src/components/ranking-simulation.tsx"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, "ranking-simulation");
  const data = { candidate: { id: 1, label: "Local" }, candidates: [], championId: 2, finalistId: 3, championName: "Campeón", finalistName: "Finalista", finalized: true, matches: [], groupEliminations: [], participants: [
    { id: 1, name: "Semifinalista", groupPosition: 1, groupName: "Grupo A" },
    { id: 2, name: "Campeón", groupPosition: 2, groupName: "Grupo A" },
    { id: 3, name: "Finalista", groupPosition: 1, groupName: "Grupo B" },
  ] };
  const html = renderToStaticMarkup(mod.exports.RankingSimulation({ data }));
  assert.match(html, /Semifinalista<\/th><td[^>]*>Grupo A · 1.º de grupo/);
  assert.match(html, /Campeón<\/th><td[^>]*>Grupo A · 1.º lugar/);
  assert.match(html, /Finalista<\/th><td[^>]*>Grupo B · 2.º lugar/);
  const pending = renderToStaticMarkup(mod.exports.RankingSimulation({ data: { ...data, finalized: false } }));
  assert.doesNotMatch(pending, /[12]\.º lugar/);
});

test("la simulación administrativa lee jornada 8 y no escribe resultados", () => {
  const source = read("src/lib/ranking-simulation-data.ts");
  assert.match(source, /eq\("numero", 8\)/);
  assert.match(source, /consultar_clasificacion_grupo/);
  assert.match(source, /eliminatorias_partidos/);
  assert.match(source, /estado === "finalizado"/);
  assert.match(source, /posiciones === 2/);
  assert.match(source, /ganador_id === possibleBoard\.campeon_id/);
  assert.match(source, /filter\(item => item\.estado === "confirmada"\)/);
  assert.doesNotMatch(source, /insert\(|update\(|upsert\(|delete\(/);
  assert.match(read("src/app/panel/administrador/ranking/simulacion/page.tsx"), /process\.env\.NODE_ENV !== "production"/);
});

test("la vista separa puntos confirmados de hipótesis y conserva 100/97", () => {
  const source = read("src/components/ranking-simulation.tsx");
  assert.match(source, /id === data\.championId \? 100/);
  assert.match(source, /id === data\.finalistId \? 97/);
  assert.match(source, /grupos_15/);
  assert.match(source, /no oficial/);
  assert.match(source, /no forman parte del ranking oficial/);
});
