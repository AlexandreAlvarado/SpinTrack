export type SetScore = { a: number; b: number };
export type ResultKind = "ordinario" | "incomparecencia" | "retiro" | "suspension";
export type MatchResult = {
  id: number; partido_id: number; revision: number; tipo: ResultKind; sets: SetScore[];
  mejor_de: number; sets_a: number | null; sets_b: number | null; ganador_id: number | null;
  descripcion: string; referencia: string; referencia_reglas: string; motivo_correccion: string | null;
  autor_id: string; creado_en: string;
};
export type ResultEvent = { id: number; resultado_id: number; actor_id: string; ocurrido_en: string; referencia: string };

/** Mismo contrato que calcular_resultado_sets_012; PostgreSQL es la autoridad final. */
export function calculateSets(sets: unknown, bestOf: number): { a: number; b: number; winner: "a" | "b" } | { error: string } {
  if (![3, 5].includes(bestOf) || !Array.isArray(sets)) return { error: "Formato de sets inválido." };
  const target = Math.floor(bestOf / 2) + 1;
  if (sets.length < target || sets.length > bestOf) return { error: `Completa entre ${target} y ${bestOf} sets hasta definir un ganador.` };
  let a = 0, b = 0;
  for (let i = 0; i < sets.length; i++) {
    if (a === target || b === target) return { error: "No se admiten sets después de definir al ganador." };
    const score = sets[i];
    if (!score || typeof score !== "object" || Object.keys(score).sort().join(",") !== "a,b" ||
      ![score.a, score.b].every(n => Number.isInteger(n) && n >= 0 && n <= 2147483647)) return { error: `Set ${i + 1}: ingresa dos enteros no negativos.` };
    const high = Math.max(score.a, score.b), low = Math.min(score.a, score.b);
    if (!((high === 11 && low <= 9) || (high > 11 && high - low === 2))) return { error: `Set ${i + 1}: se gana a 11; desde 10–10 se exige diferencia de dos.` };
    if (score.a > score.b) a++; else b++;
  }
  return Math.max(a, b) === target ? { a, b, winner: a > b ? "a" : "b" } : { error: "El partido todavía no tiene ganador." };
}

export function parseSetInputs(rows: { a: string; b: string }[]): SetScore[] | { error: string } {
  const last = rows.findLastIndex(row => row.a !== "" || row.b !== "");
  const selected = rows.slice(0, last + 1);
  if (selected.some(row => !/^(0|[1-9]\d*)$/.test(row.a) || !/^(0|[1-9]\d*)$/.test(row.b))) return { error: "Completa ambos puntos en cada set, sin saltar sets. Usa enteros no negativos." };
  return selected.map(row => ({ a: Number(row.a), b: Number(row.b) }));
}
