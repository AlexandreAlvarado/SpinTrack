import type { CatalogState } from "@/lib/catalogos";

export const TAXONOMY_PATH = "/panel/administrador/categorias-niveles";
export const TAXONOMIES = {
  categorias: { title: "Categorías", singular: "categoría", columns: "id,codigo,nombre,orden_presentacion,activo", codes: {
    peneca: "Peneca", preinfantil: "Preinfantil", infantil: "Infantil", juvenil: "Juvenil", tc: "Todo Competidor",
  } },
  niveles: { title: "Niveles", singular: "nivel", columns: "id,codigo,nombre,activo", codes: {
    inicial: "Inicial", aficionado: "Aficionado", federado: "Federado", unica: "Única",
  } },
} as const;
export type Taxonomy = keyof typeof TAXONOMIES;
export type TaxonomyRecord = { id: number; codigo: string; nombre: string; activo: boolean; orden_presentacion?: number | null };
export type TaxonomyState = CatalogState;

export function isTaxonomy(value: string): value is Taxonomy {
  return Object.hasOwn(TAXONOMIES, value);
}

export function validateTaxonomy(table: Taxonomy, editing: boolean, form: FormData) {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};
  const payload: Record<string, string | number | boolean | null> = {};
  const fields = ["nombre", "activo", ...(!editing ? ["codigo"] : []), ...(table === "categorias" ? ["orden_presentacion"] : [])];
  for (const field of fields) {
    const raw = form.get(field);
    values[field] = typeof raw === "string" ? raw.trim() : "";
    if (raw !== null && typeof raw !== "string") errors[field] = "Ingresa un valor válido.";
  }
  if (!values.nombre || values.nombre.length > 100) errors.nombre = "Ingresa un nombre de 1 a 100 caracteres.";
  if (/(^|[^\p{L}\p{N}_])dobles($|[^\p{L}\p{N}_])/iu.test(values.nombre)) errors.nombre = "Solo se permiten categorías y niveles de competencia individual.";
  payload.nombre = values.nombre;
  if (!editing) {
    if (!Object.hasOwn(TAXONOMIES[table].codes, values.codigo)) errors.codigo = "Selecciona uno de los códigos permitidos.";
    payload.codigo = values.codigo;
  }
  if (table === "categorias") {
    const order = values.orden_presentacion;
    if (order && (!/^(0|[1-9]\d*)$/.test(order) || Number(order) > 2147483647)) errors.orden_presentacion = "Usa un entero entre 0 y 2147483647 o deja el campo vacío.";
    payload.orden_presentacion = order ? Number(order) : null;
  }
  if (values.activo !== "true" && values.activo !== "false") errors.activo = "Selecciona el estado del registro.";
  payload.activo = values.activo === "true";
  return { values, errors, payload };
}

export function taxonomyError(error: { code?: string; message?: string }) {
  if (error.code === "23505") return "Ese código ya está registrado. Busca el registro existente para editarlo o reactivarlo; no crees un duplicado.";
  if (error.code === "23514" && error.message?.startsWith("Fuente ya referenciada:")) return "Este registro ya está asociado a una temporada. La migración 003 impide modificarlo o desactivarlo para conservar su significado. No se guardaron cambios.";
  if (["23514", "22001", "22P02", "22003"].includes(error.code ?? "")) return "Los datos no cumplen las restricciones de PostgreSQL. Revisa el código, el nombre y el orden de presentación.";
  if (error.code === "42501") return "No tienes permisos para guardar. Comprueba tu sesión de Administrador y las políticas RLS.";
  return "No se pudo guardar. Comprueba la conexión y que la migración 003 esté aplicada; vuelve a intentarlo.";
}
