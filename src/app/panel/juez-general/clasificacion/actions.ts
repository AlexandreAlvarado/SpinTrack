"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";
export type ApprovalState = { error?: string; success?: string };
export async function approveStanding(_previous: ApprovalState, form: FormData): Promise<ApprovalState> {
  const profile = await requireProfile();
  if (profile.rol !== "juez_general") return { error: "Solo el Juez General puede aprobar." };
  const group = String(form.get("grupo_id") ?? ""), reference = String(form.get("referencia") ?? "").trim();
  const raw = String(form.get("snapshot") ?? "");
  if (!validId(group) || !reference || reference.length > 1000 || raw.length > 30000 || form.get("criterio_validado") !== "on" || form.get("datos_reales") !== "on") return { error: "Confirma respaldo del criterio, datos reales y referencia documental." };
  let snapshot: unknown;
  try { snapshot = JSON.parse(raw); } catch { return { error: "Clasificación inválida. Recarga." }; }
  const db = await createClient();
  const response = await db.rpc("aprobar_clasificacion_grupo", { p_grupo_id: Number(group), p_snapshot: snapshot, p_referencia: reference, p_criterio_validado: true, p_datos_reales: true });
  if (response.error) return { error: response.error.code === "40001" ? "La clasificación cambió. Recarga y revisa." : "No se aprobó. Revisa resultados, empates, permisos y disponibilidad de la migración 015." };
  revalidatePath("/panel/juez-general/clasificacion");
  return { success: "Aprobación deportiva interna registrada. No publica resultados." };
}
