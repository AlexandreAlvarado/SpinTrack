/** Bases 2026 §7 y §9. Nombres e IDs no son desempates deportivos. */
export const RANKING_POINTS = [100, 97, 95, 93, 90, 88, 86, 84] as const;
export function pointsForPlace(place: number): number | null {
  if (!Number.isInteger(place) || place < 1 || place > 32) return null;
  return place <= 8 ? RANKING_POINTS[place - 1] : place <= 16 ? 81 : 78;
}
export type RankingResult = { playerId: number; name: string; date: number; points: number | null; place: number | null; state: "confirmado" | "resultado_pendiente" | "resolucion_pendiente" | "sin_escala" };
export type RankingScope = { id: number; seasonId: number; seasonLabel: string; label: string; dates: { id: number; number: number; label: string; complete: boolean }[]; results: RankingResult[] };
export type RankingRow = { playerId: number; name: string; dates: (RankingResult | null)[]; total: number; valid: number; wins: number; position: number | null; tie: string; pending: boolean };

export function calculateRanking(scope: RankingScope): { rows: RankingRow[]; provisional: boolean } {
  if (scope.dates.length !== 7 || new Set(scope.dates.map(d => d.number)).size !== 7 || scope.dates.some(d => !Number.isInteger(d.number) || d.number < 1 || d.number > 7)) throw new Error("Padrón oficial inválido");
  const people = new Map<number, RankingRow>();
  const seen = new Set<string>();
  for (const result of scope.results) {
    if (!Number.isSafeInteger(result.playerId) || result.playerId < 1 || !scope.dates.some(d => d.number === result.date)) throw new Error("Resultado fuera del padrón");
    const key = `${result.playerId}:${result.date}`;
    if (seen.has(key)) throw new Error("Resultado duplicado entre jornadas");
    seen.add(key);
    if (result.state === "confirmado") {
      if (result.points === null || (result.place !== null ? pointsForPlace(result.place) !== result.points : ![81, 78].includes(result.points))) throw new Error("Puntuación oficial inválida");
    } else if (result.points !== null || result.place !== null) throw new Error("Resultado pendiente con puntuación");
    let row = people.get(result.playerId);
    if (!row) {
      row = { playerId: result.playerId, name: result.name, dates: scope.dates.map(() => null), total: 0, valid: 0, wins: 0, position: 0, tie: "Sin empate", pending: false };
      people.set(result.playerId, row);
    }
    row.dates[scope.dates.findIndex(d => d.number === result.date)] = result;
    if (result.state === "confirmado") { row.total += result.points!; row.wins += Number(result.place === 1); }
    if (["resultado_pendiente", "resolucion_pendiente"].includes(result.state)) row.pending = true;
  }
  const all = [...people.values()];
  const rows = all.filter(row => row.dates.some(r => r?.state === "confirmado"));
  const unscored = all.filter(row => !row.dates.some(r => r?.state === "confirmado"));
  for (const row of rows) row.valid = row.dates.flatMap(r => r?.state === "confirmado" ? [r.points!] : []).sort((a, b) => b - a).slice(0, 6).reduce((a, b) => a + b, 0);
  rows.sort((a, b) => b.valid - a.valid);
  let offset = 0;
  while (offset < rows.length) {
    let end = offset + 1;
    while (end < rows.length && rows[end].valid === rows[offset].valid) end++;
    const group = rows.slice(offset, end);
    const podium = offset < 3;
    if (podium) group.sort((a, b) => b.total - a.total || b.wins - a.wins);
    let position = offset + 1;
    group.forEach((row, index) => {
      const previous = group[index - 1];
      if (previous && podium && (row.total !== previous.total || row.wins !== previous.wins)) position = offset + index + 1;
      row.position = position;
      const same = group.filter(other => !podium || (other.total === row.total && other.wins === row.wins));
      row.tie = group.length === 1 ? "Sin empate" : !podium ? "Empate compartido · sin criterio autorizado" : same.length > 1 ? "Pendiente de partido de definición autorizado" : group.some(other => other !== row && other.total === row.total) ? "Desempate por primeros lugares" : "Desempate por total de siete fechas";
    });
    group.sort((a, b) => a.position! - b.position! || a.name.localeCompare(b.name, "es") || a.playerId - b.playerId);
    rows.splice(offset, group.length, ...group);
    offset = end;
  }
  for (const row of unscored) { row.position = null; row.tie = "Sin puntuación confirmada"; }
  return { rows: [...rows, ...unscored], provisional: scope.dates.some(d => !d.complete) || all.some(r => r.pending) };
}
