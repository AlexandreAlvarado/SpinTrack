/** Preparación técnica exclusivamente para simulaciones. Sin autorización ni escritura. */
export const PENDING_RANKING_RULES = [
  { id: "eliminador_3_8", label: "Puestos 3.º–8.º según quién eliminó al jugador", description: "Semifinales según campeón/subcampeón; cuartos según los cuatro primeros. Hipótesis sin autorización deportiva." },
  { id: "grupos_15", label: "15 puntos por eliminación en grupos", description: "Observación reportada del Excel Ranking Liga Regional 6.0. No definida expresamente en las Bases 2026." },
  { id: "ronda_64_71", label: "71 puntos para la banda 33.º–64.º", description: "Hipótesis reportada por distribución de puntajes en TC Federado y TC Aficionado. No acredita puestos ni autorización." },
] as const;
export type HypothesisId = typeof PENDING_RANKING_RULES[number]["id"];
export type HypothesisOptions = Readonly<Partial<Record<HypothesisId, boolean>>>;
export type HypothesisMatch = Readonly<{ id: number; roundSize: number; winnerId: number; loserId: number; confirmed: boolean }>;
export type HypothesisSnapshot = Readonly<{
  competitionId: number;
  finalized: boolean;
  matches: readonly HypothesisMatch[];
  /** Copia de no clasificados de clasificaciones de grupos aprobadas y vigentes.
   * Ausencia de llave o de partido NO prueba eliminación en grupos. */
  groupEliminations: readonly Readonly<{ playerId: number; classificationApproved: boolean; current: boolean }>[];
  singleGroup?: Readonly<{
    participantIds: readonly number[];
    standings: readonly number[];
    finalistIds: readonly number[];
    groupCount: number;
    classificationApproved: boolean;
    current: boolean;
  }>;
}>;
export type SingleGroupAward = Readonly<{ playerId: number; place: 1 | 2 | 3 | 4; hypotheticalPoints: 100 | 97 | 95 | 93; state: "hipotesis_no_autorizada" }>;
export type HypotheticalAward = Readonly<{
  competitionId: number; playerId: number; rule: HypothesisId;
  state: "hipotesis_no_autorizada"; place: number | null;
  band: readonly [number, number] | null; hypotheticalPoints: number;
  sourceMatchIds: readonly number[];
}>;

/** Contrato de futura autorización versionada, no una habilitación operativa.
 * Requiere persistencia, verificación de roles y respaldo antes de conectarlo a RPC.
 * Nunca se acepta un booleano del navegador como autorización. */
export type FutureRankingAuthorization = Readonly<{
  rule: HypothesisId; version: number; seasonId: number; categorySeasonId: number;
  officialDateIds: readonly number[]; authority: string; documentReference: string;
  registeredBy: string; registeredAt: string; supersedesVersion: number | null;
  historicalApplication: "solo_fechas_indicadas";
}>;

/** Interpretación de desarrollo para una competencia de un solo grupo de cuatro.
 * Los puestos 3.º/4.º requieren confirmación de Liga y nunca entran al ranking oficial. */
export function simulateSingleGroupFinal(snapshot: HypothesisSnapshot): { mode: "simulacion_no_oficial"; awards: readonly SingleGroupAward[]; pending: readonly string[] } {
  const group = snapshot.singleGroup;
  const pending: string[] = [];
  if (!group || group.groupCount !== 1) return { mode: "simulacion_no_oficial", awards: [], pending: ["La regla de grupo único solo aplica a exactamente un grupo."] };
  if (group.participantIds.length !== 4 || new Set(group.participantIds).size !== 4 || group.standings.length !== 4 || new Set(group.standings).size !== 4 || group.standings.some(id => !group.participantIds.includes(id))) {
    pending.push("El grupo único no contiene exactamente cuatro participantes coincidentes con la competencia.");
  }
  if (!group.classificationApproved || !group.current) pending.push("La clasificación del grupo único no está aprobada y vigente.");
  if (group.finalistIds.length !== 2 || new Set(group.finalistIds).size !== 2 || group.finalistIds.some(id => !group.standings.slice(0, 2).includes(id))) pending.push("Los finalistas no coinciden con los dos primeros clasificados del grupo.");
  const final = snapshot.matches.filter(match => match.roundSize === 2);
  if (!snapshot.finalized || final.length !== 1 || !final[0].confirmed) pending.push("La final independiente no está confirmada.");
  if (final.length === 1 && (!group.finalistIds.includes(final[0].winnerId) || !group.finalistIds.includes(final[0].loserId) || final[0].winnerId === final[0].loserId)) pending.push("El resultado final no coincide con los dos clasificados del grupo.");
  if (pending.length) return { mode: "simulacion_no_oficial", awards: [], pending };
  const [champion, finalist, third, fourth] = [final[0].winnerId, final[0].loserId, group.standings[2], group.standings[3]] as const;
  return { mode: "simulacion_no_oficial", awards: [
    { playerId: champion, place: 1, hypotheticalPoints: 100, state: "hipotesis_no_autorizada" },
    { playerId: finalist, place: 2, hypotheticalPoints: 97, state: "hipotesis_no_autorizada" },
    { playerId: third, place: 3, hypotheticalPoints: 95, state: "hipotesis_no_autorizada" },
    { playerId: fourth, place: 4, hypotheticalPoints: 93, state: "hipotesis_no_autorizada" },
  ], pending };
}

