"use client";

import { useActionState } from "react";
import { saveHabilitation } from "@/app/panel/juez-general/habilitaciones/actions";
import { habilitationRevision, HABILITATION_STATES, RESOLUTION_TYPES, type Habilitation } from "@/lib/habilitaciones";
import { displayLeagueTime } from "@/lib/competencias";
import type { CatalogState } from "@/lib/catalogos";

const fields: Record<string, string> = { estado: "Estado", tipo_resolucion: "Tipo de resolución", motivo: "Motivo", referencia_evidencia: "Referencia documental", confirmacion: "Revisión documental" };
export function HabilitationForm({ seasonId, categoryId, playerId, record, refreshHref }: { seasonId: number; categoryId: number; playerId: number; record: Habilitation | null; refreshHref: string }) {
  const [state, action, pending] = useActionState(saveHabilitation.bind(null, seasonId, categoryId, playerId, habilitationRevision(record)), {} as CatalogState);
  const value = (key: "estado" | "tipo_resolucion" | "motivo" | "referencia_evidencia") => state.values?.[key] ?? record?.[key] ?? "";
  return <section className="panel-card" id="habilitation-form" aria-label={`Resolución deportiva para jugador ${playerId}`}>
    <h3 className="mb-3 text-xl font-bold">Registrar o actualizar resolución</h3>
    {state.error && <p role="alert" className="mb-3 rounded-xl bg-blue-50 p-3 text-amber-950">{state.error}</p>}
    {state.success && <p role="status" className="mb-3 rounded-xl bg-green-50 p-3 text-green-900">{state.success}</p>}
    {state.errors && <ul className="mb-3 list-inside list-disc text-amber-950">{Object.entries(state.errors).map(([k, error]) => <li key={k}>{fields[k] ?? "Campo"}: {error}</li>)}</ul>}
    <form action={action}><fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
      <label className="form-label">Estado<select className="input" name="estado" defaultValue={value("estado")} required><option value="">Selecciona una resolución</option>{Object.entries(HABILITATION_STATES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select></label>
      <label className="form-label">Tipo de resolución<select className="input" name="tipo_resolucion" defaultValue={value("tipo_resolucion")} required><option value="">Selecciona el tipo</option>{Object.entries(RESOLUTION_TYPES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select></label>
      <label className="form-label">Motivo<textarea className="input" name="motivo" maxLength={2000} rows={4} defaultValue={value("motivo")}/></label>
      <label className="form-label">Referencia documental<input className="input" name="referencia_evidencia" maxLength={1000} defaultValue={value("referencia_evidencia")}/></label>
      <p className="text-sm text-slate-600 sm:col-span-2">Habilitado y no habilitado requieren motivo y referencia documental. Una excepción los exige incluso si está pendiente. No se adjuntan documentos ni se crea una inscripción.</p>
      <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="confirmacion" value="revisada"/><span>Para habilitar: revisé la elegibilidad, rama, condición federativa y restricciones deportivas según las referencias. Si corresponde una excepción, verifiqué su autorización documentada.</span></label>
      <button className="btn-primary">{pending ? "Guardando…" : "Guardar resolución deportiva"}</button>
    </fieldset></form>
    {record && <p className="mt-4 text-xs text-slate-600">Resolución #{record.id} · Creada: {displayLeagueTime(record.creado_en)}. Validación: {displayLeagueTime(record.validado_en)}{record.validado_por ? ` · actor ${record.validado_por}` : " · pendiente de validar"}.</p>}
    <button type="button" className="btn-secondary mt-4" onClick={() => window.location.assign(refreshHref)}>Recargar datos guardados</button>
  </section>;
}
