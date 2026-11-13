import { AuthForm } from "@/components/auth-form";
import { AUTH_MESSAGES } from "@/lib/auth-flow";
export const metadata = { title: "Recuperar contraseña" };
export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ error?: string; info?: string }> }) {
  const params = await searchParams;
  return <AuthForm mode="recover" error={!!params.error} message={params.error ? AUTH_MESSAGES[params.error] || AUTH_MESSAGES.envio : params.info === "enviado" ? "Si la dirección está registrada y el envío está disponible, recibirás instrucciones. Revisa spam. Si no llegan, espera unos minutos y solicita otro enlace o contacta a la administración." : undefined}/>;
}
