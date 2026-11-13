"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId, type CatalogState } from "@/lib/catalogos";
import { REGISTRATIONS_PATH, REGISTRATION_COLUMNS, HISTORY_COLUMNS, validateDecision, decisionConfirmed } from "@/lib/inscripciones";

export async function resolveRegistration(id: number, competition: number, _previous: CatalogState, form: FormData): Promise<CatalogState> {
  const profile = await requireRole("juez_general");
  const { values, valid } = validateDecision(form);
  if (![id, competition].every(x => validId(String(x))) || !valid) return { error: "Selecciona aceptar o rechazar, indica motivo (hasta 2000 caracteres), referencia documental (hasta 1000) y confirma la revisión.", values };
  try {
    const db = await createClient();
    const before = await db.from("inscripciones").select(REGISTRATION_COLUMNS).eq("id", id).eq("competencia_id", competition).maybeSingle();
    if (before.error || !before.data || before.data.estado !== "pendiente") return { error: "Solicitud no disponible o ya resuelta. Recarga los datos.", values };
    const result = await db.rpc("resolver_inscripcion", { p_inscripcion_id: id, p_estado: values.estado, p_motivo: values.motivo, p_referencia: values.referencia });
    if (result.error) return { error: result.error.code === "42501" ? "Operación rechazada por permisos o cambio de estado. Comprueba tu sesión y recarga." : "PostgreSQL rechazó la resolución. Revisa elegibilidad vigente, preparación, inicio deportivo y evidencia documental; recarga antes de reintentar.", values };
    const [saved, history] = await Promise.all([
      db.from("inscripciones").select(REGISTRATION_COLUMNS).eq("id", id).eq("competencia_id", competition).maybeSingle(),
      db.from("inscripciones_historial").select(HISTORY_COLUMNS).eq("inscripcion_id", id).order("id", { ascending: false }).limit(1).maybeSingle(),
    ]);
    revalidatePath(REGISTRATIONS_PATH);
    if (saved.error || history.error || !decisionConfirmed(saved.data, history.data, id, competition, profile.id, values)) return { error: "La operación pudo haberse guardado, pero no se confirmó el estado y su historial. Recarga y comprueba antes de reintentar.", values };
    return { success: "Resolución e historial confirmados por PostgreSQL.", values };
  } catch { return { error: "No se pudo confirmar la operación. Recarga y comprueba el historial antes de reintentar.", values }; }
}
