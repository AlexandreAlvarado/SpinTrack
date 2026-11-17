"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { catalogError, catalogPath, isCatalog, validId, validateCatalog, type Catalog, type CatalogState } from "@/lib/catalogos";

function refreshCatalogs() {
  // Cambiar nombres/estados también modifica las opciones de los otros catálogos.
  for (const catalog of ["localidades", "asociaciones", "clubes"] as const) revalidatePath(catalogPath(catalog));
}

export async function saveCatalog(catalog: Catalog, id: number | null, _previous: CatalogState, formData: FormData): Promise<CatalogState> {
  await requireRole("administrador");
  if (!isCatalog(catalog) || (id !== null && !validId(String(id)))) return { error: "El registro solicitado no es válido." };
  const { payload, values, errors } = validateCatalog(catalog, formData);
  if (Object.keys(errors).length) return { error: "Revisa los campos indicados.", errors, values };
  // El formulario ya no gestiona asociaciones: al editar un club se conserva
  // cualquier vínculo existente; un club nuevo puede quedar sin asociación.
  const writePayload = catalog === "clubes" && id !== null ? Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "asociacion_id")) : payload;
  try {
    const supabase = await createClient();
    const result = id === null
      ? await supabase.from(catalog).insert(writePayload).select("id").single()
      : await supabase.from(catalog).update(writePayload).eq("id", id).select("id").maybeSingle();
    if (result.error) return { error: catalogError(result.error.code), values };
    if (!result.data) return { error: "El registro ya no existe o tu sesión no permite modificarlo.", values };
  } catch {
    return { error: "No se pudo conectar con Supabase. Tus datos no se han confirmado; vuelve a intentarlo.", values };
  }
  refreshCatalogs();
  return { success: id === null ? "Registro creado correctamente." : "Cambios guardados correctamente.", values: id === null ? undefined : values };
}

export async function setCatalogActive(catalog: Catalog, id: number, activo: boolean): Promise<CatalogState> {
  await requireRole("administrador");
  if (!isCatalog(catalog) || !validId(String(id)) || typeof activo !== "boolean") return { error: "La operación solicitada no es válida." };
  try {
    const supabase = await createClient();
    // Asignar el estado solicitado es idempotente: no invertirlo tras un doble envío.
    const { data, error } = await supabase.from(catalog).update({ activo }).eq("id", id).select("id").maybeSingle();
    if (error) return { error: catalogError(error.code) };
    if (!data) return { error: "El registro ya no existe o tu sesión no permite modificarlo." };
  } catch {
    return { error: "No se pudo confirmar el cambio de estado. Comprueba la conexión e inténtalo otra vez." };
  }
  refreshCatalogs();
  return { success: activo ? "Registro activado." : "Registro desactivado. Sus relaciones se conservan." };
}
