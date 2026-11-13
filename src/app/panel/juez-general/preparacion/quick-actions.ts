"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";
import { COMPETITION_COLUMNS, type Competition } from "@/lib/competencias";
import { PREPARATION_COLUMNS, FORMAT_COLUMNS, STAGES, STAGE_LABELS, type Preparation, type StageFormat } from "@/lib/preparacion-deportiva";
import { compatibleTemplate, formatsRevision, selectedIds, type QuickState, type QuickResult } from "@/lib/preparacion-rapida";
import { savePreparation, saveStageFormat, approvePreparation } from "./actions";

const text = (form: FormData, key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
const uncertain = "No se pudo comprobar el resultado. Recarga antes de reintentar.";

export async function saveQuickPreparations(season: number, day: number, _previous: QuickState, form: FormData): Promise<QuickState> {
  await requireRole("juez_general");
  const ids = selectedIds(form);
  if (!ids || ![season, day].every(id => validId(String(id)))) return { error: "Selecciona entre 1 y 100 competencias válidas de la jornada." };
  const results: QuickResult[] = [];
  for (const id of ids) {
    const steps: QuickResult["steps"] = []; results.push({ id, steps });
    try {
      const db = await createClient();
      const [competition, control, stages] = await Promise.all([
        db.from("competencias").select(COMPETITION_COLUMNS).eq("id", id).eq("temporada_id", season).eq("fecha_id", day).maybeSingle(),
        db.from("competencia_control_deportivo").select(PREPARATION_COLUMNS).eq("competencia_id", id).eq("temporada_id", season).maybeSingle(),
        db.from("competencia_formatos_sets").select(FORMAT_COLUMNS).eq("competencia_id", id),
      ]);
      if (competition.error || !competition.data || control.error || stages.error || !Array.isArray(stages.data)) throw Error();
      const c = competition.data as Competition, p = control.data as Preparation | null, formats = stages.data as StageFormat[];
      if ((p?.actualizado_en ?? "") !== text(form, `${id}.revision`)) { steps.push({ label: "Borrador", error: "El borrador cambió. Recarga antes de guardar." }); continue; }
      const category = await db.from("categorias_temporada").select("id,reglamento_id").eq("id", c.categoria_temporada_id).eq("temporada_id", season).maybeSingle();
      if (category.error || !category.data) throw Error();
      const draft = new FormData();
      for (const field of ["inicio_programado", "ocurrencia", "formato_competencia"]) draft.set(field, text(form, `${id}.${field}`));
      if (!draft.get("formato_competencia")) draft.set("formato_competencia", text(form,"comun.formato"));
      for (const field of ["minimo_participantes", "grupo_minimo", "grupo_maximo", "motivo_resolucion", "referencia_resolucion"] as const) draft.set(field, String(p?.[field] ?? ""));
      const sourceId = text(form, `${id}.plantilla`);
      if (form.get("habituales") === "documentados" || sourceId) {
        const regulation = await db.from("reglamentos_temporada").select("id,estado_revision,referencia_aprobacion").eq("id", category.data.reglamento_id).eq("temporada_id", season).maybeSingle();
        if (regulation.error || regulation.data?.estado_revision !== "validado" || !regulation.data.referencia_aprobacion?.trim()) { steps.push({ label: "Respaldo documental", error: "Falta reglamento validado y referencia de aprobación. No se aplicaron valores habituales ni plantillas y no se guardó esta fila." }); continue; }
        if (form.get("habituales") === "documentados") for (const [field,value] of [["minimo_participantes","4"],["grupo_minimo","3"],["grupo_maximo","4"]]) if (!draft.get(field)) draft.set(field,value);
      }
      let copied: StageFormat[] = [];
      if (sourceId) {
        if (!validId(sourceId) || form.get("reutilizacion") !== "revisada") { steps.push({ label: "Plantilla", error: "Confirma la compatibilidad documental de la configuración de sets." }); continue; }
        const [sourceCompetition, sourceControl, sourceFormats] = await Promise.all([
          db.from("competencias").select(COMPETITION_COLUMNS).eq("id", Number(sourceId)).eq("temporada_id", season).maybeSingle(),
          db.from("competencia_control_deportivo").select(PREPARATION_COLUMNS).eq("competencia_id", Number(sourceId)).eq("temporada_id", season).maybeSingle(),
          db.from("competencia_formatos_sets").select(FORMAT_COLUMNS).eq("competencia_id", Number(sourceId)),
        ]);
        if (sourceCompetition.error || sourceControl.error || sourceFormats.error || !sourceCompetition.data || !sourceControl.data || !Array.isArray(sourceFormats.data)
          || !compatibleTemplate(c, category.data.reglamento_id, { competition: sourceCompetition.data, control: sourceControl.data, formats: sourceFormats.data, label: "" })) { steps.push({ label: "Plantilla", error: "La fuente ya no está aprobada, completa o compatible con la categoría y reglamento vigentes." }); continue; }
        if (draft.get("formato_competencia") !== sourceControl.data.formato_competencia) { steps.push({ label: "Plantilla", error: "Selecciona el mismo formato deportivo que la configuración aprobada." }); continue; }
        copied = sourceFormats.data;
      }
      const saved = await savePreparation(season, day, id, p?.actualizado_en ?? null, {}, draft);
      steps.push({ label: "Borrador", success: saved.success, error: saved.error });
      if (!saved.success || saved.error) continue;
      for (const stage of STAGES) {
        const current = formats.find(f => f.etapa === stage);
        // La vista rápida completa únicamente sets ausentes; no altera etapas guardadas.
        if (current) continue;
        const source = copied.find(f => f.etapa === stage);
        const value = source ? String(source.mejor_de) : text(form, `${id}.sets.${stage}`) || text(form, `comun.${stage}`);
        if (!value) { steps.push({ label: STAGE_LABELS[stage], error: "Pendiente de configurar; el borrador se conservó." }); continue; }
        const stageForm = new FormData(); stageForm.set("mejor_de", value);
        stageForm.set("referencia_resolucion", source?.referencia_resolucion ?? "");
        const result = await saveStageFormat(season, day, id, stage, null, {}, stageForm);
        steps.push({ label: STAGE_LABELS[stage], success: result.success, error: result.error });
      }
    } catch { steps.push({ label: "Comprobación", error: uncertain }); }
  }
  return { results };
}

export async function approveQuickPreparations(season: number, day: number, _previous: QuickState, form: FormData): Promise<QuickState> {
  await requireRole("juez_general");
  const ids = selectedIds(form);
  if (!ids || ![season, day].every(id => validId(String(id))) || form.get("confirmacion") !== "revisada") return { error: "Selecciona las competencias guardadas y confirma expresamente su revisión documental." };
  const results: QuickResult[] = [];
  for (const id of ids) {
    try {
      const db = await createClient();
      const stages = await db.from("competencia_formatos_sets").select(FORMAT_COLUMNS).eq("competencia_id",id);
      if (stages.error || !Array.isArray(stages.data) || formatsRevision(stages.data) !== text(form,`${id}.sets_revision`)) {
        results.push({ id, steps: [{ label: "Aprobación", error: "Los sets cambiaron o no pudieron verificarse. Recarga y revisa antes de aprobar." }] });
        continue;
      }
      const confirmation = new FormData(); confirmation.set("confirmacion","revisada");
      const result = await approvePreparation(season,day,id,text(form,`${id}.revision`) || null,{},confirmation);
      results.push({ id, steps: [{ label: "Aprobación", success: result.success, error: result.error }] });
    } catch { results.push({ id, steps: [{ label: "Aprobación", error: uncertain }] }); }
  }
  return { results };
}
