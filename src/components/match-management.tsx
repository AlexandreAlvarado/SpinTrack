"use client";

import Link from "next/link";
import { useState } from "react";
import { ResultCard, type ResultObservation } from "./match-results";
import { RefereeAssignment, type MatchAssignment, type RefereeOption } from "./referee-assignment";
import type { GroupMatch } from "./group-matches";
import type { MatchResult, ResultEvent } from "@/lib/resultados";
import { groupMatchProgress, matchStatus, matchSummary } from "@/lib/gestion-partidos";

export function MatchCounts({ summary }: { summary: ReturnType<typeof matchSummary> }) {
  return <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[["Partidos generados", summary.total], ["Con árbitro asignado", summary.assigned], ["Resultados pendientes", summary.pending], ["Enviados para revisión", summary.review], ["Confirmados", summary.confirmed], ["Con observaciones", summary.observed]].map(([label, count]) => <div key={label}><dt className="text-sm text-slate-600">{label}</dt><dd className="text-xl font-bold">{count}</dd></div>)}</dl>;
}

export function MatchManagement({ matches, groups, players, bestOf, results, events, observations, assignments, referees, people, classificationHref }: {
  matches: GroupMatch[]; groups: { id: number; numero: number }[];
  players: { id: number; nombre_completo: string; perfil_id?: string | null }[]; bestOf: number;
  results: MatchResult[]; events: ResultEvent[]; observations: ResultObservation[];
  assignments: MatchAssignment[]; referees: RefereeOption[]; people: Record<string, string>; classificationHref: string;
}) {
  const summary = matchSummary(matches, results, events, observations, assignments);
  const [groupChoice, setSelectedGroup] = useState<number | "all">("all");
  const selectedGroup = groups.length === 1 ? groups[0].id : groupChoice;
  const [search, setSearch] = useState("");
  const name = (id: number) => players.find(p => p.id === id)?.nombre_completo ?? `Jugador #${id}`;
  const labels = { pendiente: "Resultado pendiente", revision: "Enviado para revisión", observado: "Con observaciones", confirmado: "Resultado confirmado" };
  const priority = { revision: 0, observado: 1, pendiente: 2, confirmado: 3 };
  const status = (m: GroupMatch) => matchStatus(m.id, results, events, observations);
  const ordered = [...matches].sort((a, b) => priority[status(a)] - priority[status(b)] || a.id - b.id);
  const visibleGroups = selectedGroup === "all" ? [] : groups.filter(group => group.id === selectedGroup);
  const normalizedSearch = search.trim().toLocaleLowerCase("es");
  const visibleMatches = normalizedSearch ? ordered.filter(match => {
    const playerA = name(match.jugador_a_id).toLocaleLowerCase("es");
    const playerB = name(match.jugador_b_id).toLocaleLowerCase("es");
    return playerA.includes(normalizedSearch) || playerB.includes(normalizedSearch);
  }) : ordered;
  const assignmentTarget = ordered.find(m => !assignments.some(a => a.partido_id === m.id && a.activo !== false));
  const reviewTarget = ordered.find(m => ["revision", "observado"].includes(status(m))) ?? ordered[0];
  return <div className="min-w-0 space-y-5">
    <section className="panel-card space-y-4"><p className="text-sm">Lote de cruces confirmado · {summary.complete ? "Resultados completos" : "Resultados aún pendientes de completar"}</p>
      <MatchCounts summary={summary} />
      <Link className="btn-primary" href={summary.complete ? classificationHref : `#partido-${summary.action === "Asignar árbitros" ? assignmentTarget?.id : reviewTarget?.id}`}>{summary.action}</Link>
    </section>
    <div className="space-y-5"><h3 className="text-lg font-bold">Partidos y resultados</h3><p className="text-sm text-slate-600">Selecciona un grupo para abrir su detalle. Los resúmenes no cargan formularios ni modifican estados.</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{groups.map(group => { const progress = groupMatchProgress(group.id, matches, results, events, observations); return <button type="button" key={group.id} onClick={() => setSelectedGroup(group.id)} className={`rounded-xl border p-3 text-left ${selectedGroup === group.id ? "border-brand bg-sky-50" : "border-slate-200 bg-white"}`} aria-pressed={selectedGroup === group.id}><span className="font-semibold">Grupo {group.numero}</span><span className="mt-1 block text-sm text-slate-600">{progress.confirmed}/{progress.total} partidos confirmados{progress.review ? ` · ${progress.review} por revisar` : ""}</span><span className="mt-1 block text-xs text-slate-500">{progress.complete ? "Completo" : progress.total ? "Pendiente" : "Sin partidos"}</span></button>; })}</div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end"><label className="block min-w-0 flex-1 text-sm font-semibold">Grupo<select className="input mt-1 w-full" value={selectedGroup} onChange={event => setSelectedGroup(event.target.value === "all" ? "all" : Number(event.target.value))}><option value="all">Todos los grupos · resumen</option>{groups.map(group => <option key={group.id} value={group.id}>Grupo {group.numero}</option>)}</select></label><label className="block min-w-0 flex-1 text-sm font-semibold">Buscar jugador<input className="input mt-1 w-full" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre del jugador" /></label></div>
      {selectedGroup === "all" && <p className="panel-card text-sm">Selecciona un grupo para consultar sus partidos, asignaciones y revisiones.</p>}
      {visibleGroups.map(group => <section key={group.id} className="space-y-3"><h4 className="font-bold">Grupo {group.numero}</h4>{visibleMatches.filter(m => m.grupo_id === group.id).map(match => {
        const state = status(match);
        const assignment = assignments.find(a => a.partido_id === match.id && a.activo !== false);
        const hasHistory = results.some(r => r.partido_id === match.id);
        const requiresReassignment = assignment && (!referees.some(referee => referee.id === assignment.arbitro_id) || players.some(player => [match.jugador_a_id, match.jugador_b_id].includes(player.id) && player.perfil_id === assignment.arbitro_id));
        return <article id={`partido-${match.id}`} key={match.id} className="panel-card min-w-0 space-y-3 break-words"><p className="font-semibold">{name(match.jugador_a_id)} vs. {name(match.jugador_b_id)}</p><p className="text-sm">Partido #{match.id} · {labels[state]}</p><p className="text-sm" title={assignment?.arbitro_id ?? undefined}>Árbitro: {assignment?.arbitro_nombre ?? "Sin asignar"}</p>
          {(!hasHistory || requiresReassignment) ? <details open={!assignment}><summary className="cursor-pointer text-sm font-semibold">{assignment ? "Cambiar árbitro" : "Asignar árbitro"}</summary><RefereeAssignment match={match} current={assignment} referees={referees.filter(r => !players.some(p => [match.jugador_a_id, match.jugador_b_id].includes(p.id) && p.perfil_id === r.id))} /></details> : <p className="text-xs text-slate-500">Asignación bloqueada: el partido ya tiene historial de resultados.</p>}
          {hasHistory && <details open={state === "revision"}><summary className="cursor-pointer text-sm font-semibold">Ver sets, revisión e historial</summary><div className="mt-3"><ResultCard match={match} bestOf={bestOf} results={results} events={events} observations={observations} name={name} mode="judge" rulesReference="" actReference="" refereeName={assignment?.arbitro_nombre ?? undefined} people={people} /></div></details>}
        </article>;
      })}{!visibleMatches.some(match => match.grupo_id === group.id) && <p className="panel-card text-sm">No hay partidos que coincidan con este filtro.</p>}</section>)}
    </div>
    <p className="text-sm text-slate-600">Asigna desde cada partido. Las asignaciones se guardan individualmente al pulsar Asignar.</p>
  </div>;
}
