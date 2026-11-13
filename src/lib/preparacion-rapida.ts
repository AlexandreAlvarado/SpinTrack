import { STAGES, type Preparation, type StageFormat } from "./preparacion-deportiva";
import type { Competition } from "./competencias";

export type PreparationTemplate = { competition: Competition; control: Preparation; formats: StageFormat[]; label: string };
export type QuickResult = { id: number; steps: { label: string; success?: string; error?: string }[] };
export type QuickState = { error?: string; results?: QuickResult[] };

export function completeFormats(formats: StageFormat[]) {
  return formats.length === STAGES.length && STAGES.every(s => formats.filter(f => f.etapa === s && [3, 5].includes(f.mejor_de)).length === 1);
}

// La compatibilidad documental entre categorías diferentes no está modelada en 003.
// Reutilización conservadora: misma categoría/temporada y mismo reglamento vigente.
export function compatibleTemplate(target: Competition, ruleId: number | null, source: PreparationTemplate) {
  return target.id !== source.competition.id && target.temporada_id === source.competition.temporada_id
    && target.categoria_temporada_id === source.competition.categoria_temporada_id
    && source.control.competencia_id === source.competition.id && source.control.temporada_id === target.temporada_id
    && source.control.configuracion_aprobada && !!source.control.aprobado_por && !!source.control.aprobado_en
    && !!ruleId && source.control.reglamento_id === ruleId
    && source.control.formato_competencia === "grupos_eliminacion_simple" && completeFormats(source.formats)
    && source.formats.every(f => f.competencia_id === source.competition.id);
}

export function formatsRevision(formats: StageFormat[]) {
  return JSON.stringify(STAGES.map(stage => {
    const f = formats.find(f => f.etapa === stage);
    return f ? [stage,f.mejor_de,f.referencia_resolucion,f.actualizado_en] : [stage];
  }));
}

// Horarios comunicados expresamente por el desarrollador. Solo se proponen mediante
// una acción local del Juez; no se persisten ni se trasladan a otra jornada.
export function officialStart(day: string, category: string, level: string, branch: string | null) {
  if (day !== "2026-11-07") return "";
  const hours: Record<string, string> = {
    juvenil_inicial: "10:00", juvenil_federado: "10:00", infantil_inicial: "11:00", infantil_federado: "11:00",
    preinfantil_inicial: "11:30", preinfantil_federado: "11:30", peneca_inicial: "13:00", tc_federado: "13:30", tc_aficionado: "15:30",
  };
  const time = category === "tc" && level === "unica" && branch === "damas" ? "15:30" : hours[`${category}_${level}`];
  return time ? `${day}T${time}` : "";
}

export function selectedIds(form: FormData) {
  const ids = form.getAll("competencia");
  if (!ids.length || ids.length > 100 || ids.some(id => typeof id !== "string" || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) || new Set(ids).size !== ids.length) return null;
  return ids.map(Number);
}
