"use client";

import { useActionState } from "react";
import { savePreparation, saveStageFormat, approvePreparation } from "@/app/panel/juez-general/preparacion/actions";
import { STAGES, STAGE_LABELS, preparationLock, type Preparation, type StageFormat, type Stage } from "@/lib/preparacion-deportiva";
import { localDateTime, repeatedHourChoice, displayLeagueTime, type Competition } from "@/lib/competencias";
import type { CatalogState } from "@/lib/catalogos";

function Feedback({ state }: { state: CatalogState }) {
  return <>{state.error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-red-900">{state.error}</p>}{state.success && <p role="status" className="mb-3 rounded-xl bg-green-50 p-3 text-green-900">{state.success}</p>}{state.errors && <ul className="mb-3 list-inside list-disc text-sm text-red-900">{Object.entries(state.errors).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>}</>;
}
function StageForm({ seasonId, dateId, competition, stage, record, locked }: { seasonId: number; dateId: number; competition: Competition; stage: Stage; record: StageFormat | null; locked: boolean }) {
  const [state, action, pending] = useActionState(saveStageFormat.bind(null, seasonId, dateId, competition.id, stage, record?.actualizado_en ?? null), {} as CatalogState);
  return <form action={action} className="rounded-xl border p-4"><h4 className="mb-3 font-semibold">{STAGE_LABELS[stage]}</h4><Feedback state={state}/><fieldset disabled={locked || pending} className="space-y-3">
    <label className="form-label">Mejor de<select className="input" name="mejor_de" defaultValue={state.values?.mejor_de ?? String(record?.mejor_de ?? "")} required><option value="">Pendiente de configurar</option><option value="3">3 sets</option><option value="5">5 sets</option></select></label>
    <label className="form-label">Referencia de resolución, si corresponde<input className="input" name="referencia_resolucion" maxLength={1000} defaultValue={state.values?.referencia_resolucion ?? record?.referencia_resolucion ?? ""}/></label>
    <button className="btn-secondary">{pending ? "Guardando…" : `Guardar ${STAGE_LABELS[stage]}`}</button>
  </fieldset>{record && <p className="mt-3 text-xs text-slate-600">Actualización: {displayLeagueTime(record.actualizado_en)} · actor {record.actualizado_por}.</p>}</form>;
}
export function PreparationForm({ seasonId, dateId, day, competition, record, formats, blockers, refreshHref }: { seasonId: number; dateId: number; day: string; competition: Competition; record: Preparation | null; formats: StageFormat[]; blockers: string[]; refreshHref: string }) {
  const [state, action, pending] = useActionState(savePreparation.bind(null, seasonId, dateId, competition.id, record?.actualizado_en ?? null), {} as CatalogState);
  const [approval, approve, approving] = useActionState(approvePreparation.bind(null, seasonId, dateId, competition.id, record?.actualizado_en ?? null), {} as CatalogState);
  const lock = preparationLock(competition, record);
  const value = (key: string, fallback = "") => state.values?.[key] ?? String(record?.[key as keyof Preparation] ?? fallback);
  return <section id="preparation-form" className="panel-card space-y-5" aria-label={`Preparar competencia ${competition.id}`}>
    <h3 className="text-xl font-bold">Preparar competencia #{competition.id}</h3>
    {lock && <p role="status" className="rounded-xl bg-amber-50 p-3 text-amber-900">{lock}</p>}
    <p className="text-sm text-slate-600">Guarda primero el borrador y luego cada etapa. La aprobación utiliza únicamente los datos guardados. No se completan reglas pendientes.</p>
    <form action={action}><Feedback state={state}/><fieldset disabled={!!lock || pending || approving} className="grid gap-4 sm:grid-cols-2">
      <label className="form-label">Inicio deportivo · America/Santiago<input className="input" name="inicio_programado" type="datetime-local" step="0.001" min={`${day}T00:00`} max={`${day}T23:59:59.999`} defaultValue={state.values?.inicio_programado ?? localDateTime(record?.inicio_programado ?? null)}/></label>
      <label className="form-label">Ocurrencia si la hora se repite<select className="input" name="ocurrencia" defaultValue={state.values?.ocurrencia ?? repeatedHourChoice(record?.inicio_programado ?? null)}><option value="">Seleccionar solo si se repite</option><option value="primera">Primera ocurrencia</option><option value="segunda">Segunda ocurrencia</option></select></label>
      <label className="form-label">Mínimo de participantes<input className="input" name="minimo_participantes" type="number" min="1" max="2147483647" defaultValue={value("minimo_participantes")}/></label>
      {(["grupo_minimo", "grupo_maximo"] as const).map(key => <label key={key} className="form-label">{key === "grupo_minimo" ? "Tamaño mínimo de grupo" : "Tamaño máximo de grupo"}<select className="input" name={key} defaultValue={value(key)}><option value="">Pendiente</option><option value="3">3 participantes</option><option value="4">4 participantes</option></select></label>)}
      <label className="form-label">Formato deportivo<select className="input" name="formato_competencia" defaultValue={value("formato_competencia")}><option value="">Pendiente</option><option value="grupos_eliminacion_simple">Grupos y eliminación simple</option></select></label>
      <label className="form-label">Motivo de resolución excepcional<textarea className="input" name="motivo_resolucion" maxLength={2000} defaultValue={value("motivo_resolucion")}/></label>
      <label className="form-label">Referencia documental de resolución<input className="input" name="referencia_resolucion" maxLength={1000} defaultValue={value("referencia_resolucion")}/></label>
      <p className="text-sm sm:col-span-2">Un mínimo inferior a cuatro exige motivo y referencia documental. Los tamaños de grupo admitidos por 003 son tres o cuatro. El reglamento se toma de la categoría; aquí no se valida ni modifica.</p>
      <button className="btn-primary">{pending ? "Guardando…" : "Guardar borrador deportivo"}</button>
    </fieldset></form>
    <h3 className="text-lg font-bold">Sets por etapa</h3>
    {!record && <p>Guarda primero el borrador para habilitar las etapas.</p>}
    <div className="grid gap-3 sm:grid-cols-2">{STAGES.map(stage => <StageForm key={stage} seasonId={seasonId} dateId={dateId} competition={competition} stage={stage} record={formats.find(f => f.etapa === stage) ?? null} locked={!!lock || !record || pending || approving}/>)}</div>
    <section aria-label="Requisitos de aprobación"><h3 className="mb-2 text-lg font-bold">Requisitos pendientes</h3>{blockers.length ? <ul className="list-inside list-disc text-sm">{blockers.map(reason => <li key={reason}>{reason}</li>)}</ul> : <p>Los requisitos consultados están completos. PostgreSQL debe confirmar la aprobación.</p>}</section>
    <form action={approve}><Feedback state={approval}/><fieldset disabled={!!lock || blockers.length > 0 || pending || approving} className="space-y-3"><label className="flex items-start gap-2"><input type="checkbox" name="confirmacion" value="revisada" required/><span>Revisé la configuración guardada y sus referencias documentales.</span></label><button className="btn-primary">{approving ? "Comprobando…" : "Aprobar configuración guardada"}</button></fieldset></form>
    {record && <p className="text-xs text-slate-600">Última actualización: {displayLeagueTime(record.actualizado_en)} · actor {record.actualizado_por}. Aprobación: {displayLeagueTime(record.aprobado_en)}{record.aprobado_por ? ` · actor ${record.aprobado_por}` : ""}.</p>}
    <button type="button" className="btn-secondary" onClick={() => window.location.assign(refreshHref)}>Recargar datos guardados</button>
  </section>;
}
