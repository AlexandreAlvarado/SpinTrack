"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId, type CatalogState } from "@/lib/catalogos";
import { COMPETITION_COLUMNS, COMPETITIONS_PATH, type Competition } from "@/lib/competencias";
import { JUDGE_PATH, PREPARATION_COLUMNS, FORMAT_COLUMNS, STAGES, preparationBlockers, preparationLock, preparationError, validatePreparation, validateStage, type Preparation, type StageFormat, type SportsCategory } from "@/lib/preparacion-deportiva";
import type { Rule, SeasonCategory } from "@/lib/temporadas-deportivas";

class PreparationIssue extends Error {}

async function context(seasonId: number, dateId: number, id: number) {
  if (![seasonId, dateId, id].every(x => validId(String(x)))) throw new PreparationIssue("Identificadores inválidos.");
  const db = await createClient();
  const [competition, date, control] = await Promise.all([
    db.from("competencias").select(COMPETITION_COLUMNS).eq("id", id).eq("fecha_id", dateId).eq("temporada_id", seasonId).maybeSingle(),
    db.from("fechas").select("id,temporada_id,fecha").eq("id", dateId).eq("temporada_id", seasonId).maybeSingle(),
    db.from("competencia_control_deportivo").select(PREPARATION_COLUMNS).eq("competencia_id", id).eq("temporada_id", seasonId).maybeSingle(),
  ]);
  if (competition.error || date.error || control.error || !competition.data || !date.data) throw new PreparationIssue("No se pudo comprobar la competencia y su jornada. Recarga antes de continuar.");
  const c = competition.data as Competition, p = control.data as Preparation | null;
  const lock = preparationLock(c, p);
  if (lock) throw new PreparationIssue(lock);
  return { db, c, p, date: date.data };
}

