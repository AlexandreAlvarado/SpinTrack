import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; info?: string }> }) {
  const params = await searchParams;
  const message = params.error === "configuracion" ? "El acceso no está disponible: falta configurar Supabase." :
    params.info === "confirmacion" ? "Revisa tu correo para confirmar la cuenta. Luego inicia sesión." :
    params.error === "sesion" ? "Necesitas iniciar sesión o tener un perfil activo para continuar." :
    params.error ? "No fue posible ingresar. Revisa tus credenciales o confirma tu correo." : undefined;
  return <AuthForm mode="login" message={message}/>;
}
