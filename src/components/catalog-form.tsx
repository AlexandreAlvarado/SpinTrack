"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveCatalog, setCatalogActive } from "@/app/panel/administrador/catalogos/actions";
import { CATALOGS, type Catalog, type CatalogOption, type CatalogRecord, type CatalogState } from "@/lib/catalogos";

export function CatalogForm({ catalog, record, localidades, cancelHref }: {
  catalog: Catalog;
  record: CatalogRecord | null;
  localidades?: CatalogOption[];
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState<CatalogState, FormData>(saveCatalog.bind(null, catalog, record?.id ?? null), {});
  const value = (name: keyof CatalogRecord) => state.values?.[name] ?? String(record?.[name] ?? (name === "activo" ? true : ""));
  const error = (name: string) => state.errors?.[name] ? <span id={`error-${name}`} className="mt-1 block text-sm text-amber-900">{state.errors[name]}</span> : null;
  const relation = (name: "localidad_id" | "asociacion_id", label: string, options: CatalogOption[] = []) => (
    <label className="form-label">{label} (opcional)
      <select className="input" name={name} defaultValue={value(name)} aria-invalid={!!state.errors?.[name]} aria-describedby={state.errors?.[name] ? `error-${name}` : undefined}>
        <option value="">Sin asignar</option>
        {options.map(option => <option key={option.id} value={option.id}>{option.nombre} · #{option.id}{!option.activo ? " (inactivo)" : ""}</option>)}
      </select>{error(name)}
    </label>
  );
  if (catalog === "clubes" && !Array.isArray(localidades)) return <section className="panel-card" aria-labelledby="catalog-form-title"><h2 id="catalog-form-title" className="text-xl font-bold">Registrar club</h2><p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">No se pudieron cargar las localidades. Reintenta antes de guardar.</p></section>;
  return <section className="panel-card" aria-labelledby="catalog-form-title">
    <h2 id="catalog-form-title" className="text-xl font-bold">{record ? `Editar ${CATALOGS[catalog].singular} #${record.id}` : `Registrar ${CATALOGS[catalog].singular}`}</h2>
    <p className="mt-2 text-sm text-slate-600">El nombre es obligatorio. Desactivar conserva el registro y sus relaciones.</p>
    {state.error && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{state.error}</p>}
    {state.success && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{state.success}</p>}
    <form action={action} className="mt-5" aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-4 disabled:opacity-60">
        <label className="form-label">Nombre
          <input className="input" name="nombre" defaultValue={value("nombre")} required maxLength={150} aria-invalid={!!state.errors?.nombre} aria-describedby={state.errors?.nombre ? "error-nombre" : undefined}/>{error("nombre")}
        </label>
        {catalog === "localidades" ? <>
          <label className="form-label">Región (opcional)<input className="input" name="region" maxLength={150} defaultValue={value("region")} aria-invalid={!!state.errors?.region}/>{error("region")}</label>
          <label className="form-label">País (opcional)<input className="input" name="pais" maxLength={100} defaultValue={value("pais")} aria-invalid={!!state.errors?.pais}/>{error("pais")}</label>
        </> : relation("localidad_id", "Localidad", localidades)}
        <label className="form-label">Estado
          <select className="input" name="activo" defaultValue={value("activo")} aria-invalid={!!state.errors?.activo}><option value="true">Activo</option><option value="false">Inactivo</option></select>{error("activo")}
        </label>
        <button className="btn-primary w-full disabled:cursor-wait" type="submit">{pending ? "Guardando…" : record ? "Guardar cambios" : "Registrar"}</button>
      </fieldset>
    </form>
    {record && <Link className="btn-secondary mt-4 w-full" href={cancelHref}>Terminar edición</Link>}
  </section>;
}

export function CatalogStatusButton({ catalog, record }: { catalog: Catalog; record: CatalogRecord }) {
  const [state, action, pending] = useActionState<CatalogState, FormData>(setCatalogActive.bind(null, catalog, record.id, !record.activo), {});
  return <form action={action} aria-busy={pending} className="space-y-2">
    <button className="btn-secondary !px-3 !py-2 text-sm disabled:opacity-60" disabled={pending} type="submit" aria-label={`${record.activo ? "Desactivar" : "Activar"} ${record.nombre} #${record.id}`}>
      {pending ? "Actualizando…" : record.activo ? "Desactivar" : "Activar"}
    </button>
    {state.error && <p role="alert" className="max-w-xs text-xs text-amber-900">{state.error}</p>}
    {state.success && <p role="status" className="max-w-xs text-xs text-green-800">{state.success}</p>}
  </form>;
}
