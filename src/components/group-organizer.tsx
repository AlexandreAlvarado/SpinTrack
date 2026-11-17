"use client";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveGroups, confirmGroups, type GroupState } from "@/app/panel/juez-general/grupos/actions";
type Player = { id: number; nombre_completo: string; club?: string | null; localidad?: string | null };
type Group = { numero: number; jugador_ids: number[] };
type History = { id: number; evento: string; actor_id: string; ocurrido_en: string; referencia_trazabilidad: string };
function distribution(total: number): number[] | null { for (let fours = Math.floor(total / 4); fours >= 0; fours--) { const remainder = total - fours * 4; if (remainder % 3 === 0) return [...Array(remainder / 3).fill(3), ...Array(fours).fill(4)]; } return null; }
export function GroupOrganizer({ competitionId, players, initialGroups, locked, persistedStatus, history }: { competitionId: number; players: Player[]; initialGroups: Group[]; locked: boolean; persistedStatus: "sin_propuesta" | "borrador" | "confirmado"; history: History[] }) {
  const sizes = distribution(players.length) ?? [];
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [adjustments, setAdjustments] = useState<Array<{ jugador_id: number; desde_grupo: number; hacia_grupo: number }>>([]);
  const [saveState, saveAction, saving] = useActionState<GroupState, FormData>(saveGroups, {});
  const [confirmState, confirmAction, confirming] = useActionState<GroupState, FormData>(confirmGroups, {});
  const router = useRouter();
  useEffect(() => { if (saveState.success || confirmState.success) router.refresh(); }, [saveState.success, confirmState.success, router]);
  const byId = useMemo(() => new Map(players.map(player => [player.id, player])), [players]);
  const move = (id: number, target: number, source: number) => { setAdjustments(current => [...current, { jugador_id: id, desde_grupo: source, hacia_grupo: target }]); setGroups(current => current.map(group => ({ ...group, jugador_ids: group.numero === target ? [...group.jugador_ids.filter(value => value !== id), id] : group.jugador_ids.filter(value => value !== id) }))); };
  const generate = () => { let offset = 0; setAdjustments([]); setGroups(sizes.map((size, index) => { const jugador_ids = players.slice(offset, offset + size).map(player => player.id); offset += size; return { numero: index + 1, jugador_ids }; })); };
  const allIds = groups.flatMap(group => group.jugador_ids); const missing = players.filter(player => !allIds.includes(player.id));
  const complete = players.length >= 4 && !!sizes.length && allIds.length === players.length && new Set(allIds).size === players.length && !missing.length && groups.every(group => [3, 4].includes(group.jugador_ids.length));
  const statusLabel = persistedStatus === "confirmado" ? "Grupos confirmados" : persistedStatus === "borrador" ? "Borrador guardado" : groups.length ? "Propuesta generada localmente · sin guardar" : "Sin propuesta";
  return <section className="space-y-4">
    {players.length < 4 && <p className="panel-card text-amber-900">Se necesitan al menos cuatro participantes confirmados.</p>}
    {players.length >= 4 && !sizes.length && <p className="panel-card text-amber-900">La cantidad actual no permite distribuir grupos ordinarios de 3 o 4 sin una regla adicional documentada.</p>}
    <p role="status" className={locked ? "panel-card text-green-900" : "panel-card text-slate-700"}>{statusLabel}</p>
    {!locked && <button type="button" className="btn-secondary" onClick={generate} disabled={!sizes.length}>{groups.length ? "Regenerar propuesta" : "Generar propuesta"}</button>}
    {!groups.length && players.length >= 4 && <p className="panel-card">Genera una propuesta para distribuir la nómina en grupos ordinarios.</p>}
    <form action={saveAction} className="space-y-4"><input type="hidden" name="competencia_id" value={competitionId}/><input type="hidden" name="grupos" value={JSON.stringify(groups)}/><input type="hidden" name="ajustes_manuales" value={JSON.stringify(adjustments)}/>
      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">{groups.map(group => <article className="panel-card" key={group.numero}><h3 className="font-bold">Grupo N.º {group.numero}</h3><p className="text-xs text-slate-600">{group.jugador_ids.length} jugadores · permitido: 3 o 4</p><ol className="my-3 list-decimal space-y-2 pl-5">{group.jugador_ids.map((id, index) => { const player = byId.get(id); return <li key={`${id}-${index}`}><span>{player?.nombre_completo ?? "Jugador pendiente"}</span>{(player?.club || player?.localidad) && <span className="block text-xs text-slate-500">{[player.club, player.localidad].filter(Boolean).join(" · ")}</span>}{!locked && groups.length > 1 && <><label className="sr-only" htmlFor={`move-${id}`}>Mover jugador</label><select id={`move-${id}`} className="input mt-1 w-full py-1 text-xs" value={group.numero} onChange={event => move(id, Number(event.target.value), group.numero)}><option value={group.numero}>Grupo N.º {group.numero}</option>{groups.filter(other => other.numero !== group.numero).map(other => <option key={other.numero} value={other.numero}>Mover al grupo N.º {other.numero}</option>)}</select></>}</li>; })}</ol></article>)}</div>
      {missing.length > 0 && <p role="alert" className="panel-card text-amber-900">Participantes faltantes: {missing.map(player => player.nombre_completo).join(", ")}.</p>}
      {!locked && groups.length > 0 && <><label className="form-label">Referencia de trazabilidad<input className="input" name="referencia_trazabilidad" required maxLength={1000} placeholder="Ej.: distribución revisada por Juez General"/></label><button className="btn-primary" disabled={!complete || saving}>{saving ? "Guardando…" : "Guardar borrador"}</button></>}
      {saveState.error && <p role="alert">{saveState.error}</p>}{saveState.success && persistedStatus !== "confirmado" && <p role="status">{saveState.success}</p>}
    </form>
    {!locked && <form action={confirmAction} onSubmit={event => { if (!window.confirm("¿Confirmar definitivamente estos grupos?")) event.preventDefault(); }} className="panel-card space-y-3"><input type="hidden" name="competencia_id" value={competitionId}/><label className="form-label">Referencia de confirmación<input className="input" name="referencia_trazabilidad" required maxLength={1000}/></label><p className="text-sm">La confirmación exige que el borrador ya esté guardado y que PostgreSQL vuelva a validar toda la nómina.</p><button className="btn-primary" disabled={confirming || !groups.length}>Confirmar grupos</button>{confirmState.error && <p role="alert">{confirmState.error}</p>}{confirmState.success && <p role="status">{confirmState.success}</p>}</form>}
    {history.length > 0 && <details className="panel-card"><summary className="cursor-pointer font-bold">Historial y referencias</summary><ol className="mt-3 space-y-2 text-sm">{history.map(event => <li key={event.id} className="border-l-2 border-slate-200 pl-3"><strong>{event.evento === "confirmado" ? "Confirmación" : "Borrador guardado"}</strong><span className="block text-slate-600">{new Date(event.ocurrido_en).toLocaleString("es-CL")} · Responsable registrado</span><span className="block">Referencia: {event.referencia_trazabilidad}</span></li>)}</ol></details>}
  </section>;
}
