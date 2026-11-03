"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";
import { allowedCombination, SEASON_PATH, seasonError, validateSeasonForm, type SeasonState } from "@/lib/temporadas-deportivas";

export async function saveSeasonConfiguration(kind: "reglamentos" | "categorias", seasonId: number, id: number | null, _previous: SeasonState, form: FormData): Promise<SeasonState> {
  await requireRole("administrador");
  if (!["reglamentos", "categorias"].includes(kind) || !validId(String(seasonId)) || (id !== null && !validId(String(id)))) return { error: "Solicitud inválida." };
  let values: Record<string, string> | undefined;
  try {
    const db = await createClient();
    const season = await db.from("temporadas").select("id,anio").eq("id", seasonId).maybeSingle();
    if (season.error) return { error: "No se pudo consultar la temporada." };
    if (!season.data) return { error: "La temporada no existe o no está disponible." };
    const validation = validateSeasonForm(kind, id !== null, form, season.data.anio);
    values = validation.values;
    if (Object.keys(validation.errors).length) return { error: "Revisa los campos indicados.", values, errors: validation.errors };
    const payload = validation.payload;
    const table = kind === "reglamentos" ? "reglamentos_temporada" : "categorias_temporada";
    let identity = payload;
    if (id !== null) {
      const existing = await db.from(table).select("*").eq("id", id).eq("temporada_id", seasonId).maybeSingle();
      if (existing.error || !existing.data) return { error: "No se pudo consultar el registro de esta temporada.", values };
      identity = existing.data;
    }
    if (kind === "categorias") {
      const [category, level] = await Promise.all([
        db.from("categorias").select("codigo,activo").eq("id", identity.categoria_id).maybeSingle(),
        db.from("niveles").select("codigo,activo").eq("id", identity.nivel_id).maybeSingle(),
      ]);
      if (category.error || level.error) return { error: "No se pudieron consultar la categoría y el nivel.", values };
      if (!category.data || !level.data || !allowedCombination(category.data.codigo, level.data.codigo, payload.rama as string | null)) return { error: "La combinación no corresponde a las diez individuales documentadas. TC Única solo admite rama pendiente o Damas.", values };
      if (id === null && (!category.data.activo || !level.data.activo)) return { error: "Selecciona una categoría y un nivel activos.", values };
      if (payload.reglamento_id !== null) {
        const rule = await db.from("reglamentos_temporada").select("id").eq("id", payload.reglamento_id).eq("temporada_id", seasonId).maybeSingle();
        if (rule.error || !rule.data) return { error: "El reglamento no está disponible en esta misma temporada.", values, errors: { reglamento_id: "Selecciona un reglamento de la temporada actual." } };
      }
    }
    // Solo columnas autorizadas; identidad, auditoría y código derivado no se actualizan.
    const result = id === null
      ? await db.from(table).insert({ ...payload, temporada_id: seasonId }).select("id").single()
      : await db.from(table).update(payload).eq("id", id).eq("temporada_id", seasonId).select("id").maybeSingle();
    if (result.error) return { error: seasonError(result.error), values };
    if (!result.data) return { error: "El registro no existe o tu sesión no permite modificarlo.", values };
  } catch { return { error: "No se pudo confirmar el guardado. Consulta el listado antes de reintentar.", values }; }
  revalidatePath(SEASON_PATH);
  return { success: "Configuración guardada. No se han habilitado inscripciones ni aprobado decisiones deportivas.", values: id === null ? undefined : values };
}
