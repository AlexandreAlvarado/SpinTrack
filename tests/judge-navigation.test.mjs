import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("..", import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), "utf8");

test("navegación del Juez sigue la secuencia aprobada y no enlaza módulos futuros", () => {
  const source = read("src/components/judge-navigation.tsx");
  const order = ["Mi panel", "1. Preparar competencia", "2. Gestionar partidos", "3. Clasificación y eliminatorias", "Herramientas avanzadas y consultas", "Preparación deportiva", "Habilitaciones deportivas", "Participantes confirmados", "Organización de grupos", "Programación de partidos", "Resultados por set", "Clasificación de grupos", "Calendario de jornadas", "Inicio público"];
  let cursor = -1;
  for (const label of order) {
    const index = source.indexOf(label);
    assert.ok(index > cursor, `orden faltante: ${label}`);
    cursor = index;
  }
  assert.match(source, /href=\{href\("\/panel\/juez-general\/grupos"\)\}/);
  assert.match(source, /href=\{href\("\/panel\/juez-general\/partidos"\)\}/);
  assert.match(source, /href=\{href\("\/panel\/juez-general\/resultados"\)\}/);
  assert.ok(source.includes('href={href("/panel/juez-general/clasificacion")}'));
});

test("panel del Juez conserva estados por competencia y selector contextual", () => {
  const source = read("src/app/panel/juez-general/page.tsx");
  assert.match(source, /selected = competitions\.find/);
  assert.match(source, /participantCount\(competition\.id\)/);
  assert.match(source, /siguiente acción|Preparación pendiente|Confirmar participantes/);
  assert.match(read("src/components/judge-context-selector.tsx"), /router\.push/);
});

test("participantes distingue error de consulta de competencia no publicada y disponibilidad", () => {
  const source = read("src/app/panel/juez-general/participantes/page.tsx");
  assert.match(source, /competencia_control_deportivo/);
  assert.match(source, /result\.error\.code/);
  assert.match(source, /failedReason/);
  assert.match(source, /competencia individual no está publicada o activa/);
  assert.match(source, /habilitaciones_jugador_categoria/);
});

test("organización de grupos usa solo nómina confirmada y exige confirmación", () => {
  const page = read("src/app/panel/juez-general/grupos/page.tsx");
  const component = read("src/components/group-organizer.tsx");
  const migration = read("supabase/migrations/010_organizacion_grupos.sql");
  assert.match(page, /participantes_competencia/);
  assert.match(component, /Confirmar grupos/);
  assert.match(component, /Sin propuesta|Borrador guardado|Grupos confirmados/);
  assert.match(component, /Propuesta generada localmente/);
  assert.match(component, /Historial y referencias/);
  assert.match(component, /router\.refresh/);
  assert.match(page, /persistedStatus/);
  assert.match(page, /history/);
  assert.match(component, /distribution/);
  assert.match(migration, /guardar_grupos_competencia/);
  assert.match(migration, /confirmar_grupos_competencia/);
  assert.match(migration, /estado='confirmado'/);
  assert.match(migration, /La propuesta debe incluir exactamente toda la nómina confirmada/);
});



test("resultados ordena asignaciones por su clave real y conserva errores de lectura", () => {
  const page = read("src/app/panel/juez-general/resultados/page.tsx");
  const refereePage = read("src/app/panel/arbitro/resultados/page.tsx");
  const migration = read("supabase/migrations/013_asignaciones_arbitros_resultados.sql");
  assert.ok(page.includes('orderColumn = "id"'));
  assert.ok(refereePage.includes('eq("arbitro_id", profile.id).eq("activo", true)'));
  assert.ok(refereePage.includes('if (assignment.error) throw new Error'));
  assert.doesNotMatch(refereePage, /fecha.*\.(eq|lt|lte|gt|gte)\(/);
  assert.ok(page.includes('readResultRows<MatchAssignment>("partidos_arbitros", "partido_id,arbitro_id,activo", "partido_id", matchIds, "partido_id")'));
  assert.ok(page.includes('<MatchManagement'));
  assert.ok(read('src/components/match-management.tsx').includes('<RefereeAssignment'));
  assert.ok(page.includes('if (response.error) throw new Error('));
  assert.ok(page.includes('failed &&'));
  assert.ok(page.includes('No se muestran partidos porque la lectura desde Supabase falló'));
  assert.ok(migration.includes('partidos_arbitros (\n  partido_id bigint primary key'));
});

test("panel falla cerrado y detecta grupos y lotes persistidos", () => {
 const page = read("src/app/panel/juez-general/page.tsx");
 assert.ok(page.includes('selected && !failed'));
 assert.ok(page.includes('table === "competencia_control_deportivo" ? "competencia_id" : "id"'));
 assert.ok(page.includes('competitionGroups.some(item => item.estado !== "confirmado")'));
 assert.ok(page.includes('lot.estado !== "confirmado"'));
 assert.ok(page.includes('selectedLot'));
 assert.ok(page.includes('JudgeContextSelector'));
 assert.ok(page.includes('Eliminatorias: próxima etapa'));
});
