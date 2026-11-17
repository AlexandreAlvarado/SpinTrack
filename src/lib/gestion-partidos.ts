import type { MatchResult, ResultEvent } from "./resultados";

export type MatchStatus = "pendiente" | "revision" | "observado" | "confirmado";
export function matchStatus(id: number, results: MatchResult[], events: ResultEvent[], observations: { resultado_id: number }[]): MatchStatus {
  const current = results.filter(r => r.partido_id === id).sort((a, b) => b.revision - a.revision)[0];
  if (!current) return "pendiente";
  if (events.some(e => e.resultado_id === current.id)) return "confirmado";
  if (observations.some(o => o.resultado_id === current.id)) return "observado";
  return "revision";
}

export function matchSummary(matches: { id: number }[], results: MatchResult[], events: ResultEvent[], observations: { resultado_id: number }[], assignments: { partido_id: number; arbitro_id: string | null; activo?: boolean }[]) {
  const states = matches.map(m => matchStatus(m.id, results, events, observations));
  const assigned = matches.filter(m => assignments.some(a => a.partido_id === m.id && a.arbitro_id && a.activo !== false)).length;
  const count = (state: MatchStatus) => states.filter(s => s === state).length;
  const complete = matches.length > 0 && count("confirmado") === matches.length;
  return { total: matches.length, assigned, pending: count("pendiente"), review: count("revision"), observed: count("observado"), confirmed: count("confirmado"), complete,
    action: complete ? "Consultar clasificación" : !matches.length ? "Generar partidos" : count("revision") || count("observado") ? "Revisar resultados" : assigned < matches.length ? "Asignar árbitros" : "Revisar resultados" };
}

export function groupMatchProgress(groupId: number, matches: { id: number; grupo_id: number }[], results: MatchResult[], events: ResultEvent[], observations: { resultado_id: number }[]) {
  const groupMatches = matches.filter(match => match.grupo_id === groupId);
  const confirmed = groupMatches.filter(match => matchStatus(match.id, results, events, observations) === "confirmado").length;
  const review = groupMatches.filter(match => ["revision", "observado"].includes(matchStatus(match.id, results, events, observations))).length;
  return { total: groupMatches.length, confirmed, review, complete: groupMatches.length > 0 && confirmed === groupMatches.length };
}
