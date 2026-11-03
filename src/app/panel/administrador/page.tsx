import type { Metadata } from "next";
import Link from "next/link";
import { AdminNavigation } from "@/components/admin-navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { createSeason, createEventDate } from "@/app/actions";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Administración" };
export const dynamic = "force-dynamic";

type Season = { id: number; nombre: string; anio: number };
type EventDate = { id: number; numero: number; fecha: string; comuna: string; recinto: string; estado: string };

export default async function AdminPage({searchParams}: {searchParams:Promise<{ok?:string;error?:string}>}) {
  const profile = await requireRole("administrador");
  const supabase = await createClient();
  const [seasonsResult, datesResult, params] = await Promise.all([
    supabase.from("temporadas").select("id,nombre,anio").order("anio", {ascending:false}),
    supabase.from("fechas").select("id,numero,fecha,comuna,recinto,estado").order("fecha",{ascending:false}),
    searchParams,
  ]);
  const seasons = (seasonsResult.data ?? []) as Season[];
  const fechas = (datesResult.data ?? []) as EventDate[];

  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    <AdminNavigation current="/panel/administrador"/>
    <section className="panel-card mb-6"><h2 className="text-xl font-bold">Catálogos administrativos</h2><p className="mt-2 text-sm text-slate-600">Registra, edita y activa o desactiva localidades, asociaciones y clubes.</p><nav className="mt-4 flex flex-wrap gap-3" aria-label="Gestión de catálogos"><Link className="btn-secondary" href="/panel/administrador/catalogos/localidades">Localidades</Link><Link className="btn-secondary" href="/panel/administrador/catalogos/asociaciones">Asociaciones</Link><Link className="btn-secondary" href="/panel/administrador/catalogos/clubes">Clubes</Link></nav></section>
    {params.ok && <p className="mb-5 rounded-xl bg-green-50 p-4 text-sm font-medium text-green-800">Registro creado correctamente.</p>}
    {params.error && <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-900">No se pudo guardar. Revisa los campos, valores repetidos y permisos de Supabase.</p>}
    <div className="grid gap-4 sm:grid-cols-3"><div className="panel-card"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Temporadas</p><p className="mt-2 text-3xl font-extrabold">{seasons.length}</p></div><div className="panel-card"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fechas registradas</p><p className="mt-2 text-3xl font-extrabold">{fechas.length}</p></div><div className="panel-card"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Publicadas</p><p className="mt-2 text-3xl font-extrabold">{fechas.filter(x=>x.estado==="publicada").length}</p></div></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="panel-card"><h2 className="text-xl font-bold">Crear temporada</h2><p className="mt-1 text-sm text-slate-600">Configuración administrativa.</p><form action={createSeason} className="mt-5 space-y-4"><label className="form-label">Nombre<input className="input" name="nombre" placeholder="Temporada 2026" required maxLength={100}/></label><label className="form-label">Año<input className="input" name="anio" type="number" min="2020" max="2100" defaultValue={new Date().getFullYear()} required/></label><button type="submit" className="btn-primary">Guardar temporada</button></form></section>
      <section className="panel-card"><h2 className="text-xl font-bold">Crear fecha</h2><p className="mt-1 text-sm text-slate-600">El estado «publicada» la mostrará en el inicio y calendario público.</p>{seasons.length===0?<p className="mt-4 text-sm font-medium text-amber-800">Primero debes crear una temporada.</p>:<form action={createEventDate} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="form-label sm:col-span-2">Temporada<select className="input" name="temporada_id" required>{seasons.map(s=><option key={s.id} value={s.id}>{s.nombre} ({s.anio})</option>)}</select></label><label className="form-label">N.° de fecha<input className="input" name="numero" type="number" min="1" required/></label><label className="form-label">Día<input className="input" name="fecha" type="date" required/></label><label className="form-label">Comuna<input className="input" name="comuna" placeholder="Valdivia" required/></label><label className="form-label">Recinto<input className="input" name="recinto" placeholder="Gimnasio..." required/></label><label className="form-label sm:col-span-2">Visibilidad<select className="input" name="estado"><option value="borrador">Borrador (privada)</option><option value="publicada">Publicada</option></select></label><button className="btn-primary sm:col-span-2" type="submit">Guardar fecha</button></form>}</section>
    </div>
    <section className="panel-card mt-6"><h2 className="text-xl font-bold">Fechas registradas</h2>{fechas.length===0?<p className="mt-3 text-sm text-slate-500">Aún no existen fechas.</p>:<div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-3">N.°</th><th>Fecha</th><th>Comuna / Recinto</th><th>Estado</th></tr></thead><tbody>{fechas.map(f=><tr className="border-b border-slate-100" key={f.id}><td className="py-3 font-bold">{f.numero}</td><td>{formatDate(f.fecha)}</td><td>{f.comuna} · {f.recinto}</td><td><span className={f.estado==="publicada"?"text-green-700 font-semibold":"text-amber-700 font-semibold"}>{f.estado}</span></td></tr>)}</tbody></table></div>}</section>
    <p className="mt-6 text-sm text-slate-500">La dirección deportiva de los partidos corresponde al Juez General, no al Administrador.</p>
  </DashboardShell>;
}
