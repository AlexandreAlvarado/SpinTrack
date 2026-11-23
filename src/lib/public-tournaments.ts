import { supabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";


export type PublicSeason = { id: number; nombre: string; anio: number };
export type PublicJourney = { id: number; temporada_id: number; numero: number; fecha: string; comuna: string; recinto: string; estado: string };
export type PublicCompetition = { id: number; fecha_id: number; nombre: string; estado: string; inicio: string | null; campeon: string | null; subcampeon: string | null };
export type PublicStanding = { nombre: string; pj: number; pg: number; pp: number; sf: number; sc: number };
export type PublicMatch = { numero: number; a: string | null; b: string | null; estado: string; sets_a: number | null; sets_b: number | null; sets: { a: number; b: number }[] | null; ganador: "a" | "b" | null; origen_a?: string | null; origen_b?: string | null };
export type PublicGroup = { numero: number; jugadores: string[]; clasificacion: PublicStanding[]; partidos: PublicMatch[] };
export type PublicRound = { numero: number; nombre: string; partidos: PublicMatch[] };
export type PublicTournamentData = { temporadas: PublicSeason[]; jornadas: PublicJourney[]; competencias: PublicCompetition[]; detalle: { grupos: PublicGroup[]; rondas: PublicRound[] } | null };
export type PublicTournamentResponse = { data: PublicTournamentData; unavailable: boolean };
const empty = (): PublicTournamentData => ({ temporadas: [], jornadas: [], competencias: [], detalle: null });

/** El RPC aplica la misma frontera de publicación incluso para operadores autenticados. */
export async function getPublicTournaments(competitionId?: number): Promise<PublicTournamentResponse> {
  if (!supabaseConfigured()) return { data: empty(), unavailable: true };
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("consultar_torneos_publicos_032", { p_competencia_id: competitionId ?? null });
    if (error || !data) return { data: empty(), unavailable: true };
    return { data: data as PublicTournamentData, unavailable: false };
  } catch {
    return { data: empty(), unavailable: true };
  }
}

export function publicState(state: string) {
  const labels: Record<string, string> = { publicada: "Publicada", finalizada: "Finalizada", finalizado: "Finalizada", pendiente: "Próximamente", preparada: "Programada", en_curso: "En curso", suspendida: "Suspendida", cancelada: "Cancelada" };
  return labels[state] ?? "Programada";
}

export function todayInSantiago(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function homeSchedule(data: PublicTournamentData, today = todayInSantiago()) {
  // No hay indicador de temporada activa en el esquema: se usa el año civil vigente,
  // únicamente si tiene jornadas publicables; no se inventa una temporada activa.
  const season = data.temporadas.find(item => item.anio === Number(today.slice(0, 4))) ?? null;
  const journeys = data.jornadas.filter(item => !season || item.temporada_id === season.id);
  return { season, upcoming: journeys.filter(item => item.fecha >= today && item.estado !== "finalizada").slice(0, 3), latest: journeys.filter(item => item.fecha <= today).at(-1) ?? null };
}
