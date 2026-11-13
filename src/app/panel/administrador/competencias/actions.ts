"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";
import { COMPETITIONS_PATH, COMPETITION_COLUMNS, competitionError, competitionTimingIssues, openingBlockers, validateCompetition, type Competition, type CompetitionState, type SportsControl } from "@/lib/competencias";

export async function saveCompetition(seasonId: number, dateId: number, id: number | null, _previous: CompetitionState, form: FormData): Promise<CompetitionState> {
  await requireRole("administrador");
  if (!validId(String(seasonId)) || !validId(String(dateId)) || (id !== null && !validId(String(id)))) return { error: "La solicitud no es válida." };
  // Financial values are no longer accepted from the UI, even in forged requests.
  // Omit the column on INSERT/UPDATE: preserve stored values and the nullable default.
  const administrativeForm = new FormData();
  for (const [key, value] of form.entries()) if (key !== "tarifa_clp") administrativeForm.append(key, value);
  const { payload, values, errors } = validateCompetition(administrativeForm, id !== null);
  delete payload.tarifa_clp;
  delete values.tarifa_clp;
  if (Object.keys(errors).length) return { error: "Revisa los campos indicados.", values, errors };
  try {
    const db = await createClient();
    const date = await db.from("fechas").select("id,temporada_id,fecha,estado").eq("id", dateId).eq("temporada_id", seasonId).maybeSingle();
    if (date.error || !date.data) return { error: "No se pudo consultar la fecha de esta temporada.", values };
    let existing: Competition | null = null;
    if (id !== null) {
      const result = await db.from("competencias").select(COMPETITION_COLUMNS).eq("id", id).eq("temporada_id", seasonId).eq("fecha_id", dateId).maybeSingle();
      if (result.error || !result.data) return { error: "La competencia no existe en esta fecha o no está disponible.", values };
      existing = result.data as Competition;
      if ((existing.publicada || existing.inscripciones_habilitadas) && ["inscripcion_abre_en", "inscripcion_cierra_en"].some(key => {
        const before = existing![key as keyof Competition];
        const after = payload[key];
        return key.startsWith("inscripcion_") && before && after ? new Date(String(before)).getTime() !== new Date(String(after)).getTime() : before !== after;
      })) return { error: "Primero guarda la competencia sin publicación y con inscripciones deshabilitadas, conservando los plazos actuales. Después podrás cambiar los plazos.", values };
      if (existing.publicada || existing.inscripciones_habilitadas) {
        // Conservar precisión PostgreSQL al retirar publicación, incluso si el timestamp
        // original contiene microsegundos que datetime-local/Date no representan.
        payload.inscripcion_abre_en = existing.inscripcion_abre_en;
        payload.inscripcion_cierra_en = existing.inscripcion_cierra_en;
      }
    }
    const categoryId = existing?.categoria_temporada_id ?? payload.categoria_temporada_id;
    const category = await db.from("categorias_temporada").select("id,activo").eq("id", categoryId).eq("temporada_id", seasonId).maybeSingle();
    if (category.error || !category.data) return { error: "La categoría no está disponible en esta misma temporada.", values };
    if (!category.data.activo && (id === null || payload.publicada || payload.inscripciones_habilitadas)) return { error: "La categoría de temporada está inactiva; no puede asociarse ni publicarse o habilitarse.", values };
    let sports: SportsControl | null = null;
    if (id !== null) {
      const result = await db.from("competencia_control_deportivo").select("competencia_id,configuracion_aprobada,estado_deportivo,inicio_programado,minimo_participantes").eq("competencia_id", id).maybeSingle();
      if (result.error) return { error: "No se pudo comprobar la aprobación deportiva. No se guardó ningún cambio.", values };
      sports = result.data as SportsControl | null;
    }
    const timing = competitionTimingIssues(payload as unknown as Competition, date.data, sports);
    // Permitir retirar publicación/desactivar sin reescribir plazos históricos incoherentes.
    // No es una excepción para publicar, habilitar ni introducir nuevos plazos inválidos.
    const safeWithdrawal = existing && !payload.publicada && !payload.inscripciones_habilitadas
      && (payload.activo === existing.activo || payload.activo === false)
      && ["inscripcion_abre_en", "inscripcion_cierra_en"].every(key => {
        const before = existing[key as keyof Competition];
        const after = payload[key];
        return key.startsWith("inscripcion_") && before && after ? new Date(String(before)).getTime() === new Date(String(after)).getTime() : before === after;
      });
    if (Object.keys(timing.errors).length && !safeWithdrawal) return { error: "Revisa los plazos respecto de la jornada y su inicio programado.", values, errors: timing.errors };
    if ((payload.publicada || payload.inscripciones_habilitadas) && timing.sportsIssue) return { error: timing.sportsIssue, values };
    if (payload.publicada && !sports?.configuracion_aprobada) return { error: "No se puede publicar: falta aprobación deportiva del Juez General.", values };
    if (payload.inscripciones_habilitadas) {
      const blockers = openingBlockers({ ...payload, tarifa_clp: existing?.tarifa_clp ?? null } as unknown as Competition, date.data, sports);
      if (blockers.length) return { error: blockers.join(" "), values };
    }
    const result = id === null
      ? await db.from("competencias").insert({ ...payload, temporada_id: seasonId, fecha_id: dateId }).select("id").single()
      : await db.from("competencias").update(payload).eq("id", id).eq("temporada_id", seasonId).eq("fecha_id", dateId).select("id").maybeSingle();
    // PostgreSQL/RLS y sus triggers son la autoridad final, incluso ante cambios concurrentes.
    if (result.error) return { error: competitionError(result.error), values };
    if (!result.data) return { error: "No se confirmó el guardado; el registro no existe o tu sesión no permite modificarlo.", values };
  } catch { return { error: "No se pudo confirmar el guardado. Consulta el listado antes de reintentar.", values }; }
  revalidatePath(COMPETITIONS_PATH);
  return { success: id === null ? "Competencia registrada. La aprobación deportiva corresponde al Juez General." : "Cambios guardados correctamente.", values: id === null ? undefined : values };
}
