import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRole, ROLE_PATHS, type Role } from "@/lib/roles";
import { supabaseConfigured } from "@/lib/config";

export async function getCurrentIdentity() {
  if (!supabaseConfigured()) return { authenticated: false, profile: null };
  const supabase = await createClient();
  // getClaims verifica el token; nunca se confía en roles recibidos del navegador.
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return { authenticated: false, profile: null };

  const { data: profile, error: profileError } = await supabase
    .from("perfiles")
    .select("id, nombre_completo, rol")
    .eq("id", claims.sub)
    .single();
  if (profileError || !profile || !isRole(profile.rol)) return { authenticated: true, profile: null };
  return { authenticated: true, profile: {
    id: profile.id as string,
    nombre: (profile.nombre_completo || "Usuario") as string,
    rol: profile.rol as Role,
    email: typeof claims.email === "string" ? claims.email : "",
  } };
}

export async function getCurrentProfile() {
  return (await getCurrentIdentity()).profile;
}

export async function requireProfile() {
  if (!supabaseConfigured()) redirect("/login?error=configuracion");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?error=sesion");
  return profile;
}

export async function requireRole(role: Role) {
  const profile = await requireProfile();
  if (profile.rol !== role) redirect(ROLE_PATHS[profile.rol]);
  return profile;
}
