import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { createSeason, createEventDate } from "@/app/actions";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Panel de administración" };
export const dynamic = "force-dynamic";
const home = "/panel/administrador";
type Season = { id: number; nombre: string; anio: number };
type EventDate = { id: number; temporada_id: number; numero: number; fecha: string; comuna: string; recinto: string; estado: string; archivada: boolean };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; crear?: string }> }) {
  const profile = await requireRole("administrador");
  const supabase = await createClient();
  const [seasonsResult, datesResult, params] = await Promise.all([
    supabase.from("temporadas").select("id,nombre,anio").order("anio", { ascending: false }),
    supabase.from("fechas").select("id,temporada_id,numero,fecha,comuna,recinto,estado,archivada").order("fecha", { ascending: false }),
    searchParams,
  ]);
  const seasons = (seasonsResult.data ?? []) as Season[];
  const fechas = (datesResult.data ?? []) as EventDate[];
  const failed = !!(seasonsResult.error || datesResult.error);
  const creating = params.error === "temporada" ? "temporada" : params.error === "fecha" ? "jornada" : params.crear;

  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    {params.ok && <p role="status" className="mb-5 rounded-xl bg-green-50 p-4 text-sm font-medium text-green-800">{params.ok === "temporada" ? "Temporada creada correctamente." : params.ok === "fecha" ? "Jornada creada correctamente." : "Registro creado correctamente."}</p>}
    {params.error && <p role="alert" className="mb-5 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-900">No se pudo guardar {params.error === "temporada" ? "la temporada" : "la jornada"}. Revisa los campos obligatorios. Si el registro ya existe, consulta el listado; si el problema continúa, vuelve a intentarlo.</p>}
    {failed && <p role="alert" className="panel-card mb-5 text-amber-900">No se pudieron cargar las temporadas y jornadas. <Link className="underline" href={home}>Reintentar</Link></p>}
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="panel-card"><p className="text-sm text-slate-500">Temporadas</p><p className="mt-2 text-3xl font-extrabold">{seasonsResult.error ? "—" : seasons.length}</p></div>
      <div className="panel-card"><p className="text-sm text-slate-500">Jornadas registradas</p><p className="mt-2 text-3xl font-extrabold">{datesResult.error ? "—" : fechas.length}</p></div>
      <div className="panel-card"><p className="text-sm text-slate-500">Jornadas publicadas</p><p className="mt-2 text-3xl font-extrabold">{datesResult.error ? "—" : fechas.filter(item => item.estado === "publicada").length}</p></div>
    </div>
    <div className="my-6 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">Temporadas y jornadas</h2>
      <div className="flex flex-wrap gap-3">
        <Link href="/panel/juez-general/preparacion" className="btn-secondary">Preparación deportiva</Link>
        {process.env.NODE_ENV !== "production" && <Link href="/panel/administrador/ranking/simulacion" className="btn-secondary">Simulación de ranking</Link>}
        <Link href={home + "?crear=jornada#nuevo-registro"} className="btn-primary">+ Nueva jornada</Link>
        <Link href={home + "?crear=temporada#nuevo-registro"} className="btn-secondary">Nueva temporada</Link>
      </div>
    </div>
    {creating === "temporada" && <section id="nuevo-registro" aria-labelledby="season-title" className="panel-card mb-6 scroll-mt-6">
      <h2 id="season-title" className="text-xl font-bold">Nueva temporada</h2>
      <form action={createSeason} className="mt-5 grid max-w-2xl gap-4 sm:grid-cols-2">
        <label className="form-label">Nombre<input className="input" name="nombre" placeholder="Temporada 2026" required maxLength={100}/></label>
        <label className="form-label">Año<input className="input" name="anio" type="number" min="2020" max="2100" defaultValue={new Date().getFullYear()} required/></label>
        <div className="flex flex-wrap gap-3 sm:col-span-2"><button type="submit" className="btn-primary">Guardar temporada</button><Link className="btn-secondary" href={home}>Cancelar</Link></div>
      </form>
    </section>}
    {creating === "jornada" && <section id="nuevo-registro" aria-labelledby="date-title" className="panel-card mb-6 scroll-mt-6">
      <h2 id="date-title" className="text-xl font-bold">Nueva jornada</h2>
      <p className="mt-2 text-sm text-slate-600">Una jornada reúne las competencias de un día. Si eliges «Publicada», aparecerá en el calendario público.</p>
      {seasonsResult.error ? <p role="alert" className="mt-4">No se pudieron cargar las temporadas. Vuelve a intentar antes de registrar una jornada.</p> : seasons.length === 0 ? <p className="mt-4">Primero debes <Link className="font-semibold text-brand underline" href={home + "?crear=temporada#nuevo-registro"}>crear una temporada</Link>.</p> : <form action={createEventDate} className="mt-5 grid max-w-2xl gap-4 sm:grid-cols-2">
        <label className="form-label sm:col-span-2">Temporada<select className="input" name="temporada_id" required>{seasons.map(item => <option key={item.id} value={item.id}>{item.nombre} ({item.anio})</option>)}</select></label>
        <label className="form-label">Número de jornada<input className="input" name="numero" type="number" min="1" required/></label>
        <label className="form-label">Fecha<input className="input" name="fecha" type="date" required/></label>
        <label className="form-label">Comuna<input className="input" name="comuna" placeholder="Valdivia" required/></label>
        <label className="form-label">Recinto<input className="input" name="recinto" placeholder="Gimnasio..." required/></label>
        <label className="form-label sm:col-span-2">Visibilidad<select className="input" name="estado"><option value="borrador">Borrador (privada)</option><option value="publicada">Publicada</option></select></label>
        <div className="flex flex-wrap gap-3 sm:col-span-2"><button className="btn-primary" type="submit">Guardar jornada</button><Link className="btn-secondary" href={home}>Cancelar</Link></div>
      </form>}
      {(seasonsResult.error || !seasons.length) && <Link className="btn-secondary mt-4" href={home}>Volver al listado</Link>}
    </section>}
    <section className="panel-card"><h2 className="text-xl font-bold">Jornadas registradas</h2>
      {datesResult.error ? <p className="mt-3 text-sm text-slate-600">El listado no está disponible. Vuelve a intentar la consulta.</p> : fechas.length === 0 ? <p className="mt-3 text-sm text-slate-500">Aún no hay jornadas registradas. Usa «+ Nueva jornada» para comenzar.</p> : <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Jornadas registradas, tabla desplazable horizontalmente">
        <table className="min-w-full text-left text-sm"><caption className="sr-only">Jornadas y acceso a sus competencias</caption><thead><tr className="border-b border-slate-200 text-slate-500"><th scope="col" className="p-3">N.º</th><th scope="col" className="p-3">Fecha</th><th scope="col" className="p-3">Comuna</th><th scope="col" className="p-3">Recinto</th><th scope="col" className="p-3">Estado</th><th scope="col" className="p-3">Acciones</th></tr></thead>
          <tbody>{fechas.map(item => <tr className="border-b border-slate-100" key={item.id}>
            <th scope="row" className="p-3 font-bold">{item.numero}<span className="mt-1 block text-xs font-normal text-slate-500">{seasons.find(season => season.id === item.temporada_id)?.nombre ?? "Temporada no disponible"}</span></th>
            <td className="whitespace-nowrap p-3">{formatDate(item.fecha)}</td><td className="p-3">{item.comuna}</td><td className="p-3">{item.recinto}</td>
            <td className="p-3"><span className={item.estado === "publicada" ? "font-semibold text-green-700" : "font-semibold text-amber-700"}>{item.estado === "publicada" ? "Publicada" : item.estado === "borrador" ? "Borrador" : item.estado}</span>{item.archivada && <span className="block text-xs text-slate-500">Archivada</span>}</td>
            <td className="p-3"><Link className="mb-2 block font-semibold text-brand underline" href={`${home}/jornadas/${item.id}`}>Gestionar jornada {item.numero}</Link><Link className="font-semibold text-brand underline" href={home + "/competencias?" + new URLSearchParams({ temporada: String(item.temporada_id), fecha: String(item.id) })}>Gestionar competencias<span className="sr-only"> de la jornada {item.numero}, {formatDate(item.fecha)}</span></Link></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
    <p className="mt-6 text-sm text-slate-500">La dirección deportiva de los partidos corresponde al Juez General.</p>
  </DashboardShell>;
}
