"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/config";

function field(formData: FormData, name: string, max = 150): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function login(formData: FormData) {
  if (!supabaseConfigured()) redirect("/login?error=configuracion");
  const email = field(formData, "email", 320);
  const password = field(formData, "password", 300);
  if (!email || !password) redirect("/login?error=credenciales");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=credenciales");
  redirect("/panel");
}

export async function register(formData: FormData) {
  if (!supabaseConfigured()) redirect("/registro?error=configuracion");
  const nombre = field(formData, "nombre", 120);
  const email = field(formData, "email", 320);
  const password = field(formData, "password", 300);
  if (nombre.length < 3 || !email.includes("@") || password.length < 8) {
    redirect("/registro?error=datos");
  }
  const supabase = await createClient();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: nombre },
      emailRedirectTo: `${baseUrl}/auth/callback`,
    },
  });
  if (error) redirect("/registro?error=registro");
  if (data.session) redirect("/panel");
  redirect("/login?info=confirmacion");
}

export async function logout() {
  if (!supabaseConfigured()) redirect("/");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function createSeason(formData: FormData) {
  await requireRole("administrador");
  const nombre = field(formData, "nombre", 100);
  const anio = Number(field(formData, "anio", 4));
  if (!nombre || !Number.isInteger(anio) || anio < 2020 || anio > 2100) {
    redirect("/panel/administrador?error=temporada");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("temporadas").insert({ nombre, anio });
  if (error) redirect("/panel/administrador?error=temporada");
  revalidatePath("/panel/administrador");
  redirect("/panel/administrador?ok=temporada");
}

export async function createEventDate(formData: FormData) {
  await requireRole("administrador");
  const temporadaId = Number(field(formData, "temporada_id", 20));
  const numero = Number(field(formData, "numero", 3));
  const fecha = field(formData, "fecha", 10);
  const comuna = field(formData, "comuna", 100);
  const recinto = field(formData, "recinto", 150);
  const estado = field(formData, "estado", 20);
  if (!Number.isInteger(temporadaId) || temporadaId <= 0 || !Number.isInteger(numero) || numero < 1 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !comuna || !recinto ||
      !["borrador", "publicada"].includes(estado)) {
    redirect("/panel/administrador?error=fecha");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("fechas").insert({
    temporada_id: temporadaId, numero, fecha, comuna, recinto, estado,
  });
  if (error) redirect("/panel/administrador?error=fecha");
  revalidatePath("/panel/administrador");
  revalidatePath("/");
  revalidatePath("/calendario");
  redirect("/panel/administrador?ok=fecha");
}
