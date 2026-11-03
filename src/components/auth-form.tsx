import Link from "next/link";
import { login, register } from "@/app/actions";

export function AuthForm({ mode, message }: { mode: "login" | "register"; message?: string }) {
  const isLogin = mode === "login";
  return <div className="mx-auto max-w-md px-4 py-16"><div className="panel-card p-7 sm:p-9">
    <h1 className="text-3xl font-extrabold">{isLogin ? "Iniciar sesión" : "Crear cuenta"}</h1>
    <p className="mt-2 mb-7 text-sm text-slate-600">{isLogin ? "Ingresa para acceder a tu área privada." : "Las cuentas nuevas reciben únicamente el rol de Jugador."}</p>
    {message && <p role="status" className="mb-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
    <form action={isLogin ? login : register} className="space-y-5">
      {!isLogin && <label className="form-label">Nombre completo<input className="input" name="nombre" required minLength={3} maxLength={120} autoComplete="name"/></label>}
      <label className="form-label">Correo electrónico<input className="input" name="email" type="email" required autoComplete="email"/></label>
      <label className="form-label">Contraseña<input className="input" name="password" type="password" minLength={isLogin?1:8} required autoComplete={isLogin?"current-password":"new-password"}/></label>
      <button type="submit" className="btn-primary w-full">{isLogin?"Entrar a mi panel":"Registrarme"}</button>
    </form>
    <p className="mt-6 text-center text-sm text-slate-600">{isLogin?"¿No tienes cuenta?":"¿Ya tienes cuenta?"} <Link href={isLogin?"/registro":"/login"} className="font-bold text-brand hover:underline">{isLogin?"Regístrate":"Inicia sesión"}</Link></p>
  </div></div>;
}
