"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { acceptsLegal, LEGAL_VERSION, LEGAL_REVIEW_PENDING } from "@/lib/legal";

export async function acceptTerms(form: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?error=sesion");
  if (!acceptsLegal(form)) redirect("/aceptar-terminos?error=aceptacion");
  if (LEGAL_REVIEW_PENDING) redirect("/aceptar-terminos?error=revision");
  const db = await createClient();
  const { error } = await db.rpc("aceptar_terminos_028", { p_version: LEGAL_VERSION, p_acepta: true });
  if (error) redirect("/aceptar-terminos?error=servicio");
  revalidatePath("/", "layout");
  redirect("/panel");
}
