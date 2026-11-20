import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LEGAL_VERSION, LEGAL_REVIEW_PENDING } from "@/lib/legal";
import { acceptTerms } from "./actions";
import { logout } from "@/app/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revisar términos" };
export default async function AcceptTermsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?error=sesion");
  const db = await createClient();
  const status = await db.rpc("estado_legal_028");
  if (!status.error && status.data?.version === LEGAL_VERSION && status.data?.aceptada === true) redirect("/panel");
  const unavailable = LEGAL_REVIEW_PENDING || !!status.error || status.data?.version !== LEGAL_VERSION;
  const params = await searchParams;
  return <section className="panel-card mx-auto my-8 max-w-xl space-y-5">
    <h1 className="text-2xl font-bold">Revisar términos y privacidad</h1>
    {LEGAL_REVIEW_PENDING && <p role="status">Los documentos están en revisión institucional. No se solicita aceptar este borrador. La Liga informará la activación de la versión aprobada.</p>}
    <p>Para acceder a tu panel necesitamos tu aceptación de la versión {LEGAL_VERSION}. Se solicitará nuevamente solo cuando cambie la versión obligatoria.</p>
    <p><Link className="underline" href="/terminos" target="_blank">Términos y condiciones</Link> · <Link className="underline" href="/privacidad" target="_blank">Política de privacidad</Link></p>
    {(params.error || unavailable) && <p role="alert">{unavailable ? "La aceptación no está disponible. Contacta a la administración para comprobar la configuración legal. Puedes reintentar sin perder tu cuenta." : "No se registró la aceptación. Marca la casilla e inténtalo nuevamente."}</p>}
    <form action={acceptTerms} className="space-y-4"><input type="hidden" name="terminos_version" value={LEGAL_VERSION}/><label className="flex items-start gap-2"><input name="acepta_terminos" type="checkbox" required/><span>Acepto los términos y he leído la política de privacidad. Esto no otorga consentimientos adicionales.</span></label><button className="btn-primary" disabled={unavailable}>Aceptar y continuar</button></form>
    <div className="flex flex-wrap gap-3"><Link className="btn-secondary" href="/">Seguir consultando información pública</Link><Link className="btn-secondary" href="/aceptar-terminos">Reintentar</Link><form action={logout}><button className="btn-secondary">Cerrar sesión</button></form></div>
  </section>;
}
