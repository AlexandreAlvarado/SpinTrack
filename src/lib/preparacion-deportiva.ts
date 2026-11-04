import { localDateTime, santiagoCandidates, type Competition, type CompetitionDate } from "./competencias";
import type { Rule, SeasonCategory } from "./temporadas-deportivas";

export const JUDGE_PATH = "/panel/juez-general/preparacion";
export const STAGES = ["grupos", "previa_cuartos", "cuartos", "semifinal", "final"] as const;
export const STAGE_LABELS = { grupos: "Grupos", previa_cuartos: "Eliminatoria previa a cuartos", cuartos: "Cuartos", semifinal: "Semifinal", final: "Final" };
export type Stage = typeof STAGES[number];
export type Preparation = {
  competencia_id: number; temporada_id: number; configuracion_aprobada: boolean; estado_deportivo: string;
  inicio_programado: string | null; minimo_participantes: number | null; grupo_minimo: number | null; grupo_maximo: number | null;
  formato_competencia: string | null; reglamento_id: number | null; motivo_resolucion: string | null; referencia_resolucion: string | null;
  actualizado_por: string; actualizado_en: string; aprobado_por: string | null; aprobado_en: string | null;
};
export type StageFormat = { competencia_id: number; etapa: Stage; mejor_de: number; referencia_resolucion: string | null; actualizado_en: string; actualizado_por: string };
export type SportsCategory = SeasonCategory & { catalogos_activos: boolean };
export const PREPARATION_COLUMNS = "competencia_id,temporada_id,configuracion_aprobada,estado_deportivo,inicio_programado,minimo_participantes,grupo_minimo,grupo_maximo,formato_competencia,reglamento_id,motivo_resolucion,referencia_resolucion,actualizado_por,actualizado_en,aprobado_por,aprobado_en";
export const FORMAT_COLUMNS = "competencia_id,etapa,mejor_de,referencia_resolucion,actualizado_por,actualizado_en";

export function preparationLock(c: Competition, p: Preparation | null) {
  if (c.publicada || c.inscripciones_habilitadas) return "Administración debe retirar la publicación y deshabilitar inscripciones antes de revisar la preparación.";
  if (p?.configuracion_aprobada) return "Configuración aprobada: se conserva en lectura. La revisión de una aprobación requiere un flujo posterior explícito.";
  if (p && p.estado_deportivo !== "pendiente") return "El estado deportivo actual se muestra en lectura; este módulo no cambia estados operativos.";
  return null;
}

export function validatePreparation(form: FormData, day: string) {
  const values: Record<string, string> = {}, errors: Record<string, string> = {};
  const read = (key: string) => {
    const raw = form.get(key);
    if (raw !== null && typeof raw !== "string") errors[key] = "No se permiten archivos.";
    return values[key] = typeof raw === "string" ? raw.trim() : "";
  };
  const integer = (key: string, groups = false) => {
    const v = read(key);
    if (v && (!/^\d+$/.test(v) || Number(v) < 1 || Number(v) > 2147483647 || (groups && ![3, 4].includes(Number(v))))) errors[key] = groups ? "Selecciona 3 o 4." : "Usa un entero positivo válido.";
    return v ? Number(v) : null;
  };
  const local = read("inicio_programado"), occurrence = read("ocurrencia");
  const choices = local ? santiagoCandidates(local) : [];
  let inicio: string | null = null;
  if (local) {
    if (!choices.length) errors.inicio_programado = "Hora inválida o inexistente en America/Santiago.";
    else if (choices.length > 1 && !["primera", "segunda"].includes(occurrence)) errors.inicio_programado = "Hora repetida: indica primera o segunda ocurrencia.";
    else inicio = choices[choices.length > 1 && occurrence === "segunda" ? 1 : 0];
    if (inicio && localDateTime(inicio).slice(0, 10) !== day) errors.inicio_programado = "El inicio debe pertenecer al día de la jornada en America/Santiago.";
  }
  const minimo = integer("minimo_participantes"), min = integer("grupo_minimo", true), max = integer("grupo_maximo", true);
  if (min && max && min > max) errors.grupo_maximo = "El máximo no puede ser inferior al mínimo.";
  const formato = read("formato_competencia");
  if (formato && formato !== "grupos_eliminacion_simple") errors.formato_competencia = "Formato no implementado.";
  const motivo = read("motivo_resolucion"), referencia = read("referencia_resolucion");
  if (motivo.length > 2000) errors.motivo_resolucion = "Máximo 2000 caracteres.";
  if (referencia.length > 1000) errors.referencia_resolucion = "Máximo 1000 caracteres.";
  if (minimo && minimo < 4 && (!motivo || !referencia)) errors.minimo_participantes = "Un mínimo inferior a cuatro exige motivo y resolución documentada.";
  return { values, errors, payload: { inicio_programado: inicio, minimo_participantes: minimo, grupo_minimo: min, grupo_maximo: max, formato_competencia: formato || null, motivo_resolucion: motivo || null, referencia_resolucion: referencia || null } };
}

