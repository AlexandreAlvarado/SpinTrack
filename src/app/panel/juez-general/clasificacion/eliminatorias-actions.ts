"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";

export type EliminationActionState = { error?: string; success?: string };
const text = (form: FormData, key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";

export async function saveEliminationDraft(_previous: EliminationActionState, form: FormData): Promise<EliminationActionState> {
  const profile = await requireProfile();
  if (profile.rol !== "juez_general") return { error: "Solo el Juez General puede guardar una propuesta de llave." };
  const competition = text(form, "competencia_id"), proposal = text(form, "propuesta");
  const reference = text(form, "referencia") || `Propuesta de clasificación de competencia ${competition}`;
  if (!validId(competition) || !proposal || reference.length > 1000) return { error: "Competencia y propuesta son obligatorias." };
  let parsed: unknown;
  try { parsed = JSON.parse(proposal); } catch { return { error: "La propuesta no tiene un formato válido. Recarga la clasificación." }; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { error: "La propuesta no tiene un formato válido." };
  const db = await createClient();
  const singleGroup = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) && (parsed as { version_regla?: unknown }).version_regla === 19;
  const response = await db.rpc(singleGroup ? "guardar_propuesta_eliminatoria_019" : "guardar_propuesta_eliminatoria_017", { p_competencia_id: Number(competition), p_propuesta: parsed, p_referencia: reference });
  if (response.error) {
    const code = response.error.code;
    if (["54000", "54001", "53200", "57014"].includes(code)) return { error: "La infraestructura no pudo procesar el tamaño de esta propuesta. Requiere ampliar capacidad; no es un límite deportivo de participantes." };
    return { error: ["42P01", "42883", "PGRST202", "PGRST205"].includes(code) ? "La persistencia de eliminatorias requiere aplicar manualmente la migración 019 en este entorno." : code === "40001" ? "La clasificación cambió mientras se guardaba. Recarga y revisa la propuesta." : code === "42501" ? "Operación no autorizada." : "No se guardó la propuesta. Revisa resultados, aprobaciones y referencias." };
  }
  revalidatePath("/panel/juez-general/clasificacion");
  return { success: "Propuesta de llave guardada para revisión." };
}

export async function confirmElimination(_previous: EliminationActionState, _form: FormData): Promise<EliminationActionState> {
  void _previous;
  const profile = await requireProfile();
  if (profile.rol !== "juez_general") return { error: "Solo el Juez General puede confirmar una llave." };
  const key = text(_form, "llave_id"), rules = text(_form, "referencia_reglas"), rematch = text(_form, "referencia_pases_reencuentros") || rules;
  const reference = text(_form, "referencia_confirmacion") || `Confirmación de llave ${key}`;
  if (!validId(key) || !reference || !rules || !rematch || _form.get("reglas_confirmadas") !== "on" || _form.get("datos_reales_confirmados") !== "on") return { error: "Confirma reglas, datos reales y referencias antes de activar la final." };
  const db = await createClient();
  const response = await db.rpc("confirmar_llave_eliminatoria_019", { p_llave_id: Number(key), p_referencia: reference, p_reglas_confirmadas: true, p_datos_reales: true, p_referencia_reglas: rules, p_referencia_pases_reencuentros: rematch });
  if (response.error) return { error: response.error.code === "42P01" || response.error.code === "42883" ? "La migración 019 debe aplicarse manualmente en este entorno." : "No se pudo confirmar la final. Revisa clasificación, respaldo y referencias." };
  revalidatePath("/panel/juez-general/clasificacion");
  return { success: "Final confirmada; ya puede iniciarse la operación de partidos." };

}


