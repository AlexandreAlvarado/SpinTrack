import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Registro" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const message = params.error === "configuracion" ? "El registro no está disponible: falta configurar Supabase." :
    params.error ? "No se pudo registrar. Verifica los datos o intenta con otro correo." : undefined;
  return <AuthForm mode="register" message={message} />;
}
