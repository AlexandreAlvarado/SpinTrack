"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";
import { PLAYERS_PATH, playerError, validatePlayer, type PlayerState } from "@/lib/jugadores";

export async function savePlayer(id: number | null, _previous: PlayerState, formData: FormData): Promise<PlayerState> {
  // Incluye crear, editar, vincular y desvincular cuentas: nunca confiar en el formulario.
  await requireRole("administrador");
  if (id !== null && !validId(String(id))) return { error: "El identificador del jugador no es válido." };
  const { payload, errors, values } = validatePlayer(formData);
  if (Object.keys(errors).length) return { error: "Revisa los campos indicados.", errors, values };
  try {
    const supabase = await createClient();
    // FK(perfil_id) verifica existencia; UNIQUE impide doble vínculo incluso con solicitudes concurrentes.
    const result = id === null
      ? await supabase.from("jugadores").insert(payload).select("id").single()
      : await supabase.from("jugadores").update(payload).eq("id", id).select("id").maybeSingle();
    if (result.error) return { error: playerError(result.error.code), values };
    if (!result.data) return { error: "El jugador no existe o tu sesión no permite modificarlo.", values };
  } catch {
    return { error: "No se pudo confirmar el guardado. Comprueba la conexión antes de reintentar para evitar un registro duplicado.", values };
  }
  revalidatePath(PLAYERS_PATH);
  return { success: id === null ? "Jugador registrado correctamente. Conserva su ID para identificarlo." : "Datos del jugador guardados correctamente.", values: id === null ? undefined : values };
}

export async function setPlayerActive(id: number, activo: boolean): Promise<PlayerState> {
  await requireRole("administrador");
  if (!validId(String(id)) || typeof activo !== "boolean") return { error: "La operación solicitada no es válida." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("jugadores").update({ activo }).eq("id", id).select("id").maybeSingle();
    if (error) return { error: playerError(error.code) };
    if (!data) return { error: "El jugador no existe o tu sesión no permite modificarlo." };
  } catch {
    return { error: "No se pudo confirmar el cambio de estado. Comprueba la conexión e inténtalo nuevamente." };
  }
  revalidatePath(PLAYERS_PATH);
  return { success: activo ? "Jugador activado." : "Jugador desactivado; sus datos se conservan." };
}
