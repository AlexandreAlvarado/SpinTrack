import { createClient } from "@/lib/supabase/server";
import { type HypothesisMatch, type HypothesisSnapshot } from "@/lib/ranking-hypotheses";

export type RankingSimulationCandidate = { id: number; label: string; dateId: number; dateNumber: number; categoryLabel: string };
export type RankingSimulationData = {
  candidate: RankingSimulationCandidate;
  candidates: RankingSimulationCandidate[];
  participants: { id: number; name: string; groupPosition: number; groupName: string; eliminatedInGroups: boolean }[];
  championId: number | null;
  finalistId: number | null;
  championName: string | null;
  finalistName: string | null;
  finalized: boolean;
  matches: HypothesisMatch[];
  groupEliminations: HypothesisSnapshot["groupEliminations"];
  singleGroup?: NonNullable<HypothesisSnapshot["singleGroup"]>;
  warning?: string;
};

type Group = { id: number; numero: number };
type Key = { id: number; competencia_id: number; estado: string; posiciones: number; propuesta: { version_regla?: number } | null };
type Round = { id: number; posiciones: number };
type Match = { id: number; ronda_id: number; ronda_numero: number; jugador_a_id: number | null; jugador_b_id: number | null; ganador_id: number | null; perdedor_id: number | null; estado: string };
type Board = { campeon_id: number | null; finalista_id: number | null; estado: string };
type CompetitionParticipant = { jugador_id: number };
type GroupParticipant = { jugador_id: number };

const readAll = async <T,>(db: Awaited<ReturnType<typeof createClient>>, table: string, columns: string, field: string, value: number) => {
  const result = await db.from(table).select(columns).eq(field, value).order("id");
  if (result.error) throw result.error;
  return (result.data ?? []) as T[];
};

