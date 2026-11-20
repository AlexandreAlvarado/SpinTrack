import Link from "next/link";
import { PERSONAL_DATA_REVIEW_PENDING } from "@/lib/legal";
import { publicState, type PublicCompetition, type PublicMatch, type PublicRound } from "@/lib/public-tournaments";

export function PublicReadNotice({ unavailable }: { unavailable: boolean }) {
  if (PERSONAL_DATA_REVIEW_PENDING) return <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm">La publicación de nombres, participantes, resultados y ranking está temporalmente suspendida durante la revisión institucional y de protección de menores. El calendario no identifica participantes.</p>;
  return unavailable ? <p role="status" className="empty-state">No pudimos cargar la información deportiva. Intenta nuevamente en unos minutos.</p> : null;
}

export function CompetitionCards({ competitions }: { competitions: PublicCompetition[] }) {
  if (!competitions.length) return <p className="empty-state">Todavía no hay categorías publicadas para esta jornada.</p>;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{competitions.map(item => <article key={item.id} className="panel-card min-w-0">
    <span className="tag">{publicState(item.estado)}</span><h3 className="mt-3 text-lg font-bold">{item.nombre}</h3>
    {item.inicio && <p className="mt-2 text-sm text-slate-600">Inicio: {new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit" }).format(new Date(item.inicio))}</p>}
    {item.campeon && <p className="mt-3 font-semibold text-brand">Campeón: {item.campeon}</p>}
    <Link className="mt-4 inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4" href={`/competencias/${item.id}`}>Ver competencia y resultados →</Link>
  </article>)}</div>;
}

export function PublicMatchCard({ match }: { match: PublicMatch }) {
  const confirmed = match.estado === "confirmado";
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-sm">
    <p className="mb-2 text-xs text-slate-500">{confirmed ? "Resultado confirmado" : "Pendiente de resultado"}</p>
    {(["a", "b"] as const).map(side => <div key={side} className={`flex items-center justify-between gap-3 rounded p-2 ${confirmed && match.ganador === side ? "bg-emerald-50 font-bold text-emerald-800" : "text-slate-700"}`}>
      <span className="min-w-0 break-words">{match[side] ?? (match[`origen_${side}`] ? `Ganador de ${match[`origen_${side}`]}` : "Participante por definir")}{confirmed && match.ganador === side && <span className="ml-2 text-xs">✓ Ganador</span>}</span>
      <span className="shrink-0 font-bold">{confirmed ? match[`sets_${side}`] ?? "—" : "—"}</span>
    </div>)}
    {confirmed && match.sets?.length ? <p className="mt-2 text-xs text-slate-600">Sets: {match.sets.map(set => `${set.a}–${set.b}`).join(" · ")}</p> : null}
  </article>;
}

export function PublicBracket({ rounds }: { rounds: PublicRound[] }) {
  if (!rounds.length) return <p className="empty-state">Las eliminatorias aparecerán cuando se confirme la llave.</p>;
  return <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Llave de eliminatorias">{rounds.map((round, index) => <section key={round.numero} className="min-w-0 rounded-xl bg-slate-100 p-3">
    <h3 className="mb-3 font-bold">{index === rounds.length - 1 ? "Final" : round.nombre}</h3>
    <div className="space-y-3">{round.partidos.map(match => <PublicMatchCard key={match.numero} match={match} />)}</div>
  </section>)}</div>;
}
