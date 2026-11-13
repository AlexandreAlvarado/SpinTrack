import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentProfile } from "@/lib/auth";
import { ROLE_PATHS } from "@/lib/roles";
import { AUTH_MESSAGES } from "@/lib/auth-flow";
export const metadata: Metadata = { title: "Ingresar" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; info?: string }> }) {
  const params = await searchParams;
  const profile = await getCurrentProfile();
  if (profile && params.error !== "cierre") redirect(ROLE_PATHS[profile.rol]);
  const message = params.error ? AUTH_MESSAGES[params.error] || AUTH_MESSAGES.credenciales : params.info === "confirmacion" ? "Revisa tu correo para confirmar la cuenta. Luego inicia sesión." : params.info === "restablecida" ? "Contraseña actualizada. Ya puedes iniciar sesión." : undefined;
  return <AuthForm mode="login" message={message} error={!!params.error}/>;
}
