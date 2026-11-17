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
    .select("id, nombre_completo, rol, arbitraje_habilitado")
    .eq("id", claims.sub)
    .single();
  if (profileError || !profile || !isRole(profile.rol)) return { authenticated: true, profile: null };
  const nombre = typeof profile.nombre_completo === "string" ? profile.nombre_completo.trim() : "";
  const emailName = typeof claims.email === "string" ? claims.email.split("@", 1)[0].trim() : "";
  return { authenticated: true, profile: {
    id: profile.id as string,
    nombre: nombre || emailName || "Usuario",
    rol: profile.rol as Role,
    arbitrajeHabilitado: profile.arbitraje_habilitado === true,
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
  if (role === "arbitro" ? !profile.arbitrajeHabilitado : profile.rol !== role) redirect(profile.rol === "arbitro" && !profile.arbitrajeHabilitado ? "/panel/jugador" : ROLE_PATHS[profile.rol]);
  return profile;
}