async function rules(db: Awaited<ReturnType<typeof createClient>>, categoryId: number, seasonId: number) {
  const result = await db.from("categorias_temporada").select("id,temporada_id,categoria_id,nivel_id,codigo,rama,criterio_nacimiento,anio_nacimiento_desde,anio_nacimiento_hasta,reglamento_id,activo").eq("id", categoryId).eq("temporada_id", seasonId).maybeSingle();
  if (result.error || !result.data) throw new PreparationIssue("No se pudo comprobar la categoría de la temporada.");
  const ct = result.data as SeasonCategory;
  const [category, level, regulation] = await Promise.all([
    db.from("categorias").select("id,activo").eq("id", ct.categoria_id).maybeSingle(),
    db.from("niveles").select("id,activo").eq("id", ct.nivel_id).maybeSingle(),
    ct.reglamento_id ? db.from("reglamentos_temporada").select("id,temporada_id,version,titulo,referencia_documental,hash_documento,estado_revision,referencia_aprobacion").eq("id", ct.reglamento_id).eq("temporada_id", seasonId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (category.error || level.error || regulation.error) throw new PreparationIssue("No se pudieron comprobar las reglas. No se guardó ningún cambio.");
  return { category: { ...ct, catalogos_activos: !!category.data?.activo && !!level.data?.activo } as SportsCategory, rule: regulation.data as Rule | null };
}

function invalidate() {
  revalidatePath(JUDGE_PATH);
  revalidatePath("/panel/juez-general");
  revalidatePath(COMPETITIONS_PATH);
}
function failure(e: unknown): CatalogState {
  // No mostrar errores de conexión, detalles SQL ni credenciales del proveedor.
  return { error: e instanceof PreparationIssue ? e.message : "No se pudo confirmar la operación. Recarga antes de reintentar." };
}

export async function savePreparation(seasonId: number, dateId: number, id: number, revision: string | null, _prev: CatalogState, form: FormData): Promise<CatalogState> {
  await requireRole("administrador");
  try {
    const { db, c, p, date } = await context(seasonId, dateId, id);
    const result = validatePreparation(form, date.fecha);
    if (Object.keys(result.errors).length) return { error: "Revisa los campos indicados.", values: result.values, errors: result.errors };
    if ((p?.actualizado_en ?? null) !== revision) return { error: "El borrador cambió en otra sesión. Recarga para revisarlo.", values: result.values };
    if (result.payload.inicio_programado && c.inscripcion_cierra_en && new Date(c.inscripcion_cierra_en) > new Date(result.payload.inicio_programado)) return { error: "El cierre de inscripciones es posterior al inicio. Coordina los plazos con Administración.", values: result.values };
    const { category } = await rules(db, c.categoria_temporada_id, seasonId);
    // No aceptar reglamento, auditoría, estados ni aprobación enviados por el navegador.
    const payload = { ...result.payload, reglamento_id: category.reglamento_id };
    const request = p
      ? db.from("competencia_control_deportivo").update(payload).eq("competencia_id", id).eq("temporada_id", seasonId).eq("configuracion_aprobada", false).eq("estado_deportivo", "pendiente").eq("actualizado_en", revision!)
      : db.from("competencia_control_deportivo").insert({ ...payload, competencia_id: id, temporada_id: seasonId });
    const saved = await request.select("competencia_id").maybeSingle();
    if (saved.error) return { error: preparationError(saved.error), values: result.values };
    if (!saved.data) return { error: "No se confirmó la escritura; el borrador pudo cambiar en otra sesión.", values: result.values };
    invalidate();
    return { success: "Borrador deportivo confirmado por PostgreSQL. Aún no está aprobado.", values: result.values };
  } catch (e) { return failure(e); }
}

export async function saveStageFormat(seasonId: number, dateId: number, id: number, stage: string, revision: string | null, _prev: CatalogState, form: FormData): Promise<CatalogState> {
  await requireRole("administrador");
  if (!STAGES.some(s => s === stage)) return { error: "Etapa no válida." };
  const result = validateStage(form);
  if (Object.keys(result.errors).length) return { error: "Revisa los sets y su referencia.", ...result };
  try {
    const { db, p } = await context(seasonId, dateId, id);
    if (!p) return { error: "Guarda primero el borrador deportivo.", values: result.values };
    if (stage === "final") {
      if (result.payload.mejor_de !== 5) return { error: "La final se disputa siempre al mejor de 5 sets.", values: { ...result.values, mejor_de: "5" } };
      if (!result.payload.referencia_resolucion) return { error: "Registra una referencia deportiva para la regla de final al mejor de 5 sets.", values: result.values };
      const configured = await db.rpc("configurar_formato_final_021", { p_competencia_id: id, p_referencia: result.payload.referencia_resolucion });
      if (configured.error) return { error: preparationError(configured.error), values: result.values };
      invalidate();
      return { success: "Final configurada al mejor de 5 sets con su referencia trazable.", values: { ...result.values, mejor_de: "5" } };
    }
    const current = await db.from("competencia_formatos_sets").select(FORMAT_COLUMNS).eq("competencia_id", id).eq("etapa", stage).maybeSingle();
    if (current.error) return { error: "No se pudo comprobar esta etapa.", values: result.values };
    if ((current.data?.actualizado_en ?? null) !== revision) return { error: "La etapa cambió en otra sesión. Recarga antes de guardar.", values: result.values };
    // Sin upsert: 003 permite UPDATE de sets/referencia, no de sus claves primarias.
    const request = current.data
      ? db.from("competencia_formatos_sets").update(result.payload).eq("competencia_id", id).eq("etapa", stage).eq("actualizado_en", revision!)
      : db.from("competencia_formatos_sets").insert({ ...result.payload, competencia_id: id, etapa: stage });
    const saved = await request.select("etapa").maybeSingle();
    if (saved.error) return { error: preparationError(saved.error), values: result.values };
    if (!saved.data) return { error: "La etapa no se confirmó; recarga y comprueba su estado.", values: result.values };
    invalidate();
    return { success: "Sets de esta etapa confirmados por PostgreSQL.", values: result.values };
  } catch (e) { return failure(e); }
}

export async function approvePreparation(seasonId: number, dateId: number, id: number, revision: string | null, _prev: CatalogState, form: FormData): Promise<CatalogState> {
  await requireRole("administrador");
  if (form.get("confirmacion") !== "revisada") return { error: "Confirma que revisaste la configuración guardada y sus referencias." };
  try {
    const { db, c, p, date } = await context(seasonId, dateId, id);
    if (!p || p.actualizado_en !== revision) return { error: "El borrador no existe o cambió. Recarga antes de aprobar." };
    const { category, rule } = await rules(db, c.categoria_temporada_id, seasonId);
    const formats = await db.from("competencia_formatos_sets").select(FORMAT_COLUMNS).eq("competencia_id", id);
    if (formats.error) return { error: "No se pudieron comprobar las cinco etapas." };
    const blockers = preparationBlockers(c, date, p, category, rule, formats.data as StageFormat[]);
    if (blockers.length) return { error: `No se puede aprobar: ${blockers.join(" ")}` };
    const saved = await db.from("competencia_control_deportivo").update({ configuracion_aprobada: true, estado_deportivo: "preparada" })
      .eq("competencia_id", id).eq("temporada_id", seasonId).eq("configuracion_aprobada", false).eq("estado_deportivo", "pendiente").eq("actualizado_en", revision)
      .select("competencia_id,configuracion_aprobada,estado_deportivo,aprobado_por,aprobado_en").maybeSingle();
    if (saved.error) return { error: preparationError(saved.error) };
    if (!saved.data?.configuracion_aprobada || saved.data.estado_deportivo !== "preparada" || !saved.data.aprobado_por || !saved.data.aprobado_en) return { error: "No se confirmó la aprobación. Recarga y comprueba el estado antes de reintentar." };
    invalidate();
    return { success: "PostgreSQL confirmó la aprobación deportiva y su trazabilidad." };
  } catch (e) { return failure(e); }
}
