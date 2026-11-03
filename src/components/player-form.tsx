"use client";

import Link from "next/link";
import { useActionState } from "react";
import { savePlayer, setPlayerActive } from "@/app/panel/administrador/jugadores/actions";
import type { CatalogOption } from "@/lib/catalogos";
import type { ProfileOption } from "@/lib/admin-options";
import type { PlayerRecord, PlayerState } from "@/lib/jugadores";

export function PlayerForm({ record, localidades, clubes, perfiles, today, cancelHref }: {
  record: PlayerRecord | null;
  localidades: CatalogOption[];
  clubes: CatalogOption[];
  perfiles: ProfileOption[];
  today: string;
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState<PlayerState, FormData>(savePlayer.bind(null, record?.id ?? null), {});
  const value = (name: keyof PlayerRecord) => state.values?.[name] ?? String(record?.[name] ?? (name === "activo" ? true : ""));
  const attrs = (name: string) => ({ "aria-invalid": !!state.errors?.[name], "aria-describedby": state.errors?.[name] ? `player-error-${name}` : undefined });
  const error = (name: string) => state.errors?.[name] ? <span className="mt-1 block text-sm text-red-700" id={`player-error-${name}`}>{state.errors[name]}</span> : null;
  const relation = (name: "localidad_procedencia_id" | "club_id", label: string, options: CatalogOption[]) => <label className="form-label">{label} (opcional)
    <select name={name} className="input" defaultValue={value(name)} {...attrs(name)}><option value="">Sin asignar</option>
      {options.map(option => <option key={option.id} value={option.id}>{option.nombre} · #{option.id}{option.activo ? "" : " (inactivo)"}</option>)}
    </select>{error(name)}
  </label>;
  return <section className="panel-card min-w-0" aria-labelledby="player-form-title">
    <h2 className="text-xl font-bold" id="player-form-title">{record ? `Editar jugador #${record.id}` : "Registrar jugador"}</h2>
    <p className="mt-2 text-sm text-slate-600">Solo el nombre es obligatorio. Los nombres iguales están permitidos: cada persona conserva un ID diferente.</p>
    {state.error && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{state.error}</p>}
    {state.success && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{state.success}</p>}
    <form action={action} aria-busy={pending} className="mt-5">
      <fieldset disabled={pending} className="min-w-0 space-y-4 disabled:opacity-60">
        <label className="form-label">Nombre completo<input name="nombre_completo" className="input" required maxLength={160} defaultValue={value("nombre_completo")} autoComplete="off" {...attrs("nombre_completo")}/>{error("nombre_completo")}</label>
        <label className="form-label">Fecha de nacimiento (opcional)<input type="date" name="fecha_nacimiento" className="input" min="0001-01-01" max={today} defaultValue={value("fecha_nacimiento")} {...attrs("fecha_nacimiento")}/>{error("fecha_nacimiento")}</label>
        {relation("localidad_procedencia_id", "Localidad de procedencia", localidades)}
        {relation("club_id", "Club", clubes)}
        <label className="form-label">Estado<select className="input" name="activo" defaultValue={value("activo")} {...attrs("activo")}><option value="true">Activo</option><option value="false">Inactivo</option></select>{error("activo")}</label>
        <fieldset className="min-w-0 rounded-xl border border-slate-200 p-3">
          <legend className="px-1 text-sm font-semibold">Cuenta de usuario (opcional)</legend>
          <label className="form-label">Cuenta vinculada<select className="input" name="perfil_id" defaultValue={value("perfil_id")} {...attrs("perfil_id")}>
            <option value="">Sin cuenta vinculada</option>
            {perfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.nombre_completo} · {profile.rol} · {profile.id}</option>)}
          </select>{error("perfil_id")}</label>
          <p className="mt-2 text-xs leading-5 text-slate-600">Verifica la identidad y el UUID antes de vincular. Solo un Administrador puede cambiar este vínculo; una cuenta no puede pertenecer a dos jugadores. Seleccionar «Sin cuenta vinculada» permite desvincular sin borrar datos.</p>
          {record?.perfil_id && <p className="mt-2 break-all text-xs text-slate-600">UUID actual: {record.perfil_id}</p>}
        </fieldset>
        <button type="submit" className="btn-primary w-full disabled:cursor-wait">{pending ? "Guardando…" : record ? "Guardar cambios" : "Registrar jugador"}</button>
      </fieldset>
    </form>
    {record && <Link href={cancelHref} className="btn-secondary mt-4 w-full">Terminar edición</Link>}
  </section>;
}

export function PlayerStatusButton({ record }: { record: PlayerRecord }) {
  const [state, action, pending] = useActionState<PlayerState, FormData>(setPlayerActive.bind(null, record.id, !record.activo), {});
  return <form action={action} aria-busy={pending} className="space-y-2">
    <button type="submit" className="btn-secondary !px-3 !py-2 text-sm disabled:opacity-60" disabled={pending} aria-label={`${record.activo ? "Desactivar" : "Activar"} jugador #${record.id}`}>
      {pending ? "Actualizando…" : record.activo ? "Desactivar" : "Activar"}
    </button>
    {state.error && <p role="alert" className="max-w-xs text-xs text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="max-w-xs text-xs text-green-800">{state.success}</p>}
  </form>;
}
