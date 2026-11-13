"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { resolveRegistration } from "@/app/panel/juez-general/inscripciones/actions";
import type { CatalogState } from "@/lib/catalogos";

export function RegistrationRefresh() {
  const router = useRouter();
  return <button type="button" className="btn-secondary" onClick={() => router.refresh()}>Recargar estado e historial</button>;
}

export function RegistrationDecisionForm({ id, competition, canAccept = true }: { id: number; competition: number; canAccept?: boolean }) {
  const [state, action, pending] = useActionState(resolveRegistration.bind(null, id, competition), {} as CatalogState);
  return <form action={action} className="panel-card space-y-3">
    <h3 className="font-bold">Resolver solicitud #{id}</h3>
    {state.error && <p role="alert">{state.error}</p>}{state.success && <p role="status" className="message-success">{state.success}</p>}
    <fieldset disabled={pending || !!state.success} className="grid gap-3">
      <label className="form-label">Decisión<select name="estado" className="input" required defaultValue={!canAccept && state.values?.estado === "aceptada" ? "" : state.values?.estado ?? ""}><option value="">Selecciona</option><option value="aceptada" disabled={!canAccept}>Aceptar</option><option value="rechazada">Rechazar</option></select></label>
      {!canAccept && <p role="status">Aceptar no está disponible hasta actualizar el requisito heredado del esquema. Puedes rechazar una solicitud con el respaldo documental correspondiente.</p>}
      <label className="form-label">Motivo<textarea name="motivo" className="input" required maxLength={2000} defaultValue={state.values?.motivo}/></label>
      <label className="form-label">Referencia documental<input name="referencia" className="input" required maxLength={1000} defaultValue={state.values?.referencia}/></label>
      <label><input type="checkbox" name="confirmacion" value="revisada" required/> Revisé elegibilidad, antecedentes, rama, condición federativa y combinación de categorías de la jornada conforme al respaldo documental.</label>
      <button className="btn-primary">{pending ? "Resolviendo…" : "Confirmar resolución documentada"}</button>
    </fieldset>
  </form>;
}
