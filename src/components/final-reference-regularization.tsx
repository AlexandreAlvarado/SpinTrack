"use client";

import { useActionState } from "react";
import { regularizeFinalReference } from "@/app/panel/administrador/competencias/actions";
import type { CompetitionState } from "@/lib/competencias";

export function FinalReferenceRegularization({ competitionId }: { competitionId: number }) {
  const [state, action, pending] = useActionState<CompetitionState, FormData>(regularizeFinalReference, {});
  return <form action={action} className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4" aria-label="Completar respaldo pendiente de final">
    <h4 className="font-semibold">Completar respaldo pendiente de final</h4>
    <p className="text-sm text-amber-950">La final ya está preparada al mejor de cinco, pero falta su referencia deportiva. Esta regularización no cambia la aprobación ni crea una llave nueva.</p>
    <input type="hidden" name="competencia_id" value={competitionId} />
    <label className="form-label">Referencia deportiva auténtica<input className="input" name="referencia" required maxLength={1000} /></label>
    <label className="form-label">Motivo de regularización<input className="input" name="motivo" required maxLength={1000} /></label>
    <button className="btn-secondary" disabled={pending}>{pending ? "Registrando…" : "Regularizar respaldo"}</button>
    {state.error && <p role="alert" className="text-amber-900">{state.error}</p>}
    {state.success && <p role="status" className="text-green-800">{state.success}</p>}
  </form>;
}