/** La salida no es RankingResult: no tiene puntos oficiales ni estado confirmado.
 * Opciones omitidas = todas deshabilitadas. No se importa en la consulta pública. */
export function simulateRankingHypotheses(snapshot: HypothesisSnapshot, options: HypothesisOptions = {}) {
  const awards: HypotheticalAward[] = [];
  const pending: string[] = [];
  const result = () => ({ mode: "simulacion_no_oficial" as const, awards, pending });
  if (!Object.values(options).some(Boolean)) return result();
  const validId = (id: number) => Number.isSafeInteger(id) && id > 0;
  if (!validId(snapshot.competitionId) || snapshot.matches.some(m => !validId(m.id) || !validId(m.winnerId) || !validId(m.loserId) || m.winnerId === m.loserId || !Number.isInteger(Math.log2(m.roundSize)) || m.roundSize < 2)
    || new Set(snapshot.matches.map(m => m.id)).size !== snapshot.matches.length
    || new Set(snapshot.matches.map(m => m.loserId)).size !== snapshot.matches.length
    || snapshot.groupEliminations.some(g => !validId(g.playerId))
    || new Set(snapshot.groupEliminations.map(g => g.playerId)).size !== snapshot.groupEliminations.length) throw new Error("Fuente de simulación incoherente");
  if (!snapshot.finalized || snapshot.matches.some(m => !m.confirmed)) {
    pending.push("Competencia o resultados pendientes de confirmación."); return result();
  }
  for (const size of new Set(snapshot.matches.map(m => m.roundSize))) {
    const players = snapshot.matches.filter(m => m.roundSize === size).flatMap(m => [m.winnerId, m.loserId]);
    if (new Set(players).size !== players.length) throw new Error("Jugador repetido en una ronda");
  }
  const finals = snapshot.matches.filter(m => m.roundSize === 2);
  if (finals.length !== 1) { pending.push("Se requiere una final confirmada inequívoca."); return result(); }
  const final = finals[0];
  // Un eliminado no puede ganar ni participar en una ronda posterior a su derrota.
  if (snapshot.matches.some(m => snapshot.matches.some(other => other.roundSize < m.roundSize && (other.winnerId === m.loserId || other.loserId === m.loserId)))) throw new Error("Avance incompatible con eliminación directa");
  const add = (playerId: number, rule: HypothesisId, points: number, place: number | null, band: readonly [number, number] | null, matches: readonly number[]) => {
    if (awards.some(a => a.playerId === playerId)) throw new Error("Jugador con adjudicaciones hipotéticas incompatibles");
    awards.push({ competitionId: snapshot.competitionId, playerId, rule, state: "hipotesis_no_autorizada", place, band, hypotheticalPoints: points, sourceMatchIds: matches });
  };
  if (options.eliminador_3_8) {
    const semis = snapshot.matches.filter(m => m.roundSize === 4);
    const third = semis.find(m => m.winnerId === final.winnerId);
    const fourth = semis.find(m => m.winnerId === final.loserId);
    const four = third && fourth ? [final.winnerId, final.loserId, third.loserId, fourth.loserId] : [];
    if (semis.length !== 2 || four.length !== 4 || new Set(four).size !== 4) pending.push("3.º/4.º: faltan dos semifinales reales compatibles; no inferir puestos con pases.");
    else {
      add(third!.loserId, "eliminador_3_8", 95, 3, null, [third!.id, final.id]);
      add(fourth!.loserId, "eliminador_3_8", 93, 4, null, [fourth!.id, final.id]);
      const quarters = snapshot.matches.filter(m => m.roundSize === 8);
      const ordered = four.map(id => quarters.find(m => m.winnerId === id));
      if (quarters.length !== 4 || ordered.some(m => !m) || new Set([...four, ...quarters.map(m => m.loserId)]).size !== 8) pending.push("5.º–8.º: faltan cuatro cuartos reales compatibles; no inferir puestos con pases.");
      else ordered.forEach((m, i) => add(m!.loserId, "eliminador_3_8", [90, 88, 86, 84][i], i + 5, null, [m!.id, third!.id, fourth!.id, final.id]));
    }
  }
  if (options.grupos_15) {
    for (const g of snapshot.groupEliminations) {
      if (!g.classificationApproved || !g.current) { pending.push(`Jugador ${g.playerId}: clasificación de grupos pendiente u obsoleta.`); continue; }
      if (snapshot.matches.some(m => m.winnerId === g.playerId || m.loserId === g.playerId)) throw new Error("Un participante de llave no prueba eliminación en grupos");
      add(g.playerId, "grupos_15", 15, null, null, []);
    }
  }
  if (options.ronda_64_71) {
    const round = snapshot.matches.filter(m => m.roundSize === 64);
    const full = [64, 32, 16, 8, 4, 2].every(size => {
      const matches = snapshot.matches.filter(m => m.roundSize === size);
      const next = snapshot.matches.filter(m => m.roundSize === size / 2).flatMap(m => [m.winnerId, m.loserId]);
      return matches.length === size / 2 && (size === 2 || matches.every(m => next.includes(m.winnerId)));
    }) && !snapshot.matches.some(m => m.roundSize > 64);
    if (!full) pending.push("33.º–64.º: se requiere cuadro inicial completo de 64, sin pases; otros casos pendientes de interpretación.");
    else for (const m of round) add(m.loserId, "ronda_64_71", 71, null, [33, 64], [m.id, final.id]);
  }
  return result();
}
