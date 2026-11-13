"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/config";
import { authOrigin, authError, passwordValue, validPassword } from "@/lib/auth-flow";
import { hasRecovery, clearRecovery, beginRecovery } from "@/lib/recovery";
export async function requestRecovery(data: FormData) {
  if (!supabaseConfigured() || !process.env.AUTH_RECOVERY_SECRET || process.env.AUTH_RECOVERY_SECRET.length < 32) redirect("/recuperar-contrasena?error=configuracion");
  const email = String(data.get("email") || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) redirect("/recuperar-contrasena?error=datos");

  try {
    const client = await createClient();
    const state = await beginRecovery();
    const callback = new URL("/auth/recovery", authOrigin());
    callback.searchParams.set("state", state);
    await client.auth.resetPasswordForEmail(email, { redirectTo: callback.toString() });

  } catch { /* Respuesta uniforme también ante fallos de conexión. */ }
  // No revelar diferencias de cuentas ni del proveedor en la respuesta pública.

  redirect("/recuperar-contrasena?info=enviado");
}
export async function resetPassword(data: FormData) {
  if (!supabaseConfigured()) redirect("/restablecer-contrasena?error=configuracion");
  const client = await createClient();
  const { data: user, error } = await client.auth.getUser();
  const { data: claims, error: claimsError } = await client.auth.getClaims();
  const sid = claims?.claims?.session_id;
  if (error || claimsError || !user.user || claims?.claims?.sub !== user.user.id || typeof sid !== "string" || !await hasRecovery(user.user.id, sid)) redirect("/restablecer-contrasena?error=enlace");
  const password = passwordValue(data);
  if (!validPassword(password) || password !== passwordValue(data, "confirmation")) redirect("/restablecer-contrasena?error=datos");
  let result;
  try { result = await client.auth.updateUser({ password }); } catch { redirect("/restablecer-contrasena?error=actualizacion"); }
  if (result.error) redirect(`/restablecer-contrasena?error=${authError(result.error) === "politica" ? "politica" : "actualizacion"}`);
  await clearRecovery();
  await client.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?info=restablecida");
}

