"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validateSportsProfile } from "@/lib/perfil-deportivo";
import { PERSONAL_DATA_REVIEW_PENDING } from "@/lib/legal";

export async function saveSportsProfile(form: FormData) {
  await requireProfile();
  if (PERSONAL_DATA_REVIEW_PENDING) redirect("/panel/jugador/perfil?error=revision");
  const payload = validateSportsProfile(form);
  if (!payload) redirect("/panel/jugador/perfil?error=datos");
  const db = await createClient();
  const { error } = await db.rpc("editar_mi_perfil_deportivo_029", payload);
  if (error) redirect(`/panel/jugador/perfil?error=${error.code === "40001" ? "cambio" : error.code === "55000" ? "antecedentes" : error.code === "22023" ? "datos" : "guardar"}`);
  revalidatePath("/panel/jugador");
  revalidatePath("/panel/jugador/perfil");
  redirect("/panel/jugador/perfil?ok=1");
}
