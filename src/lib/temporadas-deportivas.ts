import type { CatalogState } from "./catalogos";

export const SEASON_PATH = "/panel/administrador/temporadas-deportivas";
export type SeasonState = CatalogState;
export type Season = { id: number; nombre: string; anio: number };
export type Concept = { id: number; codigo: string; nombre: string; activo: boolean };
export type Rule = { id: number; temporada_id: number; version: string; titulo: string; referencia_documental: string; hash_documento: string | null; estado_revision: string; referencia_aprobacion: string | null };
export type SeasonCategory = { id: number; temporada_id: number; categoria_id: number; nivel_id: number; codigo: string; rama: string | null; criterio_nacimiento: string; anio_nacimiento_desde: number | null; anio_nacimiento_hasta: number | null; reglamento_id: number | null; activo: boolean };
export const COMBINATIONS: Record<string, readonly string[]> = {
  peneca: ["inicial"], preinfantil: ["inicial", "federado"], infantil: ["inicial", "federado"], juvenil: ["inicial", "federado"], tc: ["aficionado", "federado", "unica"],
};
export function allowedCombination(category: string, level: string, branch: string | null) {
  return Object.hasOwn(COMBINATIONS, category) && COMBINATIONS[category].includes(level) && !(category === "tc" && level === "unica" && branch !== null && branch !== "damas");
}
export function validateSeasonForm(kind: "reglamentos" | "categorias", editing: boolean, form: FormData, year: number) {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};
  const payload: Record<string, string | number | boolean | null> = {};
  const read = (key: string) => values[key] = typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
  const text = (key: string, max: number, required = true) => {
    const value = read(key);
    if ((required && !value) || value.length > max) errors[key] = `Indica un texto de ${required ? "1" : "0"} a ${max} caracteres.`;
    payload[key] = value || null;
  };
  const choice = (key: string, choices: string[], optional = false) => {
    const value = read(key);
    if (!choices.includes(value) && !(optional && !value)) errors[key] = "Selecciona una opción válida.";
    payload[key] = value || null;
    return value;
  };
  const identifier = (key: string, optional = false) => {
    const value = read(key);
    if (!(/^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))) && !(optional && !value)) errors[key] = "Selecciona un registro válido.";
    payload[key] = value ? Number(value) : null;
  };
  if (kind === "reglamentos") {
    if (!editing) text("version", 50);
    text("titulo", 200);
    text("referencia_documental", 1000);
    const hash = read("hash_documento");
    if (hash && !/^[a-f0-9]{64}$/.test(hash)) errors.hash_documento = "Usa un SHA-256 de 64 caracteres hexadecimales en minúsculas o deja vacío.";
    payload.hash_documento = hash || null;
    const status = choice("estado_revision", ["pendiente", "validado"]);
    text("referencia_aprobacion", 1000, false);
    read("confirmacion_liga");
    if (status === "validado") {
      if (!payload.referencia_aprobacion) errors.referencia_aprobacion = "Se requiere una referencia de aprobación formal de la Liga.";
      if (values.confirmacion_liga !== "true") errors.confirmacion_liga = "Confirma que existe una aprobación formal de la Liga.";
    }
  } else {
    if (!editing) { identifier("categoria_id"); identifier("nivel_id"); }
    choice("rama", ["mixta", "varones", "damas"], true);
    const criterion = choice("criterio_nacimiento", ["pendiente", "rango_anios", "sin_limite"]);
    for (const key of ["anio_nacimiento_desde", "anio_nacimiento_hasta"]) {
      const value = read(key);
      payload[key] = value ? Number(value) : null;
      if (criterion === "rango_anios" && (!/^\d{1,4}$/.test(value) || Number(value) < 1 || Number(value) > year)) errors[key] = `Indica un año entre 1 y ${year}.`;
      if (criterion !== "rango_anios" && value) errors[key] = "Deja los años vacíos para este criterio.";
    }
    if (criterion === "rango_anios" && Number(payload.anio_nacimiento_desde) > Number(payload.anio_nacimiento_hasta)) errors.anio_nacimiento_hasta = "El año final no puede ser anterior al inicial.";
    identifier("reglamento_id", true);
    payload.activo = choice("activo", ["true", "false"]) === "true";
  }
  return { payload, values, errors };
}
export function seasonError(error: { code?: string; message?: string }) {
  if (error.code === "23505") return "Ya existe esta versión o combinación en la temporada. Revisa también los registros inactivos.";
  if (error.code === "23503") return "La referencia no existe o pertenece a otra temporada.";
  if (error.code === "42501") return "Tu sesión no está autorizada para esta operación.";
  if (error.code === "23514") return "PostgreSQL rechazó el cambio: revisa los rangos y combinaciones. Una fuente validada y referenciada o una categoría con decisiones deportivas vigentes no puede modificarse; registra una nueva versión cuando corresponda.";
  return "No se pudo guardar. Comprueba la conexión y los permisos antes de reintentar.";
}
