import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentProfile } from "@/lib/auth";
import { ROLE_PATHS } from "@/lib/roles";
import { AUTH_MESSAGES } from "@/lib/auth-flow";
export const metadata: Metadata = { title: "Registro" };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const profile = await getCurrentProfile();
  if (profile) redirect(ROLE_PATHS[profile.rol]);
  const params = await searchParams;
  return <AuthForm mode="register" message={params.error ? AUTH_MESSAGES[params.error] || "No se pudo registrar. Revisa los datos e inténtalo más tarde." : undefined} error={!!params.error}/>;
}
