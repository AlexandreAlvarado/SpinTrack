"use client";
import { useActionState, useCallback, useEffect, useState } from "react";
import { loadKnockoutPage, operateKnockout } from "@/app/panel/juez-general/clasificacion/operacion-actions";
import { knockoutResult, type KnockoutPage, type OperativeMatch } from "@/lib/eliminatorias-operacion";
import { ResultCard } from "@/components/match-results";
import type { ResultState } from "@/app/panel/juez-general/resultados/actions";
import { roundName } from "@/lib/eliminatorias";

function OperationForm({ operation, match, keyId, referees = [], onDone, startLabel = "Iniciar cuadro respaldado" }: { operation: string; match?: OperativeMatch; keyId?: number; referees?: KnockoutPage["referees"]; onDone: () => void; startLabel?: string }) {
  const [state, action, pending] = useActionState<ResultState, FormData>(operateKnockout, {});
  useEffect(() => { if (state.success) onDone(); }, [state, onDone]);
  return <form action={action} className="my-3 space-y-2">
    <input type="hidden" name="operacion" value={operation} /><input type="hidden" name="partido_id" value={match?.id ?? ""} /><input type="hidden" name="llave_id" value={keyId ?? ""} /><input type="hidden" name="revision" value={match?.revision ?? 0} />
    {(operation === "asignar" || operation === "preparar_asignar") && <label className="block text-sm">Árbitro<select name="arbitro_id" className="input w-full" defaultValue={match?.arbitro_id ?? ""} required><option value="">Seleccionar árbitro</option>{referees.map(r => <option key={r.id} value={r.id}>{r.nombre_completo}</option>)}</select></label>}
    {operation !== "iniciar" && operation !== "asignar" && operation !== "preparar_asignar" && operation !== "comenzar" && <label className="block text-sm">Referencia<input name="referencia" className="input w-full" required maxLength={1000} /></label>}
    <button className="btn-secondary" disabled={pending}>{operation === "iniciar" ? startLabel : operation === "preparar_asignar" ? "Asignar árbitro" : operation === "asignar" ? "Asignar árbitro" : "Comenzar partido"}</button>
    {state.error && <p role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}
  </form>;
}

