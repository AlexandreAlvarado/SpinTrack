"use client";

import { useActionState, useMemo, useState } from "react";
import { confirmParticipants, type ParticipantState } from "@/app/panel/juez-general/participantes/actions";

type Player = {
  id: number;
  nombre_completo: string;
  fecha_nacimiento: string | null;
  activo: boolean;
  habilitado: boolean;
  motivo: string;
  confirmado: boolean;
};

export function ParticipantRosterForm({ competitionId, players, selected }: { competitionId: number; players: Player[]; selected: number[] }) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>(selected);
  const [allowCorrections, setAllowCorrections] = useState(false);
  const [state, action, pending] = useActionState<ParticipantState, FormData>(confirmParticipants, {});
  const normalizedQuery = query.toLocaleLowerCase("es");
  const visible = useMemo(() => players.filter(player => `${player.nombre_completo} ${player.id}`.toLocaleLowerCase("es").includes(normalizedQuery)), [normalizedQuery, players]);
  const available = visible.filter(player => player.habilitado || selectedIds.includes(player.id));
  const unavailable = visible.filter(player => !player.habilitado && !selectedIds.includes(player.id));
  const toggle = (id: number, checked: boolean) => setSelectedIds(current => checked ? [...new Set([...current, id])] : current.filter(item => item !== id));

  return <form action={action} onSubmit={event => { if (!window.confirm("¿Confirmar esta nómina? PostgreSQL volverá a validar todas las condiciones deportivas.")) event.preventDefault(); }} className="panel-card space-y-4">
    <input type="hidden" name="competencia_id" value={competitionId} />
    {selectedIds.map(id => <input key={id} type="hidden" name="jugador_id" value={id} />)}
    <label className="form-label">Buscar jugador<input className="input" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre o ID" /></label>
    <p className="text-sm text-slate-600">Habilitados: {players.filter(player => player.habilitado).length} · Seleccionados: {selectedIds.length} · Confirmados: {players.filter(player => player.confirmado).length}</p>
    {selected.length > 0 && <label className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" checked={allowCorrections} onChange={event => setAllowCorrections(event.target.checked)} /><span>Habilitar correcciones de la nómina existente. Esto permite retirar participantes y exige una nueva confirmación.</span></label>}
    <section aria-label="Jugadores habilitados" className="space-y-2">
      <h3 className="font-semibold">Disponibles para seleccionar ({available.length})</h3>
      <div className="max-h-[26rem] overflow-y-auto rounded border">{available.map(player => <label key={player.id} className="flex gap-3 border-b p-3"><input type="checkbox" value={player.id} disabled={player.confirmado && !allowCorrections} checked={selectedIds.includes(player.id)} onChange={event => toggle(player.id, event.target.checked)} /><span>{player.nombre_completo} <small>#{player.id}{player.confirmado ? " · Confirmado" : " · Habilitado"}</small></span></label>)}{!available.length && <p className="p-3 text-sm">No hay jugadores habilitados que coincidan.</p>}</div>
    </section>
    <section aria-label="Jugadores pendientes o no elegibles" className="space-y-2">
      <h3 className="font-semibold">Pendientes o no elegibles ({unavailable.length})</h3>
      <div className="max-h-[18rem] overflow-y-auto rounded border">{unavailable.map(player => <div key={player.id} className="border-b p-3 text-sm"><strong>{player.nombre_completo}</strong> <span>#{player.id}</span><p className="text-slate-600">{player.motivo}</p></div>)}{!unavailable.length && <p className="p-3 text-sm">No hay jugadores pendientes que coincidan.</p>}</div>
    </section>
    <label className="form-label">Motivo de corrección o retiro (si corresponde)<textarea className="input min-h-20" name="motivo_retiro" placeholder="Obligatorio si retiras participantes" /></label>
    <button className="btn-primary" disabled={pending}>{pending ? "Confirmando…" : "Confirmar nómina"}</button>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-green-700">{state.success}</p>}
  </form>;
}
