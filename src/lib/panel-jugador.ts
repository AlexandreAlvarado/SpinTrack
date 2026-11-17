import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAYER_COLUMNS, type PlayerRecord } from "./jugadores";
import type { CompetitionDate } from "./competencias";
import type { Registration } from "./inscripciones";

export const PLAYER_ACCESS_NOTICE = "Las participaciones mostradas fueron confirmadas por el Juez General. No se gestionan pagos ni solicitudes individuales en esta versión.";
export type PlayerParticipation = { competencia_id: number; fecha_id: number; jornada_numero: number; fecha: string; comuna: string; recinto: string; categoria_codigo: string; categoria_nombre: string; inicio_programado: string | null; confirmado_en: string };
export function registrationCategory(value: unknown): string {
  if (!value || typeof value !== "object" || !("categoria" in value)) return "Categoría no disponible";
  const category = value.categoria;
  return category && typeof category === "object" && "codigo" in category && typeof category.codigo === "string" ? category.codigo : "Categoría no disponible";
}
export async function loadPlayerPanel(db: SupabaseClient, profileId: string) {
  const own = await db.from("jugadores").select(PLAYER_COLUMNS).eq("perfil_id", profileId).maybeSingle();
  if (own.error || (own.data && own.data.perfil_id !== profileId)) throw new Error("Ficha no verificable");
  const player = own.data as PlayerRecord | null;
  async function name(table: string, id: number | null) {
    if (id === null) return null;
    const result = await db.from(table).select("id,nombre").eq("id", id).maybeSingle();
    if (result.error) throw new Error("Catálogo no disponible");
    return result.data?.nombre as string | null;
  }
  async function readAll<T>(table: string, columns: string, key: string, value: string | number, order: string): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await db.from(table).select(columns).eq(key, value).order(order).range(offset, offset + 499);
      if (result.error || !Array.isArray(result.data)) throw new Error("Consulta incompleta");
      rows.push(...result.data as T[]);
      if (result.data.length < 500) return rows;
    }
  }
  const participationsResult = typeof db.rpc === "function" ? await db.rpc("consultar_mis_participaciones") : { data: [], error: null };
  if (participationsResult.error || !Array.isArray(participationsResult.data)) throw new Error("Consulta deportiva no disponible");
  const participations = participationsResult.data as PlayerParticipation[];
  const [club, locality, dates, registrations] = await Promise.all([
    player ? name("clubes", player.club_id) : null,
    player ? name("localidades", player.localidad_procedencia_id) : null,
    readAll<CompetitionDate>("fechas", "id,temporada_id,numero,fecha,comuna,recinto,estado", "estado", "publicada", "fecha"),
    player ? readAll<Registration>("inscripciones", "id,jugador_id,competencia_id,estado,creado_en,actualizado_en,antecedentes", "jugador_id", player.id, "creado_en") : [],
  ]);
  return { player, club, locality, dates, participations, registrations };
}
