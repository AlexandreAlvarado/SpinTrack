"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";

export type GroupState = { error?: string; success?: string };

function readPayload(form: FormData) {
  const raw = form.get("grupos");
  const competition = form.get("competencia_id");
  if (typeof competition !== "string" || !validId(competition) || typeof raw !== "string") return null;
  try {
    const groups = JSON.parse(raw);
    if (!Array.isArray(groups)) return null;
    return { competitionId: Number(competition), groups };
  } catch { return null; }
}

export async function saveGroups(_previous: GroupState, form: FormData): Promise<GroupState> {
  await requireRole("juez_general");
  const payload = readPayload(form);
  if (!payload) return { error: "La propuesta de grupos no tiene un formato válido." };
  const reference = typeof form.get("referencia_trazabilidad") === "string" ? String(form.get("referencia_trazabilidad")).trim() : "";
  if (!reference) return { error: "Indica una referencia breve para guardar la propuesta." };
  let adjustments: unknown = [];
  try { adjustments = JSON.parse(typeof form.get("ajustes_manuales") === "string" ? String(form.get("ajustes_manuales") || "[]") : "[]"); } catch { return { error: "Los ajustes manuales no tienen un formato válido." }; }
  const db = await createClient();
  const result = await db.rpc("guardar_grupos_competencia", { p_competencia_id: payload.competitionId, p_grupos: payload.groups, p_referencia_trazabilidad: reference, p_ajustes_manuales: adjustments });
  if (result.error) {
    console.error("[grupos] guardar propuesta rechazado", { code: result.error.code, message: result.error.message, competitionId: payload.competitionId });
    if (result.error.code === "42883" || result.error.code === "42P01") return { error: "La organización de grupos aún no está disponible: falta aplicar la migración 010 en este entorno." };
    return { error: result.error.code === "55000" ? "Los grupos ya están confirmados y no pueden modificarse." : `PostgreSQL rechazó la propuesta (${result.error.code ?? "sin código"}). Comprueba la nómina, la jornada publicada y la preparación deportiva.` };
  }
  revalidatePath("/panel/juez-general/grupos");
  revalidatePath("/panel/juez-general/participantes");
  return { success: "Propuesta de grupos guardada. Todavía no está confirmada." };
}

export async function confirmGroups(_previous: GroupState, form: FormData): Promise<GroupState> {
  await requireRole("juez_general");
  const competition = form.get("competencia_id");
  const reference = typeof form.get("referencia_trazabilidad") === "string" ? String(form.get("referencia_trazabilidad")).trim() : "";
  if (typeof competition !== "string" || !validId(competition) || !reference) return { error: "Falta la competencia o la referencia de confirmación." };
  const db = await createClient();
  const result = await db.rpc("confirmar_grupos_competencia", { p_competencia_id: Number(competition), p_referencia_trazabilidad: reference });
  if (result.error) {
    console.error("[grupos] confirmar propuesta rechazado", { code: result.error.code, message: result.error.message, competitionId: Number(competition) });
    if (result.error.code === "42883" || result.error.code === "42P01") return { error: "La organización de grupos aún no está disponible: falta aplicar la migración 010 en este entorno." };
    return { error: result.error.code === "55000" ? "Los grupos ya están confirmados." : `PostgreSQL rechazó la confirmación (${result.error.code ?? "sin código"}). Revisa la propuesta, la nómina y las condiciones deportivas.` };
  }
  revalidatePath("/panel/juez-general/grupos");
  revalidatePath("/panel/juez-general/participantes");
  return { success: "Grupos confirmados. La nómina queda bloqueada para correcciones incompatibles." };
}

