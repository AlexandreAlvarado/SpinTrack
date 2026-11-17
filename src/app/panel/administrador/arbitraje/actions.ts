"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function setRefereeEnabled(_previous: { error?: string; success?: string }, form: FormData): Promise<{ error?: string; success?: string }> {
  await requireRole("administrador");
  const id = String(form.get("perfil_id") ?? "");
  const expected = form.get("esperado");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !["true", "false"].includes(String(expected))) return { error: "Cuenta o estado inválido." };
  const db = await createClient();
  const { error } = await db.rpc("habilitar_arbitraje_023", { p_perfil_id: id, p_habilitado: expected !== "true", p_esperado: expected === "true" });
  if (error) return { error: error.code === "40001" ? "La habilitación cambió. Recarga antes de continuar." : "No se pudo cambiar la habilitación. Verifica la aplicación manual de 023." };
  revalidatePath("/panel", "layout");
  return { success: expected === "true" ? "Arbitraje deshabilitado." : "Arbitraje habilitado." };
}
