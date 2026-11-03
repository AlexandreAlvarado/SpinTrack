import Link from "next/link";
import { competitionTimingIssues, displayLeagueTime, journeyStarts, journeySummary, type Competition, type CompetitionDate, type SportsControl } from "@/lib/competencias";

export function JourneyOverview({ date, competitions, controls, categories, baseHref }: {
  date: CompetitionDate; competitions: Competition[]; controls: SportsControl[];
  categories: { id: number; label: string; activo: boolean }[]; baseHref: string;
}) {
  const stats = journeySummary(competitions, controls);
  const starts = journeyStarts(competitions, controls);
  const labels = (ids: number[]) => ids.map(id => {
    const competition = competitions.find(c => c.id === id);
    return categories.find(c => c.id === competition?.categoria_temporada_id)?.label ?? `Competencia #${id}`;
  });
  const metrics = [
    ["Competencias configuradas", stats.configured], ["Activas", stats.active],
    ["Activas pendientes de aprobación", stats.pending], ["Publicadas", stats.published], ["Habilitadas para inscripción", stats.enabled],
  ] as const;
  return <section className="mb-6 space-y-5" aria-label="Resumen de la jornada">
    <div className="panel-card">
      <h3 className="text-xl font-bold">Una jornada, múltiples competencias individuales</h3>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-sm text-slate-500">Jornada / día local</dt><dd className="font-semibold">{date.numero} · {date.fecha.split("-").reverse().join("-")}</dd></div>
        <div><dt className="text-sm text-slate-500">Comuna</dt><dd>{date.comuna}</dd></div>
        <div><dt className="text-sm text-slate-500">Recinto compartido</dt><dd>{date.recinto}</dd></div>
        <div><dt className="text-sm text-slate-500">Estado registrado</dt><dd>{date.estado}</dd></div>
      </dl>
      <p className="mt-3 text-sm text-slate-600">El registro y la publicación administrativa no constituyen por sí solos confirmación documental de la Liga ni aprobación deportiva. Las categorías comparten jornada y recursos; no se disputan necesariamente en secuencia.</p>
    </div>
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(([label, count]) => <div key={label} className="panel-card"><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-2 text-3xl font-bold text-brand">{count}</dd></div>)}</dl>
    <p className="text-sm text-slate-500">Totales de toda la jornada, sin aplicar la búsqueda. Configuradas incluye inactivas; pendiente cuenta solo activas sin aprobación. Publicación e inscripción son indicadores independientes, no etapas que deban sumarse.</p>
    <details open className="panel-card">
      <summary className="cursor-pointer font-semibold">Categorías asociadas y por asociar</summary>
      <p className="my-3 text-sm text-slate-600">Registra cada categoría en esta misma jornada. Si ya está asociada, edítala o reactívala: no crees otra jornada ni un duplicado.</p>
      <ul className="grid gap-3 md:grid-cols-2">{categories.map(category => {
        const competition = competitions.find(c => c.categoria_temporada_id === category.id);
        const control = competition ? controls.find(c => c.competencia_id === competition.id) ?? null : null;
        const timing = competition ? competitionTimingIssues(competition, date, control) : null;
        return <li key={category.id} className="min-w-0 rounded-xl border border-slate-200 p-3">
          <p className="font-semibold">{category.label}</p>
          <p className="mt-1 text-sm">{competition ? `Asociada · #${competition.id} · ${competition.activo ? "Activa" : "Inactiva"} · ${competition.publicada ? "Publicada" : "Borrador"}` : "Sin competencia asociada"}</p>
          {competition && <><p className="mt-1 text-sm">{control?.configuracion_aprobada ? "Aprobación deportiva registrada" : "Sin aprobación deportiva del Juez General"}</p><p className="mt-1 text-sm">Inicio deportivo: {displayLeagueTime(control?.inicio_programado ?? null)}{control?.inicio_programado && !control.configuracion_aprobada ? " (sin aprobar)" : ""}</p></>}
          {timing && [...Object.values(timing.errors), ...(timing.sportsIssue ? [timing.sportsIssue] : [])].map(message => <p className="mt-2 text-sm text-amber-900" key={message}>Requiere revisión: {message}</p>)}
          {competition ? <Link className="mt-3 inline-block font-semibold text-brand underline" href={`${baseHref}&editar=${competition.id}#competition-form`}>Editar / revisar competencia #{competition.id}</Link>
            : category.activo ? <Link className="mt-3 inline-block font-semibold text-brand underline" href={`${baseHref}&categoria=${category.id}#competition-form`}>Registrar en esta jornada</Link> : <p className="mt-2 text-sm text-slate-500">Categoría de temporada inactiva</p>}
        </li>;
      })}</ul>
      {!categories.length && <p className="mt-3">No hay categorías de temporada configuradas.</p>}
    </details>
    <details className="panel-card">
      <summary className="cursor-pointer font-semibold">Inicios por categoría y futura simultaneidad</summary>
      <p className="my-3 text-sm text-slate-600">Solo lectura del control del Juez General. Compartir inicio no es un conflicto por sí solo; categorías con inicios distintos también pueden solaparse. Sin intervalos de partidos, jugadores, mesas y árbitros todavía no se verifica la disponibilidad de recursos.</p>
      <ol className="space-y-3">{starts.groups.map(group => <li key={group.instant} className="rounded-xl border border-slate-200 p-3"><p className="font-semibold">{displayLeagueTime(group.instant)}</p>{group.competitionIds.length > 1 && <p className="text-sm text-slate-600">Mismo inicio: posible simultaneidad, no verificada.</p>}<ul className="mt-2 list-inside list-disc text-sm">{labels(group.competitionIds).map((label, index) => <li key={group.competitionIds[index]}>{label}</li>)}</ul></li>)}</ol>
      {!!starts.pending.length && <div className="mt-3"><p className="font-semibold">Sin inicio programado ({starts.pending.length})</p><ul className="mt-2 list-inside list-disc text-sm">{labels(starts.pending).map((label, index) => <li key={starts.pending[index]}>{label}</li>)}</ul></div>}
      {!stats.active && <p>No hay competencias activas para mostrar inicios.</p>}
    </details>
  </section>;
}
