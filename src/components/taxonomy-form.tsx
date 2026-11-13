"use client";

import Link from "next/link";
import { createContext, useActionState, useContext, useState, type ReactNode } from "react";
import { saveTaxonomy, setTaxonomyActive } from "@/app/panel/administrador/categorias-niveles/actions";
import { TAXONOMIES, type Taxonomy, type TaxonomyRecord, type TaxonomyState } from "@/lib/categorias-niveles";

const FeedbackContext = createContext<((state: TaxonomyState) => void) | null>(null);

// El aviso sobrevive si activar/desactivar hace desaparecer una fila por el filtro actual.
export function TaxonomyFeedback({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<TaxonomyState>({});
  return <FeedbackContext.Provider value={setFeedback}>
    {feedback.success && <p role="status" className="mb-5 rounded-xl bg-green-50 p-3 text-sm text-green-800">{feedback.success}</p>}
    {feedback.error && <p role="alert" className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{feedback.error}</p>}
    {children}
  </FeedbackContext.Provider>;
}

export function TaxonomyForm({ table, record, registeredCodes, cancelHref }: {
  table: Taxonomy; record: TaxonomyRecord | null; registeredCodes: string[]; cancelHref: string;
}) {
  const [state, action, pending] = useActionState<TaxonomyState, FormData>(saveTaxonomy.bind(null, table, record?.id ?? null), {});
  const value = (name: keyof TaxonomyRecord) => state.values?.[name] ?? String(record?.[name] ?? (name === "activo" ? true : ""));
  const attrs = (name: string) => ({ "aria-invalid": !!state.errors?.[name], "aria-describedby": state.errors?.[name] ? `taxonomy-error-${name}` : undefined });
  const error = (name: string) => state.errors?.[name] ? <span id={`taxonomy-error-${name}`} className="mt-1 block text-sm text-amber-900">{state.errors[name]}</span> : null;
  const available = Object.keys(TAXONOMIES[table].codes).some(code => !registeredCodes.includes(code));
  return <section className="panel-card min-w-0" aria-labelledby="taxonomy-form-title">
    <h2 id="taxonomy-form-title" className="text-xl font-bold">{record ? `Editar ${TAXONOMIES[table].singular} #${record.id}` : `Registrar ${TAXONOMIES[table].singular}`}</h2>
    <p className="mt-2 text-sm text-slate-600">No se insertan registros automáticamente. El código identifica el concepto y no se cambia después de registrarlo.</p>
    {!record && !available && <p role="status" className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">Todos los códigos permitidos ya están registrados. Utiliza Editar o Activar en el listado.</p>}
    {state.error && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{state.error}</p>}
    {state.success && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{state.success}</p>}
    <form action={action} aria-busy={pending} className="mt-5">
      <fieldset disabled={pending || (!record && !available)} className="min-w-0 space-y-4 disabled:opacity-60">
        {record ? <label className="form-label">Código (no editable)<input className="input bg-slate-50" readOnly value={record.codigo}/></label>
          : <label className="form-label">Código<select className="input" name="codigo" required defaultValue={state.values?.codigo ?? ""} {...attrs("codigo")}>
            <option value="">Selecciona un código</option>
            {Object.entries(TAXONOMIES[table].codes).map(([code, name]) => <option key={code} value={code} disabled={registeredCodes.includes(code)}>{name} · {code}{registeredCodes.includes(code) ? " (ya registrado)" : ""}</option>)}
          </select>{error("codigo")}</label>}
        <label className="form-label">Nombre<input className="input" name="nombre" required maxLength={100} defaultValue={value("nombre")} {...attrs("nombre")}/>{error("nombre")}</label>
        {table === "categorias" && <label className="form-label">Orden de presentación (opcional)<input type="number" className="input" name="orden_presentacion" min={0} max={2147483647} step={1} defaultValue={value("orden_presentacion")} {...attrs("orden_presentacion")}/>{error("orden_presentacion")}</label>}
        <label className="form-label">Estado<select className="input" name="activo" defaultValue={value("activo")} {...attrs("activo")}><option value="true">Activo</option><option value="false">Inactivo</option></select>{error("activo")}</label>
        <button type="submit" className="btn-primary w-full disabled:cursor-wait">{pending ? "Guardando…" : record ? "Guardar cambios" : "Registrar"}</button>
      </fieldset>
    </form>
    {record && <Link className="btn-secondary mt-4 w-full" href={cancelHref}>Terminar edición</Link>}
  </section>;
}

export function TaxonomyStatusButton({ table, record }: { table: Taxonomy; record: TaxonomyRecord }) {
  const feedback = useContext(FeedbackContext);
  const [state, action, pending] = useActionState<TaxonomyState, FormData>(async () => {
    const result = await setTaxonomyActive(table, record.id, !record.activo);
    feedback?.(result);
    return result;
  }, {});
  return <form action={action} aria-busy={pending} className="space-y-2">
    <button type="submit" className="btn-secondary !px-3 !py-2 text-sm disabled:opacity-60" disabled={pending} aria-label={`${record.activo ? "Desactivar" : "Activar"} ${record.nombre} #${record.id}`}>{pending ? "Actualizando…" : record.activo ? "Desactivar" : "Activar"}</button>
    {!feedback && state.error && <p role="alert" className="max-w-xs text-xs text-amber-900">{state.error}</p>}
    {!feedback && state.success && <p role="status" className="max-w-xs text-xs text-green-800">{state.success}</p>}
  </form>;
}
