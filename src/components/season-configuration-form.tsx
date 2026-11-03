"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveSeasonConfiguration } from "@/app/panel/administrador/temporadas-deportivas/actions";
import { COMBINATIONS, type Concept, type Rule, type SeasonCategory, type SeasonState } from "@/lib/temporadas-deportivas";

export function SeasonConfigurationForm({ kind, seasonId, record, categories, levels, rules, cancelHref }: {
  kind: "reglamentos" | "categorias"; seasonId: number; record: Rule | SeasonCategory | null; categories: Concept[]; levels: Concept[]; rules: Rule[]; cancelHref: string;
}) {
  const [state, action, pending] = useActionState<SeasonState, FormData>(saveSeasonConfiguration.bind(null, kind, seasonId, record?.id ?? null), {});
  const saved = (record ?? {}) as Record<string, unknown>;
  const value = (key: string, fallback = "") => state.values?.[key] ?? String(saved[key] ?? fallback);
  const [categoryId, setCategoryId] = useState(value("categoria_id"));
  const categoryCode = categories.find(item => String(item.id) === categoryId)?.codigo ?? "";
  const field = (key: string, label: string, max: number, required = false) => <label className="form-label">{label}<input className="input" name={key} defaultValue={value(key)} maxLength={max} required={required} aria-invalid={!!state.errors?.[key]}/></label>;
  return <section className="panel-card min-w-0">
    <h3 className="mb-4 text-xl font-bold">{record ? `Editar #${record.id}` : "Registrar"} {kind === "reglamentos" ? "reglamento" : "combinación"}</h3>
    {state.error && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-amber-900">{state.error}</p>}
    {state.success && <p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-green-800">{state.success}</p>}
    {state.errors && <ul aria-label="Campos que requieren corrección" className="mb-4 list-inside list-disc text-sm text-red-700">{Object.entries(state.errors).map(([key, message]) => <li key={key}>{message}</li>)}</ul>}
    <form action={action}><fieldset disabled={pending} className="space-y-4">
      {kind === "reglamentos" ? <>
        {record ? <p className="text-sm">Versión: <strong>{(record as Rule).version}</strong>. La temporada y la versión no pueden cambiarse.</p> : field("version", "Versión documental", 50, true)}
        {field("titulo", "Título", 200, true)}
        {field("referencia_documental", "Referencia del documento oficial (sin datos privados)", 1000, true)}
        {field("hash_documento", "SHA-256 del documento (opcional)", 64)}
        <label className="form-label">Revisión<select className="input" name="estado_revision" defaultValue={value("estado_revision", "pendiente")}><option value="pendiente">Pendiente de validación de la Liga</option><option value="validado">Formalmente validado por la Liga</option></select></label>
        {field("referencia_aprobacion", "Referencia de aprobación formal (obligatoria si está validado)", 1000)}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmacion_liga" value="true"/>Confirmo que la Liga aprobó formalmente esta versión y que la referencia permite verificarlo. Registrar un documento no equivale a aprobarlo.</label>
        <p className="text-sm text-slate-600">Una versión validada y utilizada queda protegida por PostgreSQL. Para cambiar su significado, registra una nueva versión.</p>
      </> : <>
        {record ? <p className="text-sm">Código: <strong>{(record as SeasonCategory).codigo}</strong>. La categoría, el nivel y la temporada son inmutables.</p> : <>
          <label className="form-label">Categoría<select className="input" name="categoria_id" value={categoryId} onChange={event => setCategoryId(event.target.value)} required><option value="">Selecciona</option>{categories.filter(item => item.activo).map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
          <label className="form-label">Nivel<select key={categoryId} className="input" name="nivel_id" defaultValue={value("nivel_id")} required><option value="">Selecciona</option>{levels.filter(item => item.activo && COMBINATIONS[categoryCode]?.includes(item.codigo)).map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
        </>}
        <label className="form-label">Rama<select className="input" name="rama" defaultValue={value("rama")}><option value="">Pendiente de confirmar</option><option value="mixta">Mixta</option><option value="varones">Varones</option><option value="damas">Damas</option></select></label>
        <label className="form-label">Criterio de nacimiento<select className="input" name="criterio_nacimiento" defaultValue={value("criterio_nacimiento", "pendiente")}><option value="pendiente">Pendiente</option><option value="rango_anios">Rango de años</option><option value="sin_limite">Sin límite de edad documentado</option></select></label>
        {field("anio_nacimiento_desde", "Año de nacimiento desde (solo para rango)", 4)}
        {field("anio_nacimiento_hasta", "Año de nacimiento hasta (solo para rango)", 4)}
        <label className="form-label">Reglamento de esta temporada<select className="input" name="reglamento_id" defaultValue={value("reglamento_id")}><option value="">Pendiente de asociar</option>{rules.map(item => <option key={item.id} value={item.id}>{item.version} — {item.titulo} ({item.estado_revision})</option>)}</select></label>
        <label className="form-label">Estado administrativo<select className="input" name="activo" defaultValue={value("activo", "true")}><option value="true">Activo</option><option value="false">Inactivo</option></select></label>
        <p className="text-sm text-slate-600">Activo no significa aprobado ni habilita inscripciones. Deja rama y nacimiento pendientes cuando falte confirmación documental. Las decisiones deportivas corresponden al Juez General.</p>
      </>}
      <div className="flex flex-wrap gap-3"><button className="btn-primary" type="submit">{pending ? "Guardando…" : "Guardar"}</button><Link className="btn-secondary" href={cancelHref}>Nuevo / cancelar edición</Link></div>
    </fieldset></form>
  </section>;
}
