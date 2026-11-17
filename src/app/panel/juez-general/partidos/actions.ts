"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";
export type MatchState = { error?: string; success?: string };

export async function manageMatches(_previous: MatchState, form: FormData): Promise<MatchState> {
  await requireRole("juez_general");
  const competition = String(form.get("competencia_id") ?? "");
  const rawReference = form.get("referencia");
  const reference = typeof rawReference === "string" ? rawReference.trim() : "";
  const operation = form.get("operacion");
  const lot = String(form.get("lote_id") ?? "");
  const motive = typeof form.get("motivo") === "string" ? String(form.get("motivo")).trim() : "";
  if (!validId(competition) || !reference || reference.length > 1000) return { error: "Indica competencia y referencia de hasta 1000 caracteres." };
  if (!["generar", "confirmar", "descartar"].includes(String(operation))) return { error: "Acción no válida." };
  if (operation === "generar" && form.get("formato_confirmado") !== "on") return { error: "Se requiere confirmación de la Liga para todos contra todos a una vuelta." };
  if (operation === "confirmar" && (!validId(lot) || form.get("revision_confirmada") !== "on")) return { error: "Revisa los cruces y confirma expresamente el lote." };
  if (operation === "descartar" && (!validId(lot) || !motive)) return { error: "Indica el lote y un motivo para descartarlo." };
  const db = await createClient();
  const result = operation === "generar"
    ? await db.rpc("generar_partidos_grupos", { p_competencia_id: Number(competition), p_formato_confirmado: true, p_referencia: reference })
    : operation === "confirmar"
      ? await db.rpc("confirmar_partidos_grupos", { p_competencia_id: Number(competition), p_lote_id: Number(lot), p_referencia: reference })
      : await db.rpc("descartar_partidos_grupos", { p_competencia_id: Number(competition), p_lote_id: Number(lot), p_motivo: motive, p_referencia: reference });
  if (result.error) {
    console.error("[partidos] acción rechazada", { code: result.error.code, message: result.error.message });
    return { error: ["42P01", "42883", "PGRST202", "PGRST205"].includes(result.error.code) ? "Falta aplicar la migración 011 en este entorno." : "No se pudo completar la acción. Recarga y revisa los grupos, la preparación y el estado del lote." };
  }
  revalidatePath("/panel/juez-general/partidos");
  revalidatePath("/panel/juez-general");
  revalidatePath("/panel/juez-general/resultados");
  return { success: operation === "generar" ? "Borrador generado. Revisa cada enfrentamiento antes de confirmar." : operation === "confirmar" ? "Partidos confirmados. Mesas y horarios siguen pendientes." : "Borrador descartado. Puedes generar una nueva propuesta." };
}
