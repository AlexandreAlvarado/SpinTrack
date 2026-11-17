"use client";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GroupStanding } from "@/lib/clasificacion";
import { confirmElimination, saveEliminationDraft, type EliminationActionState } from "@/app/panel/juez-general/clasificacion/eliminatorias-actions";
import { competitionInput, persistableProposal, proposeBracket, roundName, type Proposal, type Source } from "@/lib/eliminatorias";

export function BracketView({ proposal }: { proposal: Proposal }) {
  const [roundChoice, setRoundChoice] = useState("0");
  const [page, setPage] = useState(0);
  const round = proposal.rondas[Number(roundChoice)] ?? [];
  const label = (source: Source) => source.tipo === "jugador" ? `${source.jugador.nombre} · ${source.jugador.grupo}` : `Ganador de ${source.cruce}`;
  if (!proposal.rondas.length) return <p className="panel-card text-sm">No hay rondas disputables: los dos clasificados pertenecen al único grupo y la final requiere activar una nueva llave.</p>;
  const visible = round.slice(page * 32, (page + 1) * 32);
  return <div className="min-w-0 space-y-3"><label className="block text-sm">Ronda<select className="input mt-1 block max-w-full" value={roundChoice} onChange={event => { setRoundChoice(event.target.value); setPage(0); }}>{proposal.rondas.map((_, index) => <option key={index} value={String(index)}>{roundName(proposal.posiciones / 2 ** index)}</option>)}</select></label><section className="grid min-w-0 gap-3 lg:grid-cols-2" aria-label="Cuadro por rondas">{visible.map(node => <article key={node.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><p className="font-semibold">{node.id}</p>{node.entradas.map((source, index) => <p className="border-l-2 border-sky-200 py-1 pl-2" key={index}>{label(source)}</p>)}<p className="mt-2 text-xs text-slate-600">{node.tipo === "pase" ? "Pase automático" : "Pendiente de disputar"}</p></article>)}</section>{round.length > 32 && <nav aria-label="Páginas de ronda" className="flex gap-3"><button type="button" className="btn-secondary" disabled={page===0} onClick={() => setPage(page-1)}>Anterior</button><span>{page+1}/{Math.ceil(round.length/32)}</span><button type="button" className="btn-secondary" disabled={(page+1)*32>=round.length} onClick={() => setPage(page+1)}>Siguiente</button></nav>}</div>;
}

export type PersistedElimination = { id: number; competencia_id?: number; estado: "borrador" | "confirmada"; posiciones: number; clasificados: number; pases_automaticos: number; creado_en: string; confirmado_en?: string | null; confirmado_por?: string | null; referencia_guardado?: string | null; referencia_confirmacion?: string | null; propuesta?: { version_regla?: number; [key: string]: unknown } | null; clasificaciones_fuente?: unknown };

function SingleGroupFinal({ groups, confirmed }: { groups: GroupStanding[]; confirmed?: PersistedElimination | null }) {
  const group = groups[0];
  const first = group?.filas[0]?.nombre_completo ?? "Primero del grupo";
  const second = group?.filas[1]?.nombre_completo ?? "Segundo del grupo";
  const thirds = group?.filas.slice(2).map(row => row.nombre_completo).filter(Boolean) ?? [];
  return <><section className="panel-card"><h4 className="font-bold">Final</h4><p className="mt-2 text-lg">{first}</p><p className="text-sm text-slate-600">vs.</p><p className="text-lg">{second}</p><p className="mt-3 text-sm">{confirmed ? "Pendiente de disputar · llave confirmada" : "Pendiente de activar por el Juez General"}</p></section>{thirds.length > 0 && <section className="panel-card"><h4 className="font-bold">Clasificación final pendiente</h4><p className="text-sm">Terceros según el orden de la tabla grupal: {thirds.join(", ")}. No se genera partido por el tercer lugar.</p></section>}</>;
}

export function KnockoutPreview({ groups, competitionId = "competencia-seleccionada", persisted, currentProposal, confirmed, historicalDrafts = [], showSingleGroupFinal = true }: { groups: GroupStanding[]; competitionId?: string | number; persisted?: PersistedElimination | null; currentProposal?: PersistedElimination | null; confirmed?: PersistedElimination | null; historicalDrafts?: PersistedElimination[]; showSingleGroupFinal?: boolean }) {
  const [saveState, saveAction, saving] = useActionState<EliminationActionState, FormData>(saveEliminationDraft, {});
  const [confirmState, confirmAction, confirming] = useActionState<EliminationActionState, FormData>(confirmElimination, {});
  const router = useRouter();
  const confirmedKey = confirmed ?? (persisted?.estado === "confirmada" ? persisted : null);
  // `persisted` puede ser un borrador histórico 016. Solo la propuesta activa
  // que la página identificó explícitamente habilita el estado guardado.
  const proposalKey = currentProposal ?? null;
  const automatic = useMemo(() => { try { const input = competitionInput(String(competitionId), groups); return { input, proposal: proposeBracket(input), error: "" }; } catch (cause) { return { input: null, proposal: null, error: cause instanceof Error ? cause.message : "No se puede generar la propuesta." }; } }, [competitionId, groups]);
  const serialized = automatic.proposal && automatic.input ? JSON.stringify(persistableProposal(automatic.input, automatic.proposal)) : "";
  useEffect(() => { if (saveState.success) router.refresh(); }, [router, saveState.success]);
  useEffect(() => { if (confirmState.success) router.refresh(); }, [router, confirmState.success]);
  return <section className="mt-6 min-w-0 space-y-4" aria-label="Eliminatorias individuales">
    <h3 className="text-xl font-bold">Eliminatorias o final</h3>
    <p className="text-sm text-slate-600">Clasifican primero y segundo de cada grupo. El ganador de la final es campeón y el perdedor, subcampeón.</p>
    {groups.length === 1 && showSingleGroupFinal && <SingleGroupFinal groups={groups} confirmed={confirmedKey} />}
    {groups.length > 1 && automatic.proposal && <section className="panel-card"><h4 className="font-bold">Cuadro actual</h4><p className="text-sm">{automatic.proposal.posiciones} posiciones · {Math.max(0, automatic.proposal.posiciones - groups.length * 2)} pases automáticos.</p><BracketView proposal={automatic.proposal} /></section>}
    {automatic.proposal && !proposalKey && !confirmedKey && <form action={saveAction} className="panel-card space-y-3"><p className="text-sm text-slate-600">La referencia interna se generará automáticamente. Las referencias deportivas se solicitan al confirmar.</p><input type="hidden" name="competencia_id" value={competitionId} /><input type="hidden" name="propuesta" value={serialized} /><button className="btn-primary" disabled={saving}>{saving ? "Guardando…" : groups.length === 1 ? "Guardar final" : "Guardar propuesta"}</button>{saveState.error && <p role="alert">{saveState.error}</p>}</form>}
    {groups.length === 1 && <p className="text-sm">La final usa primero y segundo del grupo como participantes distintos y no reutiliza su partido anterior.</p>}
    {groups.length === 1 && proposalKey && !confirmedKey && <p className="panel-card text-sm">Final guardada como propuesta · requiere confirmación del Juez General y respaldo deportivo.</p>}
    {groups.length === 1 && currentProposal && !confirmed && <form action={confirmAction} className="panel-card space-y-3"><h4 className="font-bold">Activar final</h4><input type="hidden" name="llave_id" value={currentProposal.id} /><p className="text-sm text-slate-600">Solo necesitas las referencias deportivas auténticas. La referencia de confirmación se registrará automáticamente.</p><label className="block text-sm">Referencia reglamentaria<input className="input mt-1 w-full" name="referencia_reglas" required maxLength={1000} /></label><label className="block text-sm">Referencia de la regla de final y reencuentro<input className="input mt-1 w-full" name="referencia_pases_reencuentros" required maxLength={1000} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="reglas_confirmadas" required /> Decisión deportiva configurada y trazable</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="datos_reales_confirmados" required /> Datos reales revisados</label><button className="btn-primary" disabled={confirming}>Confirmar y activar final</button>{confirmState.error && <p role="alert">{confirmState.error}</p>}{confirmState.success && <p role="status">{confirmState.success}</p>}</form>}
    {historicalDrafts.length > 0 && <details className="panel-card"><summary className="cursor-pointer font-semibold">Historial de llaves</summary><ul className="mt-3 space-y-2 text-sm">{historicalDrafts.map(item => <li key={item.id}>Llave #{item.id} · {item.clasificados} clasificados · {item.posiciones} posiciones · borrador histórico conservado.</li>)}</ul></details>}
    {!automatic.proposal && <p className="panel-card text-sm" role="alert">{automatic.error}</p>}
  </section>;
}



