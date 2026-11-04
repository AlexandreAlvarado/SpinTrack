"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId, type CatalogState } from "@/lib/catalogos";
import { PLAYER_COLUMNS, type PlayerRecord } from "@/lib/jugadores";
import type { Rule, SeasonCategory } from "@/lib/temporadas-deportivas";
import { HABILITATIONS_PATH, HABILITATION_COLUMNS, eligibilityIssues, habilitationRevision, habilitationError, validateHabilitation, type Habilitation } from "@/lib/habilitaciones";

export async function saveHabilitation(seasonId: number, categoryId: number, playerId: number, revision: string | null, _previous: CatalogState, form: FormData): Promise<CatalogState> {
  await requireRole("juez_general");
  if (![seasonId, categoryId, playerId].every(id => validId(String(id)))) return { error: "Identificadores inválidos." };
  const result = validateHabilitation(form);
  if (Object.keys(result.errors).length) return { error: "Revisa la resolución y sus antecedentes.", values: result.values, errors: result.errors };
  try {
    const db = await createClient();
    const [player, category, existing] = await Promise.all([
      db.from("jugadores").select(PLAYER_COLUMNS).eq("id", playerId).maybeSingle(),
      db.from("categorias_temporada").select("id,temporada_id,categoria_id,nivel_id,codigo,rama,criterio_nacimiento,anio_nacimiento_desde,anio_nacimiento_hasta,reglamento_id,activo").eq("id", categoryId).eq("temporada_id", seasonId).maybeSingle(),
      db.from("habilitaciones_jugador_categoria").select(HABILITATION_COLUMNS).eq("jugador_id", playerId).eq("categoria_temporada_id", categoryId).maybeSingle(),
    ]);
    if (player.error || category.error || existing.error || !player.data || !category.data) return { error: "No se pudieron comprobar el jugador y la categoría de esta temporada. No se guardó la resolución.", values: result.values };
    const old = existing.data as Habilitation | null;
    if (habilitationRevision(old) !== revision) return { error: "La resolución cambió en otra sesión. Recarga antes de editar.", values: result.values };
    if (result.payload.estado === "habilitado") {
      const ct = category.data as SeasonCategory;
      const [rule, concept, level] = await Promise.all([
        ct.reglamento_id ? db.from("reglamentos_temporada").select("id,temporada_id,estado_revision,referencia_aprobacion").eq("id", ct.reglamento_id).eq("temporada_id", seasonId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        db.from("categorias").select("activo").eq("id", ct.categoria_id).maybeSingle(),
        db.from("niveles").select("activo").eq("id", ct.nivel_id).maybeSingle(),
      ]);
      if (rule.error || concept.error || level.error) return { error: "No se pudieron comprobar las reglas vigentes. No se concedió la habilitación.", values: result.values };
      const issues = eligibilityIssues(player.data as PlayerRecord, { ...ct, catalogos_activos: !!concept.data?.activo && !!level.data?.activo }, rule.data as Rule | null, result.payload.tipo_resolucion === "excepcion_documentada");
      if (issues.length) return { error: issues.join(" "), values: result.values };
    }
    // Lista cerrada, sin identidad modificable ni auditoría enviada por el navegador.
    let request;
    if (old) {
      request = db.from("habilitaciones_jugador_categoria").update(result.payload).eq("id", old.id).eq("jugador_id", playerId).eq("categoria_temporada_id", categoryId);
      for (const key of ["estado", "tipo_resolucion", "motivo", "referencia_evidencia", "validado_por", "validado_en"] as const) request = old[key] === null ? request.is(key, null) : request.eq(key, old[key]);
    } else request = db.from("habilitaciones_jugador_categoria").insert({ ...result.payload, jugador_id: playerId, categoria_temporada_id: categoryId });
    const saved = await request.select(HABILITATION_COLUMNS).maybeSingle();
    if (saved.error) return { error: habilitationError(saved.error.code), values: result.values };
    if (!saved.data || saved.data.estado !== result.payload.estado || saved.data.tipo_resolucion !== result.payload.tipo_resolucion || (result.payload.estado !== "pendiente" && (!saved.data.validado_por || !saved.data.validado_en))) return { error: "No se confirmó la resolución o cambió durante el guardado. Recarga antes de continuar.", values: result.values };
    revalidatePath(HABILITATIONS_PATH);
    return { success: "PostgreSQL confirmó la resolución deportiva. No constituye una inscripción.", values: result.values };
  } catch { return { error: "No se pudo confirmar la operación. Recarga y comprueba los registros antes de reintentar.", values: result.values }; }
}
