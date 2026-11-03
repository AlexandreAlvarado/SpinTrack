import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CatalogOption } from "@/lib/catalogos";

export type ProfileOption = { id: string; nombre_completo: string; rol: string };

// Opciones completas sin depender del límite de 1000 filas de PostgREST.
export async function getCatalogOptions(table: "localidades" | "asociaciones" | "clubes") {
  const options: CatalogOption[] = [];
  try {
    const supabase = await createClient();
    for (let from = 0; ; from += 500) {
      const { data, error } = await supabase.from(table).select("id,nombre,activo").order("nombre").order("id").range(from, from + 499);
      if (error) return { data: [], error: true };
      options.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    return { data: options, error: false };
  } catch {
    return { data: [], error: true };
  }
}

// Solo se invoca tras requireRole('administrador') desde la pantalla privada.
export async function getProfileOptions() {
  const options: ProfileOption[] = [];
  try {
    const supabase = await createClient();
    for (let from = 0; ; from += 500) {
      const { data, error } = await supabase.from("perfiles").select("id,nombre_completo,rol").order("nombre_completo").order("id").range(from, from + 499);
      if (error) return { data: [], error: true };
      options.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    return { data: options, error: false };
  } catch {
    return { data: [], error: true };
  }
}
