"use client";
import { useActionState } from "react";
import { setRefereeEnabled } from "@/app/panel/administrador/arbitraje/actions";

export function RefereePermission({ id, enabled }: { id: string; enabled: boolean }) {
  const [state, action, pending] = useActionState(setRefereeEnabled, {});
  return <form action={action}>
    <input type="hidden" name="perfil_id" value={id}/><input type="hidden" name="esperado" value={String(enabled)}/>
    <button className="btn-secondary" disabled={pending}>{pending ? "Guardando…" : enabled ? "Deshabilitar arbitraje" : "Habilitar arbitraje"}</button>
    {state.error && <p role="alert" className="mt-2 text-sm">{state.error}</p>}{state.success && <p role="status" className="mt-2 text-sm">{state.success}</p>}
  </form>;
}
