"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";
import { isTaxonomy, TAXONOMY_PATH, taxonomyError, validateTaxonomy, type Taxonomy, type TaxonomyState } from "@/lib/categorias-niveles";

export async function saveTaxonomy(table: Taxonomy, id: number | null, _previous: TaxonomyState, form: FormData): Promise<TaxonomyState> {
  await requireRole("administrador");
  if (!isTaxonomy(table) || (id !== null && !validId(String(id)))) return { error: "El registro solicitado no es válido." };
  const { payload, values, errors } = validateTaxonomy(table, id !== null, form);
  if (Object.keys(errors).length) return { error: "Revisa los campos indicados.", values, errors };
  try {
    const supabase = await createClient();
    // En UPDATE se omite codigo: su edición no está autorizada por la migración 003.
    const result = id === null
      ? await supabase.from(table).insert(payload).select("id").single()
      : await supabase.from(table).update(payload).eq("id", id).select("id").maybeSingle();
    if (result.error) return { error: taxonomyError(result.error), values };
    if (!result.data) return { error: "El registro no existe o tu sesión no permite modificarlo.", values };
  } catch {
    return { error: "No se pudo confirmar el guardado. Comprueba la conexión y busca el código antes de reintentar.", values };
  }
  revalidatePath(TAXONOMY_PATH);
  return { success: id === null ? "Registro creado correctamente." : "Cambios guardados correctamente.", values: id === null ? undefined : values };
}

export async function setTaxonomyActive(table: Taxonomy, id: number, activo: boolean): Promise<TaxonomyState> {
  await requireRole("administrador");
  if (!isTaxonomy(table) || !validId(String(id)) || typeof activo !== "boolean") return { error: "La operación solicitada no es válida." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from(table).update({ activo }).eq("id", id).select("id").maybeSingle();
    if (error) return { error: taxonomyError(error) };
    if (!data) return { error: "El registro no existe o tu sesión no permite modificarlo." };
  } catch {
    return { error: "No se pudo confirmar el cambio de estado. Comprueba la conexión e inténtalo nuevamente." };
  }
  revalidatePath(TAXONOMY_PATH);
  return { success: activo ? "Registro activado." : "Registro desactivado, sin eliminarlo." };
}
