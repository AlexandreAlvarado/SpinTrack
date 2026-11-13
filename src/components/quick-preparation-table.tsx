"use client";

import Link from "next/link";
import { useActionState, useState, type SelectHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { saveQuickPreparations, approveQuickPreparations } from "@/app/panel/juez-general/preparacion/quick-actions";
import { localDateTime, repeatedHourChoice, santiagoCandidates, displayLeagueTime, type Competition } from "@/lib/competencias";
import { STAGES, STAGE_LABELS, preparationLock, type Preparation, type StageFormat } from "@/lib/preparacion-deportiva";
import { compatibleTemplate, formatsRevision, type PreparationTemplate, type QuickState } from "@/lib/preparacion-rapida";

export type QuickPreparationRow = { competition: Competition; label: string; record: Preparation | null; formats: StageFormat[]; blockers: string[]; ruleId: number | null; ruleLabel: string; proposedStart: string; advancedHref: string };

// React reinicia controles no controlados al completar una acción. Conservar las
// elecciones permite corregir/reintentar filas fallidas sin reingresar sus sets.
function RememberedSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const [value,setValue] = useState(String(props.defaultValue ?? ""));
  return <select {...props} defaultValue={undefined} value={value} onChange={event => setValue(event.target.value)}/>;
}

function Results({ state }: { state: QuickState }) {
  return <div aria-live="polite">{state.error && <p role="alert" className="my-3 text-amber-950">{state.error}</p>}{state.results?.map(result => <section key={result.id} className="my-3 rounded border p-3"><h4 className="font-bold">Competencia #{result.id}</h4><ul className="list-inside list-disc text-sm">{result.steps.map((step,i) => <li key={i} className={step.error || !step.success ? "text-amber-950" : "text-green-900"}>{step.label}: {step.error ?? step.success ?? "Sin confirmación; recarga antes de continuar."}</li>)}</ul></section>)}</div>;
}

function QuickRow({ row, templates, suggested }: { row: QuickPreparationRow; templates: PreparationTemplate[]; suggested: boolean }) {
  const { competition: c, record: p } = row;
  const [time, setTime] = useState<string | null>(null);
  const local = time ?? (localDateTime(p?.inicio_programado ?? null) || (suggested ? row.proposedStart : ""));
  const lock = preparationLock(c,p);
  const missing = STAGES.filter(stage => !row.formats.some(f => f.etapa === stage && [3,5].includes(f.mejor_de)));
  const compatible = templates.filter(t => compatibleTemplate(c,row.ruleId,t));
  return <tr className="border-t align-top">
    <th scope="row" className="p-3"><label className="flex gap-2"><input type="checkbox" name="competencia" value={c.id} disabled={!!lock}/><span>{row.label}<span className="block font-normal">#{c.id}</span></span></label><Link className="mt-3 block font-normal text-brand underline" href={row.advancedHref}>Configuración avanzada</Link><input type="hidden" name={`${c.id}.revision`} value={p?.actualizado_en ?? ""}/></th>
    <td className="p-3"><strong className={`status-badge ${p?.configuracion_aprobada ? "status-approved" : lock ? "status-neutral" : "status-pending"}`}>{p?.configuracion_aprobada ? "Aprobada" : lock ? "Solo lectura" : row.blockers.length ? "Requisitos pendientes" : "Lista para revisar y aprobar"}</strong><p>{p?.estado_deportivo ?? "pendiente"}</p>{lock && <p className="mt-2 text-xs">{lock}</p>}<details className="mt-2"><summary>Reglas y requisitos ({row.blockers.length})</summary><p>{row.ruleLabel}</p><p>Mínimo: {p?.minimo_participantes ?? "Pendiente"} · Grupos: {p?.grupo_minimo ?? "—"}–{p?.grupo_maximo ?? "—"}</p><ul className="list-inside list-disc">{row.blockers.map(reason => <li key={reason}>{reason}</li>)}</ul></details></td>
    <td className="p-3"><fieldset disabled={!!lock}><label className="form-label">Inicio<input aria-label={`Inicio ${row.label}`} className="input min-w-48" type="datetime-local" step="0.001" name={`${c.id}.inicio_programado`} value={local} onChange={event => setTime(event.target.value)}/></label>{local && santiagoCandidates(local).length > 1 && <label className="form-label mt-2">Hora repetida<RememberedSelect className="input" name={`${c.id}.ocurrencia`} defaultValue={repeatedHourChoice(p?.inicio_programado ?? null)}><option value="">Selecciona ocurrencia</option><option value="primera">Primera</option><option value="segunda">Segunda</option></RememberedSelect></label>}</fieldset></td>
    <td className="p-3"><fieldset disabled={!!lock}><label className="form-label">Formato<RememberedSelect className="input min-w-48" name={`${c.id}.formato_competencia`} defaultValue={p?.formato_competencia ?? ""}><option value="">Pendiente</option><option value="grupos_eliminacion_simple">Grupos y eliminación simple</option></RememberedSelect></label></fieldset></td>
    <td className="p-3"><fieldset disabled={!!lock} className="min-w-52 space-y-2">{!missing.length ? <details><summary>Cinco etapas configuradas</summary>{row.formats.map(f => <p key={f.etapa}>{STAGE_LABELS[f.etapa]}: mejor de {f.mejor_de}</p>)}</details> : <>
      {compatible.length > 0 && <label className="form-label">Reutilizar sets aprobados<RememberedSelect className="input" name={`${c.id}.plantilla`} defaultValue=""><option value="">Configurar o usar valores comunes</option>{compatible.map(t => <option key={t.competition.id} value={t.competition.id}>{t.label}</option>)}</RememberedSelect></label>}
      <details><summary>Sets pendientes ({missing.length})</summary>{missing.map(stage => <label className="form-label" key={stage}>{STAGE_LABELS[stage]}<RememberedSelect className="input" name={`${c.id}.sets.${stage}`} defaultValue=""><option value="">Usar plantilla/comunes o dejar pendiente</option><option value="3">Mejor de 3</option><option value="5">Mejor de 5</option></RememberedSelect></label>)}</details>
    </>}</fieldset></td>
  </tr>;
}

export function QuickPreparationTable({ seasonId, dateId, day, rows, templates }: { seasonId: number; dateId: number; day: string; rows: QuickPreparationRow[]; templates: PreparationTemplate[] }) {
  const router = useRouter();
  const [suggested,setSuggested] = useState(false);
  const [saved,save,saving] = useActionState(saveQuickPreparations.bind(null,seasonId,dateId),{} as QuickState);
  const [approved,approve,approving] = useActionState(approveQuickPreparations.bind(null,seasonId,dateId),{} as QuickState);
  const ready = rows.filter(row => !preparationLock(row.competition,row.record) && !row.blockers.length && row.record);
  return <section aria-label="Preparación rápida de la jornada" className="space-y-5">
    <p>Selecciona las filas que quieras guardar. Se guardan por separado el borrador y cada etapa: no es una operación atómica. Los resultados indican exactamente qué se confirmó y qué quedó pendiente.</p>
    {day === "2026-11-07" && <button type="button" className="btn-secondary" disabled={saving || approving} onClick={() => setSuggested(true)}>Proponer horarios oficiales del 7 de noviembre (sin guardar)</button>}
    <form action={save}><fieldset disabled={saving || approving} className="space-y-4">
      <details className="panel-card"><summary className="cursor-pointer font-bold">Completar datos habituales y sets comunes</summary>
        <label className="my-3 flex gap-2"><input type="checkbox" name="habituales" value="documentados"/><span>Verifiqué que las Bases y el reglamento aplicables a cada fila seleccionada respaldan mínimo de cuatro participantes y grupos de tres o cuatro. Completar solo valores vacíos; exige reglamento validado.</span></label>
        <p className="mb-3 text-sm">Puedes indicar una vez los sets para las etapas que falten. Revisa su aplicación a las categorías seleccionadas; no se proponen valores de sets. Los sets existentes se conservan.</p>
        <div className="flex flex-wrap gap-3">{STAGES.map(stage => <label key={stage} className="form-label">{STAGE_LABELS[stage]}<RememberedSelect className="input" name={`comun.${stage}`} defaultValue=""><option value="">Sin valor común</option><option value="3">Mejor de 3</option><option value="5">Mejor de 5</option></RememberedSelect></label>)}</div>
        <label className="form-label mt-3">Formato común para filas sin formato<RememberedSelect className="input" name="comun.formato" defaultValue=""><option value="">Sin formato común</option><option value="grupos_eliminacion_simple">Grupos y eliminación simple</option></RememberedSelect></label>
        <label className="mt-4 flex gap-2"><input type="checkbox" name="reutilizacion" value="revisada"/><span>Revisé la compatibilidad documental de los sets de las plantillas elegidas. Solo se ofrecen fuentes aprobadas de la misma categoría por temporada, reglamento y formato.</span></label>
      </details>
      <div className="panel-card overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable horizontalmente"><h3 className="mb-3 text-lg font-bold">Competencias individuales ({rows.length})</h3><table className="w-full text-left text-sm"><caption className="sr-only">Preparación de las competencias individuales de la jornada</caption><thead><tr>{["Categoría / seleccionar","Estado guardado","Inicio · America/Santiago","Formato deportivo","Sets"].map(label => <th scope="col" key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{rows.map(row => <QuickRow key={`${row.competition.id}-${row.record?.actualizado_en ?? "nuevo"}`} row={row} templates={templates} suggested={suggested}/>)}</tbody></table></div>
      <label className="mr-4 inline-flex gap-2"><input type="checkbox" onChange={event => { const checked = event.target.checked; event.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="competencia"]:not(:disabled)').forEach(input => { input.checked = checked; }); }}/>Seleccionar todas las editables</label>
      <button className="btn-primary">{saving ? "Guardando configuraciones…" : "Guardar filas seleccionadas"}</button>
    </fieldset><Results state={saved}/></form>
    <details className="confirmation-panel"><summary className="cursor-pointer text-lg font-bold">Revisar y aprobar configuraciones guardadas ({ready.length} listas)</summary>
      <p className="my-3">Esta aprobación utiliza únicamente los datos ya guardados que se muestran a continuación. Guarda tus cambios y recarga antes de revisarlos. Cada competencia se aprueba de manera independiente en PostgreSQL.</p>
      <form action={approve}><fieldset disabled={saving || approving} className="space-y-3">
        {!ready.length && <p>No hay configuraciones guardadas listas para aprobar. Revisa los requisitos de cada fila.</p>}
        {ready.map(row => <label key={row.competition.id} className="block rounded border p-3"><input type="checkbox" name="competencia" value={row.competition.id}/> <strong>{row.label}</strong><input type="hidden" name={`${row.competition.id}.revision`} value={row.record!.actualizado_en}/><input type="hidden" name={`${row.competition.id}.sets_revision`} value={formatsRevision(row.formats)}/><span className="block">{displayLeagueTime(row.record!.inicio_programado)} · {row.record!.formato_competencia} · Mínimo {row.record!.minimo_participantes} · Grupos {row.record!.grupo_minimo}–{row.record!.grupo_maximo}</span><span className="block">{row.formats.map(f => `${STAGE_LABELS[f.etapa]}: ${f.mejor_de}${f.referencia_resolucion ? ` (respaldo: ${f.referencia_resolucion})` : ""}`).join(" · ")}</span><span className="block">{row.ruleLabel}</span>{(row.record!.motivo_resolucion || row.record!.referencia_resolucion) && <span className="block">Resolución: {row.record!.motivo_resolucion} · Referencia: {row.record!.referencia_resolucion}</span>}</label>)}
        {ready.length > 1 && <label className="flex gap-2"><input type="checkbox" onChange={event => { const checked = event.target.checked; event.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="competencia"]').forEach(input => { input.checked = checked; }); }}/>Seleccionar todas las listas para aprobar</label>}
        <label className="flex gap-2"><input type="checkbox" name="confirmacion" value="revisada" required/><span>Revisé la configuración guardada de cada competencia seleccionada y sus referencias documentales. Confirmo explícitamente su aprobación deportiva.</span></label><button className="btn-primary" disabled={!ready.length}>{approving ? "Comprobando aprobaciones…" : "Aprobar competencias seleccionadas"}</button>
      </fieldset><Results state={approved}/></form>
    </details>
    <button type="button" className="btn-secondary" disabled={saving || approving} onClick={() => router.refresh()}>Recargar configuraciones guardadas</button>
  </section>;
}
