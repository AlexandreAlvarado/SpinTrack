"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { assignReferee, type ResultState } from "@/app/panel/juez-general/resultados/actions";
export type RefereeOption = { id: string; nombre_completo: string };
export type MatchAssignment = { partido_id: number; arbitro_id: string | null; activo?: boolean; arbitro_nombre?: string | null };
export function RefereeAssignment({ match, referees, current }: { match: { id: number; jugador_a_id: number; jugador_b_id: number }; referees: RefereeOption[]; current?: MatchAssignment }) {
  const [state, action, pending] = useActionState<ResultState, FormData>(assignReferee, {});
  const router = useRouter();
  useEffect(() => { if (state.success) router.refresh(); }, [state, router]);
  return <form action={action} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-sm font-semibold">Árbitro: {current?.arbitro_nombre ?? "Sin asignar"}</p><div className="mt-2 flex flex-col gap-2 lg:flex-row"><input type="hidden" name="partido_id" value={match.id} /><select aria-label={`Árbitro del partido ${match.id}`} name="arbitro_id" className="input mt-0 min-h-10 min-w-0 flex-1 py-2" key={current?.arbitro_id ?? "sin-asignar"} defaultValue={current?.arbitro_id ?? ""} required><option value="">Seleccionar árbitro</option>{referees.map(referee => <option key={referee.id} value={referee.id}>{referee.nombre_completo}</option>)}</select><input aria-label="Referencia de asignación" name="referencia" className="input mt-0 min-h-10 py-2" placeholder="Referencia de asignación" maxLength={1000} required defaultValue="Asignación operativa del Juez General" /><button className="btn-secondary min-h-10 py-2" disabled={pending}>{pending ? "Guardando…" : "Asignar"}</button></div>{state.error && <p role="alert" className="mt-2">{state.error}</p>}{state.success && <p role="status" className="mt-2">{state.success}</p>}</form>;
}
