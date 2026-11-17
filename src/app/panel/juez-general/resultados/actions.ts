"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";
import { parseSetInputs } from "@/lib/resultados";
export type ResultState = { error?: string; success?: string };

export async function assignReferee(_previous: ResultState, form: FormData): Promise<ResultState> {
  const profile = await requireProfile();
  if (profile.rol !== "juez_general") return { error: "Solo el Juez General puede asignar árbitros." };
  const text = (key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
  const partido = text("partido_id"), arbitro = text("arbitro_id"), referencia = text("referencia");
  if (!validId(partido) || !/^[0-9a-f-]{36}$/i.test(arbitro) || !referencia || referencia.length > 1000) return { error: "Partido, árbitro y referencia son obligatorios." };
  const db = await createClient();
  const response = await db.rpc("asignar_arbitro_partido", { p_partido_id: Number(partido), p_arbitro_id: arbitro, p_referencia: referencia });
  if (response.error) return { error: response.error.code === "42501" ? "No tienes permisos para asignar árbitros." : "No se pudo guardar la asignación; revisa el partido, el rol y posibles conflictos." };
  revalidatePath("/panel/juez-general/resultados");
  revalidatePath("/panel/juez-general/partidos");
  revalidatePath("/panel/juez-general");
  return { success: "Árbitro asignado." };
}

export async function manageResult(_previous: ResultState, form: FormData): Promise<ResultState> {
  const profile = await requireProfile();
  const operation = form.get("operacion");
  if (operation === "capturar" ? !profile.arbitrajeHabilitado : profile.rol !== "juez_general") return { error: "No tienes permisos para esta operación." };
  const text = (key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
  const match = text("partido_id"), revision = text("revision"), reference = text("referencia");
  if (!validId(match) || !/^(0|[1-9]\d*)$/.test(revision) || !Number.isSafeInteger(Number(revision)) || Number(revision) > 2147483647 || !reference || reference.length > 1000) return { error: "Partido, revisión o referencia inválidos." };
  if (!["capturar", "confirmar", "observar"].includes(String(operation))) return { error: "Operación inválida." };
  const db = await createClient();
  let response;
  if (operation === "confirmar" || operation === "observar") {
    const resultId = text("resultado_id");
    if (!validId(resultId)) return { error: "Resultado inválido." };
    if (operation === "confirmar") {
      if (form.get("revision_confirmada") !== "on") return { error: "Revisa los sets y confirma expresamente la validación deportiva." };
      response = await db.rpc("confirmar_resultado_partido", { p_partido_id: Number(match), p_resultado_id: Number(resultId), p_revision_esperada: Number(revision), p_referencia: reference });
    } else {
      const observation = text("observacion");
      if (!observation || observation.length > 2000) return { error: "La observación es obligatoria y debe tener hasta 2000 caracteres." };
      response = await db.rpc("observar_resultado_partido", { p_partido_id: Number(match), p_resultado_id: Number(resultId), p_revision_esperada: Number(revision), p_observacion: observation });
    }
  } else {
    const kind = text("tipo"), rules = text("referencia_reglas"), motive = text("motivo"), description = text("descripcion");
    if (!["ordinario", "incomparecencia", "retiro", "suspension"].includes(kind) || !rules || rules.length > 1000 || form.get("reglas_confirmadas") !== "on" || description.length > 2000 || motive.length > 1000) return { error: "Revisa tipo, reglas aplicables, referencia y descripción." };
    if (Number(revision) > 0 && !motive) return { error: "La corrección requiere un motivo." };
    const parsed = parseSetInputs(Array.from({ length: 5 }, (_, i) => ({ a: text(`a_${i}`), b: text(`b_${i}`) })));
    if (kind === "ordinario" && "error" in parsed) return parsed;
    if (kind !== "ordinario" && (!description || (Array.isArray(parsed) && parsed.length > 0) || "error" in parsed)) return { error: "Describe la incidencia y deja los sets vacíos; no se asignará ganador." };
    // No se acepta mejor_de ni ganador del navegador: se calculan en PostgreSQL.
    response = await db.rpc("capturar_resultado_partido", { p_partido_id: Number(match), p_revision_esperada: Number(revision), p_tipo: kind, p_sets: parsed, p_referencia: reference, p_referencia_reglas: rules, p_reglas_confirmadas: true, p_descripcion: description, p_motivo: motive || null });
  }
  if (response.error) {
    // Rechazos deportivos esperados no son excepciones de render de Next.
    const log = ["42501", "40001", "23514", "55000", "22023"].includes(response.error.code) ? console.warn : console.error;
    log("[resultados] operación rechazada", { code: response.error.code, message: response.error.message });
    const code = response.error.code;
    return { error: ["42P01", "42883", "PGRST202", "PGRST205"].includes(code) ? "Falta aplicar la migración 013 en este entorno."
      : code === "40001" ? "El resultado cambió o ya fue confirmado. Recarga y revisa la versión actual."
      : code === "42501" ? "Operación no autorizada. El Árbitro debe tener una asignación activa y el Juez General es el único que confirma."
      : "No se guardó la operación. Revisa puntuaciones, formato aprobado, referencias y estado del partido." };
  }
  revalidatePath("/panel/juez-general/resultados");
  revalidatePath("/panel/juez-general/partidos");
  revalidatePath("/panel/juez-general");
  revalidatePath("/panel/juez-general/clasificacion");
  return { success: operation === "confirmar" ? "Resultado confirmado deportivamente." : operation === "observar" ? "Resultado devuelto al Árbitro con observación." : "Resultado enviado al Juez General para revisión." };
}