export function validateStage(form: FormData) {
  const raw = form.get("mejor_de"), ref = form.get("referencia_resolucion");
  const values = { mejor_de: typeof raw === "string" ? raw : "", referencia_resolucion: typeof ref === "string" ? ref.trim() : "" };
  const errors: Record<string, string> = {};
  if (!["3", "5"].includes(values.mejor_de)) errors.mejor_de = "Selecciona al mejor de 3 o de 5 sets.";
  if ((ref !== null && typeof ref !== "string") || values.referencia_resolucion.length > 1000) errors.referencia_resolucion = "Referencia inválida (máximo 1000 caracteres).";
  return { values, errors, payload: { mejor_de: Number(values.mejor_de), referencia_resolucion: values.referencia_resolucion || null } };
}

export function preparationBlockers(c: Competition, date: Pick<CompetitionDate, "fecha">, p: Preparation | null, category: SportsCategory | null, rule: Rule | null, formats: StageFormat[]) {
  const reasons: string[] = [];
  if (!c.activo) reasons.push("Competencia inactiva: revisar con Administración.");
  if (!p) reasons.push("Guardar primero el borrador deportivo.");
  if (!p?.inicio_programado) reasons.push("Falta el inicio deportivo.");
  else {
    if (localDateTime(p.inicio_programado).slice(0, 10) !== date.fecha) reasons.push("El inicio no pertenece al día de la jornada en America/Santiago.");
    if (c.inscripcion_cierra_en && new Date(c.inscripcion_cierra_en) > new Date(p.inicio_programado)) reasons.push("El cierre administrativo de inscripciones es posterior al inicio deportivo.");
  }
  if (!p?.minimo_participantes) reasons.push("Falta el mínimo de participantes.");
  if (p?.minimo_participantes && p.minimo_participantes < 4 && (!p.motivo_resolucion?.trim() || !p.referencia_resolucion?.trim())) reasons.push("El mínimo excepcional necesita motivo y referencia documental.");
  if (!p?.grupo_minimo || !p.grupo_maximo) reasons.push("Faltan los tamaños de grupos (3 o 4).");
  if (p?.formato_competencia !== "grupos_eliminacion_simple") reasons.push("Falta el formato de grupos y eliminación simple.");
  if (!category?.activo || !category.catalogos_activos || !category.rama || category.criterio_nacimiento === "pendiente") reasons.push("Categoría, nivel, rama o criterio de nacimiento pendientes/inactivos: revisar con Administración.");
  if (!rule || rule.estado_revision !== "validado" || !rule.referencia_aprobacion?.trim()) reasons.push("Reglamento pendiente de validación formal por Administración.");
  if (!p?.reglamento_id || p.reglamento_id !== category?.reglamento_id || p.reglamento_id !== rule?.id) reasons.push("Falta asociar al borrador el reglamento de la categoría.");
  for (const stage of STAGES) if (!formats.some(f => f.etapa === stage && [3, 5].includes(f.mejor_de))) reasons.push(`Faltan sets válidos para ${STAGE_LABELS[stage]}.`);
  return reasons;
}

export function preparationError(error: { code?: string }) {
  if (error.code === "42501") return "PostgreSQL rechazó la operación por permisos. Revisa tu sesión de Juez General.";
  if (error.code === "23514") return "PostgreSQL rechazó la configuración: revisa reglas pendientes, aprobación vigente, publicación y plazos. No se confirmó el cambio.";
  if (error.code === "23505") return "Otra sesión ya creó este registro. Recarga antes de continuar.";
  if (error.code === "23503") return "La competencia o el reglamento ya no están disponibles en esta temporada.";
  return "No se pudo confirmar el cambio. Recarga y comprueba los registros antes de reintentar.";
}
