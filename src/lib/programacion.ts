export type ScheduledMatch = {
  tipo: "grupo" | "eliminatoria"; id: number; competencia_id: number;
  a: number | null; b: number | null; nombre_a: string | null; nombre_b: string | null;
  perfil_a: string | null; perfil_b: string | null; arbitro_id: string | null;
  estado: string; elegible: boolean; inicio: string | null;
};
export type Table = { id: number; numero: number; estado: "disponible" | "fuera_servicio" };
export type Booking = { id: number; version?: number; arbitro_id?: string; descanso_minutos?: number; liberado_en?: string | null; mesa_id: number; tipo: string; partido: number; inicio: string; fin: string; estado: string; jugadores: number[]; perfiles: string[] };
export type Referee = { id: string; nombre: string };
export type Allocation = { tipo: string; partido: number; mesa_id: number; arbitro_id: string; inicio: string; fin: string };
export type ScheduleData = { mesas: Table[]; partidos: ScheduledMatch[]; reservas: Booking[]; arbitros: Referee[]; historial: { id: number; evento: string; ocurrido_en: string; motivo: string }[] };
export const matchKey = (m: { tipo: string; id: number }) => `${m.tipo}:${m.id}`;
const active = (r: Booking) => !["liberada", "cancelada"].includes(r.estado);
// En juego/revisión: el fin estimado nunca libera recursos.
const overlaps = (r: Booking, start: number, end: number, rest: number) =>
  start < (["en_juego", "revision"].includes(r.estado) ? Infinity : Date.parse(r.estado === "liberada" ? r.liberado_en ?? r.fin : r.fin) + Math.max(rest, (r.descanso_minutos ?? 0) * 60000)) && end + rest > Date.parse(r.inicio);

/** Propuesta de una tanda. No persiste ni modifica resultados o clasificados. */
export function proposeSchedule(data: ScheduleData, start: string, minutes: number, restMinutes: number, availableReferees: string[]) {
  const begin = Date.parse(start), end = begin + minutes * 60000, rest = restMinutes * 60000;
  if (!Number.isFinite(begin) || !Number.isFinite(end) || !Number.isInteger(minutes) || minutes <= 0 || minutes > 1440 || !Number.isInteger(restMinutes) || restMinutes < 0 || restMinutes > 1440 || !Number.isFinite(rest)) throw new Error("Indica inicio, duración estimada y descanso válidos.");
  const reservations = data.reservas.filter(r => r.estado !== "cancelada");
  // Encuentros heredados sin mesa siguen reteniendo a sus personas mientras se revisan.
  for (const m of data.partidos.filter(m => ["en_desarrollo", "revision", "observado"].includes(m.estado))) {
    if (reservations.some(r => active(r) && r.tipo === m.tipo && r.partido === m.id)) continue;
    reservations.push({ id: -m.id, tipo: m.tipo, partido: m.id, mesa_id: 0, estado: "revision", inicio: "1970-01-01T00:00:00Z", fin: "1970-01-01T00:00:00Z", jugadores: [m.a, m.b].filter((p): p is number => p !== null), perfiles: [m.perfil_a, m.perfil_b, m.arbitro_id].filter((p): p is string => !!p) });
  }
  const proposal: Allocation[] = [], warnings: string[] = [];
  const seen = new Set<string>();
  const matches = [...data.partidos].sort((a, b) => (a.inicio ?? "").localeCompare(b.inicio ?? "") || a.id - b.id || a.tipo.localeCompare(b.tipo));
  for (const m of matches) {
    const key = matchKey(m);
    if (seen.has(key)) continue;
    seen.add(key);
    if (reservations.some(r => active(r) && r.tipo === m.tipo && r.partido === m.id)) continue;
    if (!m.elegible || m.a === null || m.b === null) { if (m.estado !== "confirmado") warnings.push(`${key}: participantes o estado deportivo pendientes.`); continue; }
    if (m.inicio && Date.parse(m.inicio) > begin) { warnings.push(`${key}: la competencia comienza después de esta tanda.`); continue; }
    const busy = reservations.filter(r => overlaps(r, begin, end, rest));
    const players = [m.a, m.b], profiles = [m.perfil_a, m.perfil_b].filter((p): p is string => !!p);
    if (busy.some(r => r.jugadores.some(p => players.includes(p)) || r.perfiles.some(p => profiles.includes(p)))) { warnings.push(`${key}: jugador ocupado o en descanso.`); continue; }
    const table = [...data.mesas].sort((a, b) => a.numero - b.numero).find(t => t.estado === "disponible" && !reservations.some(r => active(r) && r.mesa_id === t.id && begin < (["en_juego", "revision"].includes(r.estado) ? Infinity : Date.parse(r.fin)) && end > Date.parse(r.inicio)));
    if (!table) { warnings.push(`${key}: sin mesa disponible en este intervalo.`); continue; }
    const refs = data.arbitros.filter(r => availableReferees.includes(r.id)).sort((a, b) => Number(b.id === m.arbitro_id) - Number(a.id === m.arbitro_id) || a.id.localeCompare(b.id));
    const referee = refs.find(r => !profiles.includes(r.id) && !busy.some(b => b.perfiles.includes(r.id)));
    if (!referee) { warnings.push(`${key}: sin árbitro disponible sin conflicto.`); continue; }
    const allocation = { tipo: m.tipo, partido: m.id, mesa_id: table.id, arbitro_id: referee.id, inicio: new Date(begin).toISOString(), fin: new Date(end).toISOString() };
    proposal.push(allocation);
    reservations.push({ ...allocation, id: -proposal.length, estado: "asignada", jugadores: players, perfiles: [...profiles, referee.id] });
  }
  return { proposal, warnings };
}
