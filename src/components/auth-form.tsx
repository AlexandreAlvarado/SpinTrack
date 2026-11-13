import Link from "next/link";
import Image from "next/image";
import { login, register } from "@/app/actions";
import { requestRecovery, resetPassword } from "@/app/recovery-actions";
import { AuthSubmit, PasswordField } from "@/components/auth-controls";
export function AuthForm({ mode, message, error = false }: { mode: "login" | "register" | "recover" | "reset"; message?: string; error?: boolean }) {
  const title = { login: "Iniciar sesión", register: "Crear cuenta", recover: "Recuperar contraseña", reset: "Restablecer contraseña" }[mode];
  const action = { login, register, recover: requestRecovery, reset: resetPassword }[mode];
  return <div className="mx-auto w-full max-w-md px-4 py-8 sm:py-12"><section aria-labelledby="auth-title" className="panel-card !p-5 sm:!p-8">
    <Image src="/logo-liga-los-rios.png" alt="Liga Regional de Tenis de Mesa Los Ríos" width={80} height={76} className="mx-auto mb-4 h-auto w-20 object-contain" />
    <h1 id="auth-title" className="text-center text-2xl font-extrabold">{title}</h1>
    <p className="mb-6 mt-2 text-center text-sm text-slate-600">{mode === "register" ? "Las cuentas nuevas reciben únicamente el rol de Jugador." : mode === "recover" ? "Te enviaremos instrucciones para recuperar el acceso." : mode === "reset" ? "Elige una contraseña nueva para tu cuenta." : "Accede a tu área privada."}</p>
    {message && <p role={error ? "alert" : "status"} className={`mb-5 ${error ? "message-error" : "message-success"}`}>{message}</p>}
    <form action={action} className="space-y-5">
      {mode === "register" && <label className="form-label">Nombre completo<input className="input" name="nombre" required minLength={3} maxLength={120} autoComplete="name"/></label>}
      {mode !== "reset" && <label className="form-label">Correo electrónico<input className="input" name="email" type="email" maxLength={320} required autoComplete="email"/></label>}
      {mode !== "recover" && <PasswordField login={mode === "login"} label={mode === "reset" ? "Contraseña nueva" : "Contraseña"}/>}
      {(mode === "register" || mode === "reset") && <><PasswordField name="confirmation" label="Confirmar contraseña"/><p className="text-sm text-slate-600">Entre 8 y 1024 caracteres. Usa mayúsculas, minúsculas, números y símbolos según la política del servicio.</p></>}
      {mode === "login" && <Link href="/recuperar-contrasena" className="inline-block py-2 text-sm font-semibold text-brand underline">¿Olvidaste tu contraseña?</Link>}
      <AuthSubmit>{mode === "recover" ? "Enviar instrucciones" : mode === "reset" ? "Guardar contraseña" : mode === "register" ? "Registrarme" : "Iniciar sesión"}</AuthSubmit>
    </form>
    <p className="mt-6 text-center text-sm text-slate-600">{mode === "login" ? <>¿No tienes cuenta? <Link href="/registro" className="font-bold text-brand underline">Regístrate</Link></> : <Link href="/login" className="font-bold text-brand underline">Volver a iniciar sesión</Link>}</p>
  </section></div>;
}
