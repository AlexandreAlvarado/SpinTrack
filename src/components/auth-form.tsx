import Link from "next/link";
import Image from "next/image";
import { login, register } from "@/app/actions";
import { requestRecovery, resetPassword } from "@/app/recovery-actions";
import { AuthSubmit, PasswordField } from "@/components/auth-controls";
import { LEGAL_VERSION, LEGAL_REVIEW_PENDING } from "@/lib/legal";
export function AuthForm({ mode, message, error = false }: { mode: "login" | "register" | "recover" | "reset"; message?: string; error?: boolean }) {
  const title = { login: "Iniciar sesión", register: "Crear cuenta", recover: "Recuperar contraseña", reset: "Restablecer contraseña" }[mode];
  const action = { login, register, recover: requestRecovery, reset: resetPassword }[mode];
  return <div className="mx-auto w-full max-w-md px-4 py-8 sm:py-12"><section aria-labelledby="auth-title" className="panel-card !p-5 sm:!p-8">
    <Image src="/logo-liga-los-rios.png" alt="Liga Regional de Tenis de Mesa Los Ríos" width={80} height={76} className="mx-auto mb-4 h-auto w-20 object-contain" />
    <h1 id="auth-title" className="text-center text-2xl font-extrabold">{title}</h1>
    <p className="mb-6 mt-2 text-center text-sm text-slate-600">{mode === "register" ? "Todas las cuentas nuevas comienzan como Jugador. La organización puede habilitar posteriormente funciones arbitrales en esta misma cuenta, sin crear otra." : mode === "recover" ? "Te enviaremos instrucciones para recuperar el acceso." : mode === "reset" ? "Elige una contraseña nueva para tu cuenta." : "Accede a tu área privada."}</p>
    {message && <p role={error ? "alert" : "status"} className={`mb-5 ${error ? "message-error" : "message-success"}`}>{message}</p>}
    {mode === "register" && LEGAL_REVIEW_PENDING && <p role="status" className="mb-5 rounded-lg bg-amber-50 p-3 text-sm">Registro temporalmente suspendido durante la revisión institucional y del procedimiento de menores. No envíes datos personales nuevos. Contacto: <a className="underline" href="mailto:lrtenisdemesalr@gmail.com">lrtenisdemesalr@gmail.com</a>.</p>}
    <form action={action} className="space-y-5">
      {mode === "register" && <label className="form-label">Nombre completo<input className="input" name="nombre" required minLength={3} maxLength={120} autoComplete="name"/></label>}
      {mode !== "reset" && <label className="form-label">Correo electrónico<input className="input" name="email" type="email" maxLength={320} required autoComplete="email"/></label>}
      {mode !== "recover" && <PasswordField login={mode === "login"} label={mode === "reset" ? "Contraseña nueva" : "Contraseña"}/>}
      {(mode === "register" || mode === "reset") && <><PasswordField name="confirmation" label="Confirmar contraseña"/><p className="text-sm text-slate-600">Entre 8 y 1024 caracteres. Usa mayúsculas, minúsculas, números y símbolos según la política del servicio.</p></>}
      {mode === "login" && <Link href="/recuperar-contrasena" className="inline-block py-2 text-sm font-semibold text-brand underline">¿Olvidaste tu contraseña?</Link>}
      {mode === "register" && <><input type="hidden" name="terminos_version" value={LEGAL_VERSION}/><label className="flex items-start gap-2 text-sm"><input type="checkbox" name="acepta_terminos" required/><span>Acepto los <Link className="underline" href="/terminos" target="_blank">términos y condiciones</Link> y he leído la <Link className="underline" href="/privacidad" target="_blank">política de privacidad</Link>. Esta aceptación no sustituye otros consentimientos necesarios.</span></label></>}
      {mode === "register" && LEGAL_REVIEW_PENDING ? <button type="submit" disabled className="btn-primary w-full">Registro pendiente de revisión</button> : <AuthSubmit>{mode === "recover" ? "Enviar instrucciones" : mode === "reset" ? "Guardar contraseña" : mode === "register" ? "Registrarme" : "Iniciar sesión"}</AuthSubmit>}
    </form>
    <p className="mt-6 text-center text-sm text-slate-600">{mode === "login" ? <>¿No tienes cuenta? <Link href="/registro" className="font-bold text-brand underline">Regístrate</Link></> : <Link href="/login" className="font-bold text-brand underline">Volver a iniciar sesión</Link>}</p>
  </section></div>;
}