export async function loadRankingSimulation(selectedId: number | null = null): Promise<RankingSimulationData | { candidates: RankingSimulationCandidate[]; warning: string }> {
  const db = await createClient();
  const dates = await db.from("fechas").select("id,temporada_id,numero,fecha").eq("numero", 8).order("id");
  if (dates.error) throw dates.error;
  const categories = await db.from("categorias_temporada").select("id,categoria_id,rama,codigo").in("temporada_id", [...new Set((dates.data ?? []).map(date => date.temporada_id as number))]);
  if (categories.error) throw categories.error;
  const catalog = await db.from("categorias").select("id,nombre,codigo");
  if (catalog.error) throw catalog.error;
  const categoryMap = new Map((catalog.data ?? []).map(item => [item.id as number, item]));
  const categoryRows = (categories.data ?? []).filter(category => {
    const label = `${category.codigo ?? ""} ${categoryMap.get(category.categoria_id as number)?.codigo ?? ""} ${categoryMap.get(category.categoria_id as number)?.nombre ?? ""}`.toUpperCase();
    return label.includes("PENECA") && label.includes("INICIAL");
  });
  const candidates: RankingSimulationCandidate[] = [];
  for (const date of dates.data ?? []) {
    const categoryIds = new Set(categoryRows.filter(category => category).map(category => category.id as number));
    const competitions = await db.from("competencias").select("id,fecha_id,categoria_temporada_id").eq("fecha_id", date.id).order("id");
    if (competitions.error) throw competitions.error;
    for (const competition of competitions.data ?? []) {
      if (!categoryIds.has(competition.categoria_temporada_id as number)) continue;
      const category = categoryRows.find(item => item.id === competition.categoria_temporada_id);
      const catalogItem = category ? categoryMap.get(category.categoria_id as number) : null;
      const categoryLabel = `${catalogItem?.nombre ?? category?.codigo ?? "Peneca Inicial"}${category?.rama ? ` · ${category.rama}` : ""}`;
      candidates.push({ id: competition.id as number, label: `${categoryLabel} · Jornada 8 · competencia #${competition.id}`, dateId: date.id as number, dateNumber: 8, categoryLabel });
    }
  }
  const candidate = candidates.find(item => item.id === selectedId) ?? (candidates.length === 1 ? candidates[0] : undefined);
  if (!candidate) return { candidates, warning: candidates.length ? "Selecciona la competencia Peneca Inicial de la jornada 8." : "No se encontró una competencia Peneca Inicial en la jornada 8." };

  const groups = await readAll<Group>(db, "grupos_competencia", "id,numero", "competencia_id", candidate.id);
  const standings = [] as { group: Group; data: { filas: { jugador_id: number; nombre_completo: string }[]; aprobable?: boolean; aprobacion?: { vigente?: boolean } | null } }[];
  for (const group of groups) {
    const result = await db.rpc("consultar_clasificacion_grupo", { p_grupo_id: group.id });
    if (result.error || !result.data) throw result.error ?? new Error("Clasificación sin respuesta");
    standings.push({ group, data: result.data as typeof standings[number]["data"] });
  }
  const keys = await readAll<Key>(db, "eliminatorias_llaves", "id,competencia_id,estado,posiciones,propuesta", "competencia_id", candidate.id);
  const confirmedKeys = keys.filter(item => item.estado === "confirmada").sort((a, b) => b.id - a.id);
  let key: Key | null = null;
  let board: Board | null = null;
  let matches: Match[] = [];
  let finalRound: Round | null = null;
  for (const possible of confirmedKeys) {
    const [boardResult, rounds] = await Promise.all([
      db.from("eliminatorias_cuadros").select("campeon_id,finalista_id,estado").eq("llave_id", possible.id).maybeSingle(),
      readAll<Round>(db, "eliminatorias_rondas", "id,posiciones", "llave_id", possible.id),
    ]);
    if (boardResult.error) throw boardResult.error;
    const possibleBoard = boardResult.data as Board | null;
    const possibleFinalRound = rounds.find(round => round.posiciones === 2) ?? null;
    const possibleMatches = await readAll<Match>(db, "eliminatorias_partidos", "id,ronda_id,ronda_numero,jugador_a_id,jugador_b_id,ganador_id,perdedor_id,estado", "llave_id", possible.id);
    const hasConfirmedFinal = !!possibleBoard && possibleBoard.estado === "finalizado" && possibleFinalRound !== null && possibleMatches.some(match => match.ronda_id === possibleFinalRound!.id && match.estado === "confirmado" && match.ganador_id === possibleBoard.campeon_id && match.perdedor_id === possibleBoard.finalista_id);
    if (!key || hasConfirmedFinal) { key = possible; board = possibleBoard; matches = possibleMatches; finalRound = possibleFinalRound; }
    if (hasConfirmedFinal) break;
  }
  const championId = board?.campeon_id ?? null;
  const finalistId = board?.finalista_id ?? null;
  const finalized = !!key && board?.estado === "finalizado" && finalRound !== null && championId !== null && finalistId !== null && matches.some(match => match.ronda_id === finalRound.id && match.estado === "confirmado" && match.ganador_id === championId && match.perdedor_id === finalistId);
  const playerIds = [...new Set(standings.flatMap(item => item.data.filas.map(row => row.jugador_id)).concat([championId, finalistId].filter((id): id is number => id !== null)))];
  const players = playerIds.length ? await db.from("jugadores").select("id,nombre_completo").in("id", playerIds) : { data: [], error: null };
  if (players.error) throw players.error;
  const names = new Map((players.data ?? []).map(player => [player.id as number, player.nombre_completo as string]));
  const participants = standings.flatMap(({ group, data }) => data.filas.map((row, index) => ({ id: row.jugador_id, name: names.get(row.jugador_id) ?? row.nombre_completo, groupPosition: index + 1, groupName: `Grupo ${group.numero}`, eliminatedInGroups: index >= 2 })));
  const groupEliminations = standings.flatMap(({ data }) => data.filas.slice(2).map(row => ({ playerId: row.jugador_id, classificationApproved: data.aprobacion?.vigente === true, current: data.aprobacion?.vigente === true })));
  let singleGroup: RankingSimulationData["singleGroup"];
  if (groups.length === 1) {
    const [competitionParticipants, groupParticipants] = await Promise.all([
      readAll<CompetitionParticipant>(db, "participantes_competencia", "jugador_id", "competencia_id", candidate.id),
      readAll<GroupParticipant>(db, "grupo_participantes", "jugador_id", "grupo_id", groups[0].id),
    ]);
    const participantIds = [...new Set(groupParticipants.map(item => item.jugador_id))];
    const competitionIds = [...new Set(competitionParticipants.map(item => item.jugador_id))];
    const groupData = standings[0]?.data;
    const standingsIds = groupData?.filas.map(row => row.jugador_id) ?? [];
    singleGroup = {
      participantIds,
      standings: standingsIds,
      finalistIds: [championId, finalistId].filter((id): id is number => id !== null),
      groupCount: groups.length,
      classificationApproved: groupData?.aprobable === true && groupData.aprobacion?.vigente === true && participantIds.length === 4 && participantIds.every(id => competitionIds.includes(id)) && competitionIds.length === participantIds.length,
      current: groupData?.aprobacion?.vigente === true,
    };
  }
  return { candidate, candidates, participants, championId, finalistId, championName: championId === null ? null : names.get(championId) ?? null, finalistName: finalistId === null ? null : names.get(finalistId) ?? null, finalized, matches: matches.filter(match => match.ronda_id === finalRound?.id && match.jugador_a_id !== null && match.jugador_b_id !== null && match.ganador_id !== null && match.perdedor_id !== null).map(match => ({ id: match.id, roundSize: 2, winnerId: match.ganador_id!, loserId: match.perdedor_id!, confirmed: match.estado === "confirmado" && match.ganador_id === championId && match.perdedor_id === finalistId })), groupEliminations, singleGroup };
}
