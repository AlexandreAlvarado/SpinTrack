"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
export function PasswordField({ name = "password", label = "Contraseña", login = false }: { name?: string; label?: string; login?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <div><label htmlFor={name} className="form-label">{label}</label><div className="relative"><input id={name} className="input pr-24" name={name} type={visible ? "text" : "password"} minLength={login ? 1 : 8} maxLength={1024} required autoComplete={login ? "current-password" : "new-password"}/><button type="button" aria-controls={name} aria-pressed={visible} aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`} onClick={() => setVisible(!visible)} className="absolute right-1 top-1 min-h-11 rounded-lg px-3 text-sm font-semibold text-brand">{visible ? "Ocultar" : "Mostrar"}</button></div></div>;
}
export function AuthSubmit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-busy={pending} className="btn-primary w-full"><span role="status">{pending ? "Procesando…" : children}</span></button>;
}
