import { validBirthDate } from "./jugadores";
import type { PlayerRecord } from "./jugadores";
import type { Rule, SeasonCategory } from "./temporadas-deportivas";

export const HABILITATIONS_PATH = "/panel/juez-general/habilitaciones";
export const HABILITATION_COLUMNS = "id,jugador_id,categoria_temporada_id,estado,tipo_resolucion,motivo,referencia_evidencia,validado_por,validado_en,creado_en";
export const HABILITATION_STATES = { pendiente: "Pendiente", habilitado: "Habilitado", no_habilitado: "No habilitado" } as const;
export const RESOLUTION_TYPES = { ordinaria: "Ordinaria", excepcion_documentada: "Excepción documentada" } as const;
export type Habilitation = {
  id: number; jugador_id: number; categoria_temporada_id: number;
  estado: keyof typeof HABILITATION_STATES; tipo_resolucion: keyof typeof RESOLUTION_TYPES;
  motivo: string | null; referencia_evidencia: string | null; validado_por: string | null; validado_en: string | null; creado_en: string;
};
export type EligibilityCategory = SeasonCategory & { catalogos_activos: boolean };

// No existe actualizado_en en 003: comparar todos los campos de la resolución.
export function habilitationRevision(h: Habilitation | null) {
  return h ? JSON.stringify([h.id, h.estado, h.tipo_resolucion, h.motivo, h.referencia_evidencia, h.validado_por, h.validado_en]) : null;
}

export function eligibilityIssues(player: PlayerRecord, category: EligibilityCategory, rule: Rule | null, exception = false) {
  const issues: string[] = [];
  if (!player.activo) issues.push("Jugador inactivo: revisar con Administración.");
  if (!category.activo || !category.catalogos_activos) issues.push("Categoría o nivel inactivos: revisar con Administración.");
  if (!category.rama) issues.push("La rama de la categoría está pendiente.");
  if (!["rango_anios", "sin_limite"].includes(category.criterio_nacimiento)) issues.push("El criterio de nacimiento está pendiente.");
  if (!rule || rule.id !== category.reglamento_id || rule.temporada_id !== category.temporada_id || rule.estado_revision !== "validado" || !rule.referencia_aprobacion?.trim()) issues.push("Falta reglamento validado con aprobación formal verificable.");
  if (!exception && category.criterio_nacimiento === "rango_anios") {
    if (!player.fecha_nacimiento || !validBirthDate(player.fecha_nacimiento)) issues.push("Nacimiento desconocido o inválido: requiere revisión documentada, no habilitación ordinaria.");
    else {
      const year = Number(player.fecha_nacimiento.slice(0, 4));
      if (category.anio_nacimiento_desde === null || category.anio_nacimiento_hasta === null || year < category.anio_nacimiento_desde || year > category.anio_nacimiento_hasta) issues.push("Nacimiento fuera del rango de la categoría: requiere resolución excepcional documentada.");
    }
  }
  return issues;
}

export function validateHabilitation(form: FormData) {
  const values: Record<string, string> = {}, errors: Record<string, string> = {};
  const read = (key: string) => {
    const raw = form.get(key);
    if (raw !== null && typeof raw !== "string") errors[key] = "No se permiten archivos.";
    return values[key] = typeof raw === "string" ? raw.trim() : "";
  };
  const estado = read("estado"), tipo = read("tipo_resolucion"), motivo = read("motivo"), referencia = read("referencia_evidencia");
  if (!Object.hasOwn(HABILITATION_STATES, estado)) errors.estado = "Selecciona pendiente, habilitado o no habilitado.";
  if (!Object.hasOwn(RESOLUTION_TYPES, tipo)) errors.tipo_resolucion = "Selecciona ordinaria o excepción documentada.";
  const required = estado !== "pendiente" || tipo === "excepcion_documentada";
  if ((required && !motivo) || motivo.length > 2000) errors.motivo = "La resolución requiere motivo de 1 a 2000 caracteres.";
  if ((required && !referencia) || referencia.length > 1000) errors.referencia_evidencia = "La resolución requiere referencia documental de 1 a 1000 caracteres.";
  if (estado === "habilitado" && form.get("confirmacion") !== "revisada") errors.confirmacion = "Confirma la revisión documental de elegibilidad, rama y restricciones deportivas.";
  return { values, errors, payload: { estado: estado as Habilitation["estado"], tipo_resolucion: tipo as Habilitation["tipo_resolucion"], motivo: motivo || null, referencia_evidencia: referencia || null } };
}

export function filterHabilitationPlayers(players: PlayerRecord[], records: Habilitation[], filters: { q?: string; estado?: string; tipo?: string; activo?: string; cuenta?: string }) {
  const byPlayer = new Map(records.map(h => [h.jugador_id, h]));
  const q = (filters.q ?? "").trim().toLocaleLowerCase("es");
  return players.filter(p => {
    const h = byPlayer.get(p.id);
    return (!q || `${p.nombre_completo} #${p.id}`.toLocaleLowerCase("es").includes(q))
      && (!filters.estado || filters.estado === "todos" || (filters.estado === "sin_resolucion" ? !h : h?.estado === filters.estado))
      && (!filters.tipo || filters.tipo === "todos" || h?.tipo_resolucion === filters.tipo)
      && (!filters.activo || filters.activo === "todos" || p.activo === (filters.activo === "activo"))
      && (!filters.cuenta || filters.cuenta === "todas" || (filters.cuenta === "con" ? !!p.perfil_id : !p.perfil_id));
  });
}

export function habilitationError(code?: string) {
  if (code === "42501") return "PostgreSQL rechazó la operación por permisos. Comprueba tu sesión de Juez General.";
  if (code === "23514") return "PostgreSQL rechazó la resolución. Revisa reglas pendientes, nacimiento, estados y evidencia documental.";
  if (code === "23505") return "Otra sesión ya registró esta habilitación. Recarga antes de revisarla.";
  if (code === "23503") return "El jugador o la categoría ya no están disponibles. Recarga las opciones.";
  return "No se pudo confirmar el guardado. Recarga y comprueba la resolución antes de reintentar.";
}
