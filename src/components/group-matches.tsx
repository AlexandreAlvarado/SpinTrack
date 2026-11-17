"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { manageMatches, type MatchState } from "@/app/panel/juez-general/partidos/actions";
export type MatchLot = { id: number; estado: string; mejor_de: number; referencia_formato: string; motivo_descarte?: string | null };
export type GroupMatch = { id: number; grupo_id: number; jugador_a_id: number; jugador_b_id: number };
export function GroupMatches({ competitionId, groups, players, matches, lot, history, ready }: {
  competitionId: number; groups: { id: number; numero: number; estado: string }[];
  players: { id: number; nombre_completo: string }[]; matches: GroupMatch[]; lot?: MatchLot;
  history: { id: number; evento: string; ocurrido_en: string; referencia: string }[]; ready: boolean;
}) {
  const [state, action, pending] = useActionState<MatchState, FormData>(manageMatches, {});
  const router = useRouter();
  useEffect(() => { if (state.success) router.refresh(); }, [state, router]);
  const name = (id: number) => players.find(player => player.id === id)?.nombre_completo ?? `Jugador #${id}`;
  return <div className="space-y-5">
    <section className="panel-card"><h3 className="font-bold">{lot ? lot.estado === "confirmado" ? "Lote de cruces confirmado · resultados por revisar" : "Borrador para revisión" : "Sin partidos generados"}</h3>
      <p className="text-sm text-slate-600">{lot ? `${matches.length} partidos · Mejor de ${lot.mejor_de} sets · ${lot.mejor_de === 3 ? 2 : 3} sets para ganar.` : "Genera únicamente a partir de grupos confirmados y preparación aprobada."} La confirmación de cruces es independiente de los resultados.</p>
      {lot && <p className="mt-2 text-sm">Respaldo del formato: {lot.referencia_formato}{lot.estado === "descartado" && lot.motivo_descarte ? ` · Motivo: ${lot.motivo_descarte}` : ""}</p>}
    </section>
    {state.error && <p role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}
    {lot && groups.map(group => <section className="panel-card" key={group.id}><h3 className="mb-3 font-bold">Grupo {group.numero}</h3><ul className="divide-y">{matches.filter(match => match.grupo_id === group.id).map(match => <li key={match.id} className="py-3"><p>{name(match.jugador_a_id)} <span className="text-slate-500">vs.</span> {name(match.jugador_b_id)}</p><p className="text-xs text-slate-500">Partido #{match.id} · {lot.estado === "confirmado" ? "Confirmado" : "Borrador"}</p></li>)}</ul></section>)}
    {!lot && !ready && <p className="panel-card">Confirma todos los grupos antes de generar partidos.</p>}
    {((!lot && ready) || lot?.estado === "borrador") && <form action={action} className="panel-card space-y-4">
      <input type="hidden" name="competencia_id" value={competitionId} /><input type="hidden" name="operacion" value={lot ? "confirmar" : "generar"} />
      {lot && <input type="hidden" name="lote_id" value={lot.id} />}
      {!lot && <p className="text-sm">Las Bases §7 describen grupos de 3 o 4, pero no explicitan todos contra todos. Continúa solo con respaldo de la Liga. Tres jugadores producirán 3 partidos; cuatro producirán 6.</p>}
      <label className="flex items-start gap-2"><input type="checkbox" required name={lot ? "revision_confirmada" : "formato_confirmado"} /><span>{lot ? "Revisé todos los enfrentamientos y apruebo este lote." : "La Liga confirmó todos contra todos a una vuelta para esta competencia."}</span></label>
      <label className="block">{lot ? "Referencia de revisión" : "Referencia del respaldo de la Liga"}<input className="input mt-1 w-full" name="referencia" required maxLength={1000} /></label>
      <button className="btn-primary" disabled={pending}>{pending ? "Procesando…" : lot ? "Confirmar partidos" : "Generar borrador de partidos"}</button>
    </form>}
    {lot?.estado === "borrador" && <form action={action} className="panel-card space-y-4 border-amber-200"><input type="hidden" name="competencia_id" value={competitionId} /><input type="hidden" name="operacion" value="descartar" /><input type="hidden" name="lote_id" value={lot.id} /><label className="block">Motivo del descarte<input className="input mt-1 w-full" name="motivo" required maxLength={1000} /></label><label className="block">Referencia<input className="input mt-1 w-full" name="referencia" required maxLength={1000} /></label><button className="btn-secondary" disabled={pending}>Descartar borrador</button></form>}
    <details className="panel-card"><summary className="cursor-pointer font-bold">Historial y referencias</summary>{history.length ? history.map(item => <p className="mt-3 text-sm" key={item.id}>{item.evento === "generado" ? "Borrador generado" : "Partidos confirmados"} · {new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date(item.ocurrido_en))} · {item.referencia}</p>) : <p className="mt-3 text-sm">Sin eventos.</p>}</details>
  </div>;
}
