import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/server";
import { hasRecovery } from "@/lib/recovery";
import { AUTH_MESSAGES } from "@/lib/auth-flow";
export const metadata = { title: "Restablecer contraseña", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  let allowed = false;
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    const { data: claims, error: claimsError } = await client.auth.getClaims();
    const sid = claims?.claims?.session_id;
    allowed = !error && !claimsError && !!data.user && claims?.claims?.sub === data.user.id && typeof sid === "string" && await hasRecovery(data.user.id, sid);
  } catch { allowed = false; }
  if (!allowed || params.error === "enlace") return <section className="panel-card mx-auto my-8 w-full max-w-md"><h1 className="text-xl font-bold">Solicita un nuevo enlace</h1><p role="alert" className="my-4">{AUTH_MESSAGES.enlace}</p><Link className="btn-primary" href="/recuperar-contrasena">Solicitar otro enlace</Link><Link className="mt-4 block text-brand underline" href="/login">Volver al login</Link></section>;
  return <AuthForm mode="reset" error={!!params.error} message={params.error ? AUTH_MESSAGES[params.error] || AUTH_MESSAGES.actualizacion : undefined}/>;
}
