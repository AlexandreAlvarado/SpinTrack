"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveCompetition } from "@/app/panel/administrador/competencias/actions";
import { localDateTime, repeatedHourChoice, openingBlockers, competitionTimingIssues, displayLeagueTime, type Competition, type CompetitionDate, type CompetitionState, type SportsControl } from "@/lib/competencias";

export function CompetitionForm({ seasonId, date, record, categories, registeredCategoryIds = [], initialCategoryId = null, sports, cancelHref }: {
  seasonId: number; date: CompetitionDate; record: Competition | null; categories: { id: number; label: string; activo: boolean }[]; registeredCategoryIds?: number[]; initialCategoryId?: number | null; sports: SportsControl | null; cancelHref: string;
}) {
  const [state, action, pending] = useActionState<CompetitionState, FormData>(saveCompetition.bind(null, seasonId, date.id, record?.id ?? null), {});
  const value = (key: keyof Competition, fallback = "") => state.values?.[key] ?? String(record?.[key] ?? fallback);
  const locked = !!(record?.publicada || record?.inscripciones_habilitadas);
  const blockers = record ? openingBlockers(record, date, sports) : ["Guarda primero la competencia en borrador. La aprobación deportiva está pendiente."];
  const available = categories.some(c => c.activo && !registeredCategoryIds.includes(c.id));
  const selectedCategory = initialCategoryId && categories.some(c => c.id === initialCategoryId && c.activo && !registeredCategoryIds.includes(c.id)) ? String(initialCategoryId) : "";
  const timing = record ? competitionTimingIssues(record, date, sports) : null;
  const dateField = (key: "inscripcion_abre_en" | "inscripcion_cierra_en", label: string) => <div>
    <label className="form-label">{label} (America/Santiago)<input className="input" name={key} type="datetime-local" step="any" readOnly={locked} defaultValue={state.values?.[key] ?? localDateTime(record?.[key] ?? null)} aria-invalid={!!state.errors?.[key]}/></label>
    <label className="form-label mt-2 text-sm">Solo si la hora se repite por cambio de horario<select className="input" name={`${key}_ocurrencia`} defaultValue={state.values?.[`${key}_ocurrencia`] ?? repeatedHourChoice(record?.[key] ?? null)}><option value="">Sin elegir / no se repite</option><option value="primera">Primera ocurrencia (instante anterior)</option><option value="segunda">Segunda ocurrencia (instante posterior)</option></select></label>
  </div>;
  return <section id="competition-form" className="panel-card min-w-0 scroll-mt-6" aria-label={record ? "Editar competencia" : "Registrar competencia"}>
    <h3 className="mb-4 text-xl font-bold">{record ? `Editar competencia #${record.id}` : "Registrar competencia"}</h3>
    {state.error && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-amber-900">{state.error}</p>}
    {state.success && <p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-green-800">{state.success}</p>}
    {state.errors && <ul className="mb-4 list-inside list-disc text-sm text-red-700" aria-label="Campos que requieren corrección">{Object.entries(state.errors).map(([key, message]) => <li key={key}>{message}</li>)}</ul>}
    <p className="mb-4 text-sm">{sports?.configuracion_aprobada ? `Aprobación deportiva registrada · ${sports.estado_deportivo}` : "Sin aprobación deportiva del Juez General."} Esta sección no modifica decisiones deportivas.</p>
    <p className="mb-4 text-sm">Inicio deportivo: {displayLeagueTime(sports?.inicio_programado ?? null)}. Lo configura el Juez General de forma independiente para cada competencia; puede coincidir con otras categorías.</p>
    {timing && [...Object.values(timing.errors), ...(timing.sportsIssue ? [timing.sportsIssue] : [])].map(message => <p key={message} className="mb-3 text-sm text-amber-900">Requiere revisión: {message} No se ha modificado el registro.</p>)}
    {!record && !available && <p role="status" className="mb-4 text-sm">Todas las categorías activas ya están asociadas o no hay categorías activas. Edita una competencia existente o configura las categorías de temporada.</p>}
    {locked && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm">Para cambiar tarifa, plazos o cupo, guarda primero «No publicada» e «Inscripciones deshabilitadas», sin cambiar las condiciones. Luego vuelve a editar.</p>}
    <form action={action}><fieldset disabled={pending || (!record && !available)} className="space-y-4">
      {record ? <p className="text-sm font-semibold">{categories.find(c => c.id === record.categoria_temporada_id)?.label ?? `Categoría #${record.categoria_temporada_id}`}<span className="mt-1 block font-normal">La temporada, fecha y categoría no son editables.</span></p> : <label className="form-label">Categoría individual de temporada<select className="input" name="categoria_temporada_id" defaultValue={value("categoria_temporada_id", selectedCategory)} required><option value="">Selecciona</option>{categories.filter(c => c.activo).map(c => <option key={c.id} value={c.id} disabled={registeredCategoryIds.includes(c.id)}>{c.label}{registeredCategoryIds.includes(c.id) ? " — Ya asociada (editar)" : ""}</option>)}</select></label>}
      <label className="form-label">Tarifa CLP (vacío = pendiente)<input className="input" name="tarifa_clp" type="number" min="0" max="2147483647" step="1" readOnly={locked} defaultValue={value("tarifa_clp")} aria-invalid={!!state.errors?.tarifa_clp}/></label>
      {dateField("inscripcion_abre_en", "Apertura de inscripciones")}{dateField("inscripcion_cierra_en", "Cierre de inscripciones")}
      <p className="text-sm text-slate-600">Apertura anterior al cierre; ambos no pueden superar el día local de la jornada ni el inicio deportivo cuando esté programado. Deja pendientes los datos desconocidos. No se fuerza un plazo reglamentario sin confirmar su vigencia.</p>
      <label className="form-label">Cupo máximo opcional<input className="input" name="cupo_maximo" type="number" min="1" max="2147483647" step="1" readOnly={locked} defaultValue={value("cupo_maximo")} aria-invalid={!!state.errors?.cupo_maximo}/></label>
      <label className="form-label">Estado administrativo<select className="input" name="activo" defaultValue={value("activo", "true")}><option value="true">Activo</option><option value="false">Inactivo (sin eliminar)</option></select></label>
      <label className="form-label">Publicación<select className="input" name="publicada" defaultValue={value("publicada", "false")}><option value="false">No publicada / borrador</option><option value="true" disabled={!sports?.configuracion_aprobada}>Publicada (requiere aprobación deportiva)</option></select></label>
      <label className="form-label">Habilitación administrativa de inscripciones<select className="input" name="inscripciones_habilitadas" defaultValue={value("inscripciones_habilitadas", "false")}><option value="false">Deshabilitadas</option><option value="true" disabled={blockers.length > 0}>Habilitadas</option></select></label>
      {!!blockers.length && <div className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-semibold">Inscripciones bloqueadas:</p><ul className="list-inside list-disc">{blockers.map(reason => <li key={reason}>{reason}</li>)}</ul></div>}
      <p className="text-sm text-slate-600">Guarda los requisitos y la publicación antes de habilitar. Habilitada no significa abierta fuera del plazo. No hay formulario de inscripciones en este módulo. Para desactivar, elige también «No publicada» e «Inscripciones deshabilitadas».</p>
      <div className="flex flex-wrap gap-3"><button className="btn-primary">{pending ? "Guardando…" : "Guardar competencia"}</button><Link className="btn-secondary" href={cancelHref}>Nuevo / cancelar</Link></div>
    </fieldset></form>
  </section>;
}
