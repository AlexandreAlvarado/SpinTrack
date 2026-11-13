export const REGISTRATIONS_PATH = "/panel/juez-general/inscripciones";
// SELECT * está prohibido por los permisos de columnas de 004.
export const REGISTRATION_COLUMNS = "id,jugador_id,competencia_id,estado,creado_en,actualizado_en,antecedentes";
export const HISTORY_COLUMNS = "id,inscripcion_id,estado_anterior,estado_nuevo,actor,ocurrido_en,motivo,referencia_resolucion,antecedentes";
export const REGISTRATION_STATES = { pendiente: "Pendiente", aceptada: "Aceptada", rechazada: "Rechazada", cancelada: "Cancelada" } as const;
export type Registration = { id: number; jugador_id: number; competencia_id: number; estado: keyof typeof REGISTRATION_STATES; creado_en: string; actualizado_en: string; antecedentes: unknown };
export type RegistrationHistory = { id: number; inscripcion_id: number; estado_anterior: string | null; estado_nuevo: string; actor: string; ocurrido_en: string; motivo: string | null; referencia_resolucion: string | null; antecedentes: unknown };

// Presentation only: preserve stored evidence and hide legacy monetary fields,
// including snapshots nested in historical events.
export function sportsEvidence(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sportsEvidence);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "tarifa_clp").map(([key, item]) => [key, sportsEvidence(item)]));
  return value;
}

export function validateDecision(form: FormData) {
  const values: Record<string, string> = {};
  for (const key of ["estado", "motivo", "referencia"]) {
    const value = form.get(key);
    values[key] = typeof value === "string" ? value.trim() : "";
  }
  const valid = ["aceptada", "rechazada"].includes(values.estado) && values.motivo.length > 0 && values.motivo.length <= 2000 && values.referencia.length > 0 && values.referencia.length <= 1000 && form.get("confirmacion") === "revisada";
  return { values, valid };
}

export function decisionConfirmed(row: Registration | null, history: RegistrationHistory | null, id: number, competition: number, actor: string, values: Record<string, string>) {
  return !!row && !!history && row.id === id && row.competencia_id === competition && row.estado === values.estado && history.inscripcion_id === id && history.estado_anterior === "pendiente" && history.estado_nuevo === values.estado && history.actor === actor && history.motivo === values.motivo && history.referencia_resolucion === values.referencia && Number.isFinite(Date.parse(history.ocurrido_en)) && Date.parse(history.ocurrido_en) === Date.parse(row.actualizado_en);
}