export function KnockoutOperations({ keyId = null, positions = 2, mode = "judge" }: { keyId?: number | null; positions?: number; mode?: "judge" | "referee" }) {
  const [round, setRound] = useState(1), [page, setPage] = useState(0), [version, setVersion] = useState(0);
  const [data, setData] = useState<KnockoutPage | null>(null), [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    loadKnockoutPage(keyId, round, page).then(value => { if (active) { setData(value); setLoading(false); } }).catch(() => { if (active) { setData(null); setLoading(false); } });
    return () => { active = false; };
  }, [keyId, round, page, version]);
  const refresh = useCallback(() => { setLoading(true); setVersion(v => v + 1); }, []);
  const name = (id: number) => `${data?.players.find(p => p.id === id)?.nombre_completo ?? "Jugador"} · #${id}`;
  async function resultAction(previous: ResultState, form: FormData) {
    const response = await operateKnockout(previous, form);
    if (response.success) refresh();
    return response;
  }
  return <section className="my-6 space-y-4"><h3 className="text-xl font-bold">{positions === 2 ? "Final" : "Eliminatorias"}</h3>
    <div className="flex flex-wrap items-center gap-3">{mode === "judge" && positions > 2 && <label>Ronda<select className="input ml-2" value={round} onChange={e => { setLoading(true); setRound(Number(e.target.value)); setPage(0); }}>{Array.from({ length: Math.log2(positions) }, (_, i) => <option key={i} value={i + 1}>{roundName(positions / 2 ** i)}</option>)}</select></label>}<button className="btn-secondary" onClick={refresh}>Actualizar</button></div>
    {loading ? <p role="status">Consultando encuentros…</p> : !data || data.error ? <p role="alert">{data?.error ?? "No se pudo consultar. Vuelve a intentar."}</p> : <>
      {data.champion && <p className="panel-card font-bold">Campeón: {name(data.champion)} · Finalista: {name(data.finalist!)} · Cuadro finalizado</p>}
      {mode === "judge" && !data.state && <div className="panel-card">{data.authorized ? positions === 2 ? data.referees.length ? <OperationForm operation="preparar_asignar" keyId={keyId!} referees={data.referees} onDone={refresh} /> : <p>No hay árbitros disponibles para asignar.</p> : <OperationForm operation="iniciar" keyId={keyId!} startLabel="Iniciar cuadro" onDone={refresh} /> : <div><p>La final no está habilitada para operación.</p><p className="mt-2 text-sm text-slate-600">{data.authorizationIssue ?? "Falta una autorización documental auténtica."}</p></div>}</div>}
      {!data.matches.length && data.state && <p>No hay encuentros operativos en esta página.</p>}
      <div className="grid items-start gap-4 xl:grid-cols-2">{data.matches.map(match => {
        const ready = match.jugador_a_id !== null && match.jugador_b_id !== null;
        const eligibleReferees = data.referees.filter(referee => !data.players.some(player => [match.jugador_a_id, match.jugador_b_id].includes(player.id) && player.perfil_id === referee.id));
        const events = data.history.filter(e => e.partido_id === match.id && e.evento === "confirmado").map(e => ({ ...e, resultado_id: e.acta_id! }));
        const observations = data.history.filter(e => e.partido_id === match.id && e.evento === "observado").map(e => ({ id: e.id, resultado_id: e.acta_id!, juez_id: e.actor_id, observacion: e.referencia, creado_en: e.ocurrido_en }));
        return <div key={`${match.id}:${match.revision}:${match.estado}`} className="min-w-0 space-y-2">
          <p className="font-semibold">Llave #{match.llave_id} · Ronda {match.ronda_numero} · Encuentro {match.numero} · {match.estado === "revision" ? "En revisión" : match.estado}</p>
          {ready ? <ResultCard match={{ id: match.id, grupo_id: match.ronda_id, jugador_a_id: match.jugador_a_id!, jugador_b_id: match.jugador_b_id! }} bestOf={match.mejor_de} results={data.acts.filter(a => a.partido_id === match.id).map(a => knockoutResult(a, match))} events={events} observations={observations} name={name} mode={mode} rulesReference={match.referencia_reglas} actReference="Acta eliminatoria" refereeName={data.referees.find(r => r.id === match.arbitro_id)?.nombre_completo ?? match.arbitro_id ?? undefined} resultAction={resultAction} knockout /> : <p className="panel-card">{match.jugador_a_id ? name(match.jugador_a_id) : `Pendiente del encuentro #${match.fuente_a_id}`} vs. {match.jugador_b_id ? name(match.jugador_b_id) : `Pendiente del encuentro #${match.fuente_b_id}`}. Aún no habilitado.</p>}
          {match.perdedor_id && <p className="rounded-lg bg-emerald-50 p-2 text-sm">Ganador: {name(match.ganador_id!)} · avanza automáticamente a la siguiente ronda. Eliminado: {name(match.perdedor_id)}.</p>}
          {ready && (mode === "judge" ? ["pendiente", "en_desarrollo", "observado"].includes(match.estado) : match.estado === "pendiente") && (mode === "judge" ? eligibleReferees.length ? <OperationForm operation="asignar" match={match} referees={eligibleReferees} onDone={refresh} /> : <p className="text-sm text-slate-600">No hay árbitros disponibles para asignar.</p> : <OperationForm operation="comenzar" match={match} onDone={refresh} />)}
          <details className="panel-card text-sm"><summary>Historial del encuentro</summary>{data.history.filter(e => e.partido_id === match.id).map(e => <p key={e.id}>{e.evento} · {e.ocurrido_en} · {e.actor_id} · {e.referencia}</p>)}</details>
        </div>;
      })}</div>
      <nav aria-label="Páginas de encuentros eliminatorios" className="flex items-center gap-3"><button className="btn-secondary" disabled={page === 0} onClick={() => { setLoading(true); setPage(p => p - 1); }}>Anterior</button><span>Página {page + 1}</span><button className="btn-secondary" disabled={!data.more} onClick={() => { setLoading(true); setPage(p => p + 1); }}>Siguiente</button></nav>
    </>}
  </section>;
}

