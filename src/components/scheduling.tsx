"use client";
import { useActionState, useState } from "react";
import { manageSchedule, type ScheduleState } from "@/app/panel/juez-general/programacion/actions";
import { matchKey, type Allocation, type ScheduleData, type Booking } from "@/lib/programacion";
import { santiagoCandidates } from "@/lib/competencias";
import { schedulingOverview } from "@/lib/programacion-vista";
const time = (s: string) => new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" }).format(new Date(s));

function ActionForm({ dateId, children, transform, onSuccess }: { dateId: number; children: React.ReactNode; transform?: (form: FormData) => void; onSuccess?: () => void }) {
  const [state, action, pending] = useActionState(async (previous: ScheduleState, form: FormData) => {
    try { transform?.(form); } catch (e) { return { error: e instanceof Error ? e.message : "Intervalo inválido." }; }
    const result = await manageSchedule(previous, form);
    if (result.success) onSuccess?.();
    return result;
  }, {});
  return <form action={action} className="space-y-3"><input type="hidden" name="fecha_id" value={dateId} /><fieldset disabled={pending} className="space-y-3">{children}</fieldset>{pending && <p role="status">Validando…</p>}{state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.success && <p role="status" className="text-sm text-emerald-700">{state.success}</p>}</form>;
}
function Interval() {
  const [civil, setCivil] = useState("");
  const repeated = santiagoCandidates(civil).length > 1;
  return <div className="space-y-2"><p className="text-xs text-slate-500">Hora local de Chile · America/Santiago</p><div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"><label className="col-span-2 min-w-0 text-sm font-semibold sm:col-span-1"><span className="mb-1 block">Fecha y hora de inicio</span><input className="input block w-full min-w-0" type="datetime-local" name="civil" required value={civil} onChange={e => setCivil(e.target.value)} /></label><label className="min-w-0 text-sm font-semibold"><span className="mb-1 block">Duración estimada (min)</span><input className="input block w-full min-w-0" type="number" name="duracion" min="1" max="1440" required /></label><label className="min-w-0 text-sm font-semibold"><span className="mb-1 block">Descanso (min)</span><input className="input block w-full min-w-0" type="number" name="descanso" min="0" max="1440" required defaultValue="0" /></label>{repeated && <label className="col-span-2 min-w-0 text-sm font-semibold sm:col-span-3">Hora repetida por cambio de horario<select className="input w-full" name="ocurrencia" required><option value="">Seleccionar</option><option value="primera">Primera ocurrencia</option><option value="segunda">Segunda ocurrencia</option></select></label>}</div></div>;
}
const interval = (form: FormData) => {
  const candidates = santiagoCandidates(String(form.get("civil")));
  if (!candidates.length) throw new Error("Indica una hora válida de Santiago. Esta hora puede no existir por el cambio de horario.");
  if (candidates.length > 1 && !["primera", "segunda"].includes(String(form.get("ocurrencia")))) throw new Error("Indica cuál de las dos ocurrencias de la hora deseas programar.");
  const start = candidates[candidates.length > 1 && form.get("ocurrencia") === "segunda" ? 1 : 0];
  form.set("inicio", start);
  return { inicio: start, fin: new Date(Date.parse(start) + Number(form.get("duracion")) * 60000).toISOString() };
};
function AssignmentFields({ data, table, referee }: { data: ScheduleData; table: number; referee?: string }) {
  return <div className="flex flex-wrap gap-3"><label className="form-label">Mesa<select className="input" name="mesa_id" defaultValue={table}>{data.mesas.filter(t => t.estado === "disponible").map(t => <option key={t.id} value={t.id}>Mesa {t.numero}</option>)}</select></label><label className="form-label">Árbitro<select className="input" name="arbitro_id" defaultValue={referee ?? ""} required><option value="">Seleccionar</option>{data.arbitros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></label></div>;
}
function ChangeBooking({ dateId, data, booking }: { dateId: number; data: ScheduleData; booking: Booking }) {
  return <details><summary className="cursor-pointer text-sm font-semibold">Cambiar mesa o reprogramar</summary><ActionForm dateId={dateId} transform={form => { const times = interval(form); form.set("asignaciones", JSON.stringify([{ ...times, tipo: booking.tipo, partido: booking.partido, mesa_id: Number(form.get("mesa_id")), arbitro_id: form.get("arbitro_id"), reserva_id: booking.id, version: booking.version }])); }}><input type="hidden" name="operacion" value="confirmar" /><Interval /><AssignmentFields data={data} table={booking.mesa_id} referee={booking.arbitro_id} /><input className="input" name="motivo" placeholder="Motivo del cambio" maxLength={1000} required /><label className="flex gap-2 text-sm"><input type="checkbox" name="revisada" required />Revisé el nuevo intervalo y los recursos.</label><button className="btn-secondary">Confirmar cambio</button></ActionForm></details>;
}
function Proposal({ dateId, data }: { dateId: number; data: ScheduleData }) {
  const [state, action, pending] = useActionState(async (previous: ScheduleState, form: FormData) => {
    try { interval(form); } catch (e) { return { error: e instanceof Error ? e.message : "Inicio inválido." }; }
    return manageSchedule(previous, form);
  }, {});
  const [edits, setEdits] = useState<Record<number, Partial<Allocation>>>({});
  const [confirmed, setConfirmed] = useState(false);
  return <section className="panel-card space-y-4"><h3 className="font-bold">Próxima tanda · todas las categorías</h3><form action={action} onSubmit={() => { setEdits({}); setConfirmed(false); }} className="space-y-3"><input type="hidden" name="fecha_id" value={dateId} /><input type="hidden" name="operacion" value="proponer" /><fieldset disabled={pending}><Interval /><details className="my-3" open><summary className="cursor-pointer font-semibold text-sm">Árbitros disponibles para esta tanda</summary><div className="mt-2 flex flex-wrap gap-3">{data.arbitros.map(r => <label key={r.id} className="flex gap-2 text-sm"><input type="checkbox" name="arbitros" value={r.id} />{r.nombre}</label>)}</div></details><button className="btn-primary" disabled={pending}>{pending ? "Generando…" : "Generar propuesta"}</button></fieldset></form>
    <p className="text-xs text-slate-600">Estimaciones operativas, sin duración ni descanso oficiales supuestos. Los recursos en juego o revisión no se liberan por horario.</p>
    {state.error && <p role="alert">{state.error}</p>}{(confirmed || state.success) && <p role="status">{confirmed ? "Asignaciones confirmadas. Las mesas están actualizadas." : state.success}</p>}
    {!!state.warnings?.length && <details><summary className="cursor-pointer text-sm font-semibold">Conflictos y advertencias ({state.warnings.length})</summary><ul className="mt-2 space-y-1 text-sm">{state.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}
    {!confirmed && !!state.proposal?.length && <ActionForm dateId={dateId} onSuccess={() => setConfirmed(true)}><input type="hidden" name="operacion" value="confirmar" /><input type="hidden" name="asignaciones" value={JSON.stringify(state.proposal.map((p, i) => ({ ...p, ...edits[i] })))} /><input type="hidden" name="descanso" value={state.rest ?? 0} />{state.proposal.map((p, i) => {
      const m = data.partidos.find(m => matchKey(m) === `${p.tipo}:${p.partido}`);
      return <div key={`${p.tipo}:${p.partido}`} className="rounded-lg border p-3 text-sm"><p className="font-semibold">{m?.nombre_a} — {m?.nombre_b}</p><p>Competencia #{m?.competencia_id} · {p.tipo} #{p.partido} · {time(p.inicio)} a {time(p.fin)}</p><div className="mt-2 flex flex-wrap gap-3"><label>Mesa<select aria-label={`Mesa para ${p.tipo} ${p.partido}`} className="input" value={edits[i]?.mesa_id ?? p.mesa_id} onChange={e => setEdits({ ...edits, [i]: { ...edits[i], mesa_id: Number(e.target.value) } })}>{data.mesas.filter(t => t.estado === "disponible").map(t => <option key={t.id} value={t.id}>{t.numero}</option>)}</select></label><label>Árbitro<select className="input" value={edits[i]?.arbitro_id ?? p.arbitro_id} onChange={e => setEdits({ ...edits, [i]: { ...edits[i], arbitro_id: e.target.value } })}>{data.arbitros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></label></div></div>;
    })}<input className="input" name="motivo" placeholder="Referencia o motivo de la programación" maxLength={1000} required /><label className="flex gap-2 text-sm"><input type="checkbox" name="revisada" required />Revisé y autorizo esta propuesta.</label><button className="btn-primary">Confirmar asignaciones</button></ActionForm>}
  </section>;
}
function BookingDetails({ dateId, data, booking: b, active }: { dateId: number; data: ScheduleData; booking: Booking; active: Booking[] }) {
  const m = data.partidos.find(m => m.tipo === b.tipo && m.id === b.partido);
  const blocked = active.some(other => other.id !== b.id && ["en_juego", "revision"].includes(other.estado) && (other.mesa_id === b.mesa_id || other.jugadores.some(p => b.jugadores.includes(p)) || other.perfiles.some(p => b.perfiles.includes(p))));
  return <article className="space-y-3 rounded-lg border border-slate-200 p-3 text-sm">
    <p className="font-semibold">{m?.nombre_a ?? "Por definir"} — {m?.nombre_b ?? "Por definir"}</p>
    <p>Competencia #{m?.competencia_id} · {b.estado === "revision" ? "Resultado enviado / en revisión" : b.estado === "en_juego" ? "En juego" : "Asignación confirmada"}</p>
    <p>{time(b.inicio)} a {time(b.fin)} (estimado, America/Santiago)</p>
    <p>Árbitro: {data.arbitros.find(r => r.id === b.arbitro_id)?.nombre ?? "Revisar habilitación"}</p>
    {blocked && b.estado === "asignada" && <p role="status" className="text-amber-800">Espera la confirmación y liberación del encuentro anterior, o reprograma esta reserva.</p>}
    {b.estado === "asignada" && m?.elegible && <><ActionForm dateId={dateId}>
      <input type="hidden" name="reserva_id" value={b.id} /><input type="hidden" name="version" value={b.version} />
      <label className="block">Motivo / referencia<input name="motivo" className="input w-full" required maxLength={1000} /></label>
      <div className="flex flex-wrap gap-2"><button className="btn-secondary" name="operacion" value="comenzar" disabled={blocked}>En juego</button><button className="btn-secondary" name="operacion" value="liberar">Liberar reserva</button></div>
    </ActionForm><ChangeBooking dateId={dateId} data={data} booking={b} /></>}
  </article>;
}

export function Scheduling({ dateId, data, asOf }: { dateId: number; data: ScheduleData; asOf: string }) {
  const overview = schedulingOverview(data, Date.parse(asOf));
  const { active, pending } = overview;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = data.mesas.find(t => t.id === selectedId);
  const history = [...data.historial].sort((a, b) => b.id - a.id);
  const event = (h: ScheduleData["historial"][number]) => <li key={h.id} className="border-b border-slate-100 py-2 text-sm last:border-0"><p className="break-words"><span className="font-semibold">{h.evento}</span> · {h.motivo}</p><time className="text-xs text-slate-500" dateTime={h.ocurrido_en}>{time(h.ocurrido_en)}</time></li>;
  return <div className="space-y-5">
    <dl aria-label="Resumen de mesas" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[["Total de mesas", overview.total], ["Disponibles", overview.available], ["Ocupadas", overview.occupied], ["Fuera de servicio", overview.unavailable]].map(([label, count]) => <div key={label} className="rounded-xl border border-slate-200 bg-white px-3 py-2"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 text-2xl font-bold tabular-nums">{count}</dd></div>)}
    </dl>
    <section aria-label="Mesas de la jornada" className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">{data.mesas.map(t => {
        const bookings = active.filter(r => r.mesa_id === t.id).sort((a, b) => Number(["en_juego", "revision"].includes(b.estado)) - Number(["en_juego", "revision"].includes(a.estado)) || a.inicio.localeCompare(b.inicio));
        const current = bookings[0];
        const match = current && data.partidos.find(m => m.tipo === current.tipo && m.id === current.partido);
        const state = overview.tableState(t);
        const label = state === "fuera_servicio" ? "Fuera de servicio" : state === "ocupada" ? "Ocupada" : "Disponible";
        return <article key={t.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
          <h3 className="font-bold">Mesa {t.numero}<span className={`mt-1 block text-xs font-medium ${state === "ocupada" ? "text-amber-800" : state === "fuera_servicio" ? "text-slate-500" : "text-emerald-700"}`}> · {label}</span></h3>
          {current && <div className="mt-2 text-xs"><p className="truncate" title={`${match?.nombre_a ?? "Por definir"} — ${match?.nombre_b ?? "Por definir"}`}>{match?.nombre_a ?? "Por definir"} — {match?.nombre_b ?? "Por definir"}</p><p className="mt-1 text-slate-600">{current.estado === "revision" ? "Resultado enviado / en revisión" : current.estado === "en_juego" ? "En juego" : "Próximo encuentro"}</p><p className="truncate text-slate-500">Árbitro: {data.arbitros.find(r => r.id === current.arbitro_id)?.nombre ?? "Revisar habilitación"}</p></div>}
          <button type="button" className="mt-2 text-xs font-semibold text-brand-700 underline-offset-2 hover:underline" aria-label={`${bookings.length ? "Ver encuentros de" : "Gestionar"} mesa ${t.numero}`} aria-expanded={selectedId === t.id} aria-controls="detalle-mesa" onClick={() => setSelectedId(selectedId === t.id ? null : t.id)}>{selectedId === t.id ? "Cerrar detalle" : bookings.length ? `Ver encuentros (${bookings.length})` : "Gestionar mesa"}</button>
        </article>;
      })}</div>
      {!data.mesas.length && <p className="text-sm text-slate-600">Registra las mesas físicas disponibles para esta jornada.</p>}
      {selected && <section id="detalle-mesa" aria-label={`Detalle de mesa ${selected.numero}`} className="panel-card space-y-3">
        <h3 className="font-bold">Mesa {selected.numero} · detalle y acciones</h3>
        {active.filter(b => b.mesa_id === selected.id).map(b => <BookingDetails key={b.id} dateId={dateId} data={data} booking={b} active={active} />)}
        {!active.some(b => b.mesa_id === selected.id) && <ActionForm dateId={dateId}><input type="hidden" name="operacion" value="mesa" /><input type="hidden" name="numero" value={selected.numero} /><button className="btn-secondary" name="estado" value={selected.estado === "disponible" ? "fuera_servicio" : "disponible"}>{selected.estado === "disponible" ? "Fuera de servicio" : "Habilitar mesa"}</button></ActionForm>}
      </section>}
    </section>
    <details className="rounded-xl border border-slate-200 bg-white px-4 py-3"><summary className="cursor-pointer text-sm font-semibold">Registrar mesa</summary><div className="mt-3"><ActionForm dateId={dateId}><input type="hidden" name="operacion" value="mesa" /><input type="hidden" name="estado" value="disponible" /><label className="form-label">Número visible<input className="input" name="numero" type="number" min="1" required /></label><button className="btn-secondary">Registrar</button></ActionForm></div></details>
    {!pending.length ? <section className="panel-card" role="status"><h3 className="font-bold">{overview.allConfirmed ? "Todos los encuentros están confirmados" : !data.partidos.length ? "Todavía no hay encuentros en esta jornada" : "No hay encuentros pendientes de asignación"}</h3><p className="mt-2 text-sm text-slate-600">{overview.allConfirmed ? `${overview.confirmed} encuentros confirmados. No hay partidos pendientes para generar una nueva propuesta. Puedes consultar los resultados y el historial sin volver a programarlos.` : !data.partidos.length ? "La programación estará disponible cuando las competencias de esta jornada tengan partidos generados y confirmados en el flujo deportivo existente." : "Los encuentros sin confirmar ya tienen reserva. Revisa las mesas actuales; las mesas en juego o revisión se liberan al confirmar el resultado deportivo."}</p></section> : <>
      {pending.some(m => m.elegible) ? <Proposal dateId={dateId} data={data} /> : <p className="panel-card text-sm text-slate-600">No hay encuentros elegibles para proponer en este momento. Revisa los participantes, las dependencias y los resultados en revisión de los encuentros pendientes.</p>}
      <details className="panel-card" open><summary className="cursor-pointer font-bold">Encuentros pendientes ({pending.length})</summary><div className="mt-3 space-y-2">{pending.map(m => <p className="text-sm" key={matchKey(m)}>Competencia #{m.competencia_id} · {m.tipo} #{m.id} · {m.nombre_a ?? "Por definir"} — {m.nombre_b ?? "Por definir"} · {m.elegible ? "Elegible" : m.estado === "revision" || m.estado === "observado" ? "Resultado en revisión" : "Dependencias o inicio deportivo pendientes"}</p>)}</div></details>
    </>}
    <section className="panel-card"><h3 className="font-bold">Historial reciente</h3><p className="mt-1 text-xs text-slate-500">Hora local de Chile · America/Santiago</p>{!history.length ? <p className="mt-3 text-sm text-slate-600">Aún no hay cambios registrados.</p> : <><ol className="mt-2">{history.slice(0, 5).map(event)}</ol>{history.length > 5 && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Ver {history.length - 5} eventos anteriores</summary><ol start={6} className="mt-2">{history.slice(5).map(event)}</ol></details>}</>}</section>
  </div>;
}
