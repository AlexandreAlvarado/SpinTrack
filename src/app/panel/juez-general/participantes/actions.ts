"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";
export type ParticipantState = { error?: string; success?: string };

export async function confirmParticipants(_previous: ParticipantState, form: FormData): Promise<ParticipantState> {
  await requireRole("juez_general");
  const competition = form.get("competencia_id");
  const submitted = form.getAll("jugador_id");
  if (submitted.some(x => typeof x !== "string" || !validId(x))) return { error: "La nómina contiene identificadores inválidos. Recarga antes de confirmar." };
  const ids = submitted.map(x => Number(x));
  if (new Set(ids).size !== ids.length) return { error: "La nómina contiene jugadores duplicados. Recarga antes de confirmar." };
  const reason = form.get("motivo_retiro");
  const removalReason = typeof reason === "string" && reason.trim() ? reason.trim() : null;
  if (typeof competition !== "string" || !validId(competition) || (!ids.length && !removalReason)) return { error: "Selecciona una competencia y agrega al menos un jugador; para retirar a todos, escribe el motivo." };
  try {
    const db = await createClient();
    const result = await db.rpc("confirmar_participantes_competencia", { p_competencia_id: Number(competition), p_jugadores: ids, p_fuente: "manual", p_referencia_trazabilidad: "Nómina confirmada desde Panel Juez General", p_motivo_retiro: removalReason });
    if (result.error) return { error: result.error.code === "42501" ? "Solo el Juez General puede confirmar la nómina." : "PostgreSQL rechazó la nómina. Revisa jugadores, habilitaciones y reglas vigentes." };
    revalidatePath("/panel/juez-general/participantes"); revalidatePath("/panel/jugador");
    return { success: `Nómina confirmada: ${Number(result.data)} participantes procesados.` };
  } catch { return { error: "No se pudo confirmar la nómina. Recarga antes de reintentar." }; }
}
