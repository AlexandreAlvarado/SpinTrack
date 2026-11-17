"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { approveStanding, type ApprovalState } from "@/app/panel/juez-general/clasificacion/actions";
import type { GroupStanding } from "@/lib/clasificacion";

export function StandingsRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [router]);
  return <button type="button" className="btn-secondary" onClick={() => router.refresh()}>Actualizar clasificación</button>;
}
export function GroupStandings({ group }: { group: GroupStanding }) {
  const [state, action, pending] = useActionState<ApprovalState, FormData>(approveStanding, {});
  const router = useRouter();
  useEffect(() => { if (state.success) router.refresh(); }, [state, router]);
  return <section className="panel-card my-4 min-w-0">
    <h3 className="font-bold">Grupo {group.numero} · {group.aprobacion?.vigente ? "Aprobación deportiva interna" : "Clasificación provisional"}</h3>
    <p className="my-2 text-sm">{group.confirmados}/{group.total} partidos confirmados · {group.pendientes} revisiones pendientes</p>
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`Tabla del grupo ${group.numero}`}><table className="w-full whitespace-nowrap text-left text-sm">
      <caption className="sr-only">Indicadores de resultados confirmados. PF y PC son tantos, sin puntos de ranking.</caption>
      <thead><tr>{["Pos.", "Jugador", "PJ", "PG", "PP", "SF", "SC", "PF", "PC"].map(label => <th scope="col" className="px-2 py-2" key={label}>{label}</th>)}</tr></thead>
      <tbody>{group.filas.map((row, i) => <tr className="border-t border-slate-200" key={row.jugador_id}>
        <td className="px-2 py-2">{group.aprobacion?.vigente ? i + 1 : row.empate ? "Empate pendiente" : "Por validar"}</td>
        <th scope="row" className="px-2 py-2 font-medium">{row.nombre_completo}</th>
        {[row.pj,row.pg,row.pp,row.sf,row.sc,row.pf,row.pc].map((value,index) => <td className="px-2 py-2 tabular-nums" key={index}>{value}</td>)}
      </tr>)}</tbody>
    </table></div>
    <p className="mt-3 text-xs text-slate-600">PJ: jugados · PG/PP: ganados/perdidos · SF/SC: sets · PF/PC: tantos a favor/en contra. Orden provisional por victorias; sin desempate automático ni plazas de avance.</p>
    {group.empate && <p className="mt-3 text-sm" role="status">Empate pendiente de resolución deportiva. Los sets y tantos no se usan para desempatar.</p>}
    {group.aprobacion && <p className="mt-3 break-words text-sm">{group.aprobacion.vigente ? "Aprobación vigente" : "Aprobación anterior desactualizada: revisar nuevamente"} · {group.aprobacion.ocurrido_en} · Juez {group.aprobacion.actor_id} · {group.aprobacion.referencia}</p>}
    {group.aprobable && !group.aprobacion?.vigente ? <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="grupo_id" value={group.grupo_id} /><input type="hidden" name="snapshot" value={JSON.stringify(group.snapshot)} />
      <label className="block text-sm"><input type="checkbox" name="criterio_validado" required /> Verifiqué respaldo documental de la Liga para ordenar este grupo por mayor cantidad de victorias.</label>
      <label className="block text-sm"><input type="checkbox" name="datos_reales" required /> Verifiqué que son datos deportivos reales, sin jugadores ni resultados ficticios de prueba.</label>
      <label className="block text-sm">Referencia de resolución y revisión deportiva<input name="referencia" className="input" maxLength={1000} required /></label>
      <button className="btn-primary" disabled={pending}>{pending ? "Registrando…" : "Aprobar clasificación interna"}</button>
    </form> : !group.aprobacion?.vigente && <p className="mt-3 text-sm">Aprobación bloqueada: requiere grupo y todos los partidos confirmados, sin revisiones pendientes ni empate.</p>}
    {state.error && <p role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}
  </section>;
}

export function GroupStandingsCollection({ groups }: { groups: GroupStanding[] }) {
  const [groupChoice, setSelectedGroup] = useState<number | "all">("all");
  const selectedGroup = groups.length === 1 ? groups[0].grupo_id : groupChoice;
  const selected = selectedGroup === "all" ? undefined : groups.find(group => group.grupo_id === selectedGroup);
  return <div className="space-y-4">
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Resumen de grupos">
      {groups.map(group => <button type="button" key={group.grupo_id} onClick={() => setSelectedGroup(group.grupo_id)} className={`rounded-xl border p-3 text-left ${selectedGroup === group.grupo_id ? "border-brand bg-sky-50" : "border-slate-200 bg-white"}`} aria-pressed={selectedGroup === group.grupo_id}>
        <span className="font-semibold">Grupo {group.numero}</span><span className="mt-1 block text-sm text-slate-600">{group.confirmados}/{group.total} partidos confirmados</span><span className="mt-1 block text-xs text-slate-500">{group.empate ? "Empate pendiente" : group.pendientes ? `${group.pendientes} revisiones pendientes` : group.confirmados === group.total ? "Completo" : "Pendiente"}</span>
      </button>)}
    </div>
    <label className="block max-w-sm text-sm font-semibold">Grupo<select className="input mt-1 w-full" value={selectedGroup} onChange={event => setSelectedGroup(event.target.value === "all" ? "all" : Number(event.target.value))}><option value="all">Todos los grupos · resumen</option>{groups.map(group => <option key={group.grupo_id} value={group.grupo_id}>Grupo {group.numero}</option>)}</select></label>
    {selected ? <GroupStandings group={selected} /> : <p className="panel-card text-sm">Selecciona un grupo para consultar su clasificación detallada. Las estadísticas no se recalculan ni se convierten en oficiales desde este resumen.</p>}
  </div>;
}
