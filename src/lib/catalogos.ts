export const CATALOGS = {
  localidades: { title: "Localidades", singular: "localidad", columns: "id,nombre,region,pais,activo" },
  asociaciones: { title: "Asociaciones", singular: "asociación", columns: "id,nombre,localidad_id,activo" },
  clubes: { title: "Clubes", singular: "club", columns: "id,nombre,localidad_id,asociacion_id,activo" },
} as const;

export type Catalog = keyof typeof CATALOGS;
export type CatalogRecord = {
  id: number;
  nombre: string;
  activo: boolean;
  region?: string | null;
  pais?: string | null;
  localidad_id?: number | null;
  asociacion_id?: number | null;
};
export type CatalogOption = Pick<CatalogRecord, "id" | "nombre" | "activo">;
export type CatalogState = {
  error?: string;
  success?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
};

export function isCatalog(value: string): value is Catalog {
  return Object.hasOwn(CATALOGS, value);
}

export function catalogPath(catalog: Catalog) {
  return `/panel/administrador/catalogos/${catalog}`;
}

export function validId(value: string) {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}

export function validateCatalog(catalog: Catalog, formData: FormData) {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};
  const payload: Record<string, string | number | boolean | null> = {};
  const textFields = catalog === "localidades" ? ["nombre", "region", "pais"] : ["nombre"];
  for (const name of textFields) {
    const raw = formData.get(name);
    const value = typeof raw === "string" ? raw.trim() : "";
    values[name] = value;
    const max = name === "pais" ? 100 : 150;
    if ((name === "nombre" && !value) || value.length > max || (raw !== null && typeof raw !== "string")) {
      errors[name] = name === "nombre" ? "Ingresa un nombre de 1 a 150 caracteres." : `Usa como máximo ${max} caracteres.`;
    }
    payload[name] = value || null;
  }
  const relations = catalog === "localidades" ? [] : catalog === "clubes" ? ["localidad_id", "asociacion_id"] : ["localidad_id"];
  for (const name of relations) {
    const raw = formData.get(name);
    const value = typeof raw === "string" ? raw : "";
    values[name] = value;
    if ((value && !validId(value)) || (raw !== null && typeof raw !== "string")) errors[name] = "Selecciona una opción válida.";
    payload[name] = value ? Number(value) : null;
  }
  const active = formData.get("activo");
  values.activo = typeof active === "string" ? active : "";
  if (active !== "true" && active !== "false") errors.activo = "Selecciona el estado del registro.";
  payload.activo = active === "true";
  return { values, errors, payload };
}

export function catalogError(code?: string) {
  if (code === "23503") return "La localidad o asociación seleccionada ya no existe. Actualiza las opciones e intenta nuevamente.";
  if (code === "23514" || code === "22001" || code === "22P02") return "Hay datos que no cumplen las restricciones. Revisa los campos.";
  if (code === "42501") return "No tienes permisos para guardar. Comprueba tu sesión de Administrador y las políticas RLS.";
  if (code === "23505") return "El registro entra en conflicto con un dato existente. Revisa los valores.";
  return "No se pudo guardar. Comprueba la conexión e inténtalo nuevamente; si persiste, revisa la configuración y permisos de Supabase.";
}
