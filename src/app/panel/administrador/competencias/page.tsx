import Link from "next/link";
import Form from "next/form";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminNavigation } from "@/components/admin-navigation";
import { CompetitionForm } from "@/components/competition-form";
import { JourneyOverview } from "@/components/journey-overview";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";
import type { Season, Concept, SeasonCategory } from "@/lib/temporadas-deportivas";
import { COMPETITIONS_PATH, COMPETITION_COLUMNS, displayLeagueTime, type Competition, type CompetitionDate, type SportsControl } from "@/lib/competencias";

export const dynamic = "force-dynamic";
export const metadata = { title: "Competencias por fecha" };

export default async function CompetitionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireRole("administrador");
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === "string" ? value : ""]));
  const q = (query.q ?? "").trim().slice(0, 100);
  const state = ["activo", "inactivo", "borrador", "pendiente", "aprobada"].includes(query.estado) ? query.estado : "todos";
  let seasons: Season[] = [], dates: CompetitionDate[] = [], categories: SeasonCategory[] = [], concepts: Concept[] = [], levels: Concept[] = [], competitions: Competition[] = [], controls: SportsControl[] = [];
  let failed = false;
  try {
    const db = await createClient();
    async function read<T>(table: string, columns: string, filters: Record<string, number> = {}): Promise<T[]> {
      const rows: T[] = [];
      for (let offset = 0; ; offset += 500) {
        let request = db.from(table).select(columns).order(table === "competencia_control_deportivo" ? "competencia_id" : "id").range(offset, offset + 499);
        for (const [key, value] of Object.entries(filters)) request = request.eq(key, value);
        const { data, error } = await request;
        if (error) throw new Error("Consulta no disponible");
        rows.push(...(data ?? []) as unknown as T[]);
        if (!data || data.length < 500) return rows;
      }
    }
    seasons = await read<Season>("temporadas", "id,nombre,anio");
    const season = validId(query.temporada ?? "") ? seasons.find(s => s.id === Number(query.temporada)) : undefined;
    if (season) {
      [dates, categories, concepts, levels] = await Promise.all([
        read<CompetitionDate>("fechas", "id,temporada_id,numero,fecha,comuna,recinto,estado", { temporada_id: season.id }),
        read<SeasonCategory>("categorias_temporada", "id,temporada_id,categoria_id,nivel_id,codigo,rama,criterio_nacimiento,anio_nacimiento_desde,anio_nacimiento_hasta,reglamento_id,activo", { temporada_id: season.id }),
        read<Concept>("categorias", "id,codigo,nombre,activo"), read<Concept>("niveles", "id,codigo,nombre,activo"),
      ]);
      const date = validId(query.fecha ?? "") ? dates.find(d => d.id === Number(query.fecha)) : undefined;
      if (date) [competitions, controls] = await Promise.all([
        // Solo lectura diagnóstica de la columna heredada; nunca configura ni limita participantes.
        read<Competition & { cupo_maximo: number | null }>("competencias", `${COMPETITION_COLUMNS},cupo_maximo`, { temporada_id: season.id, fecha_id: date.id }),
        read<SportsControl>("competencia_control_deportivo", "competencia_id,configuracion_aprobada,estado_deportivo,inicio_programado,minimo_participantes", { temporada_id: season.id }),
      ]);
    }
  } catch { failed = true; }
  const season = seasons.find(s => String(s.id) === query.temporada);
  const date = dates.find(d => String(d.id) === query.fecha);
  const options = categories.map(c => ({ id: c.id, activo: c.activo, label: `${concepts.find(x => x.id === c.categoria_id)?.nombre ?? c.codigo} / ${levels.find(x => x.id === c.nivel_id)?.nombre ?? "Nivel pendiente"} · ${c.rama ?? "Rama pendiente"} (${c.codigo})${!c.activo ? " — Inactiva" : ""}` }));
  const label = (c: Competition) => options.find(x => x.id === c.categoria_temporada_id)?.label ?? `Categoría #${c.categoria_temporada_id}`;
  const sports = (id: number) => controls.find(c => c.competencia_id === id) ?? null;
  const matches = competitions.filter(c => `${label(c)} #${c.id}`.toLocaleLowerCase("es").includes(q.toLocaleLowerCase("es")) && (state === "todos" || (state === "activo" ? c.activo : state === "inactivo" ? !c.activo : state === "borrador" ? !c.publicada : state === "aprobada" ? !!sports(c.id)?.configuracion_aprobada : !sports(c.id)?.configuracion_aprobada)));
  const editing = validId(query.editar ?? "") ? competitions.find(c => c.id === Number(query.editar)) ?? null : null;
  const legacyIds = competitions.filter(c => (c as Competition & { cupo_maximo?: number | null }).cupo_maximo != null).map(c => `#${c.id}`);
  const href = (changes: Record<string, string> = {}) => `${COMPETITIONS_PATH}?${new URLSearchParams({ temporada: query.temporada ?? "", fecha: query.fecha ?? "", q, estado: state, ...changes })}`;
  const day = (iso: string) => iso.split("-").reverse().join("-"); // date civil, sin conversión UTC.
  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    <AdminNavigation current={COMPETITIONS_PATH}/><h2 className="text-2xl font-bold">Competencias por fecha</h2>
    <p className="mb-5 mt-2 text-sm text-slate-600">Configuración administrativa individual. Plazos expresados en America/Santiago. La aprobación e inicio deportivo corresponden exclusivamente al Juez General.</p>
    <Form action={COMPETITIONS_PATH} className="panel-card mb-5 flex flex-wrap items-end gap-3"><label className="form-label">Temporada<select className="input" name="temporada" defaultValue={query.temporada ?? ""} required><option value="">Selecciona una temporada</option>{seasons.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.anio})</option>)}</select></label><button className="btn-primary">Consultar temporada</button></Form>
    {failed ? <p role="alert" className="panel-card text-amber-900">No se pudo consultar la información. El formulario permanece bloqueado hasta comprobar los datos y permisos. <Link className="underline" href={href()}>Reintentar</Link></p> : !season ? <p className="panel-card">Selecciona una temporada existente desde el formulario. Regístrala antes en «Temporadas y fechas» si no aparece.</p> : <>
      <Form action={COMPETITIONS_PATH} className="panel-card mb-5 flex flex-wrap items-end gap-3"><input type="hidden" name="temporada" value={season.id}/><label className="form-label">Fecha de {season.nombre}<select className="input" name="fecha" defaultValue={query.fecha ?? ""} required><option value="">Selecciona una fecha</option>{dates.map(d => <option key={d.id} value={d.id}>Fecha {d.numero} · {day(d.fecha)} · {d.comuna} ({d.estado})</option>)}</select></label><button className="btn-primary">Consultar fecha</button></Form>
      {!dates.length && <p className="panel-card mb-5">Esta temporada todavía no tiene fechas registradas. Usa únicamente fechas confirmadas por la Liga.</p>}
      <details className="panel-card mb-5 text-sm"><summary className="cursor-pointer font-semibold">Categorías individuales de esta temporada ({options.filter(c => c.activo).length} activas)</summary><ul className="mt-3 list-inside list-disc">{options.map(c => <li key={c.id}>{c.label}</li>)}</ul>{!options.length && <p>Configura primero las categorías de temporada.</p>}</details>
      <p className="panel-card mb-5 text-sm">Las jornadas se consultan desde Supabase, sin fechas ni horarios fijos. El documento de referencia puede corresponder a otra jornada: verifica con la Liga sus plazos vigentes. No se precargan ni corrigen automáticamente tarifas, fechas u horarios.</p>
      {!date ? <p className="panel-card">Selecciona una fecha válida de esta temporada.</p> : <>
        {legacyIds.length > 0 && <p role="status" className="panel-card mb-5 text-amber-900">Hay valores heredados de máximo general en las competencias {legacyIds.join(", ")}. Requieren revisión administrativa; no se han cambiado. No representan límites de participación. La migración 004 pendiente elimina su comparación heredada con el mínimo; hasta aplicarla, PostgreSQL 003 puede rechazar la habilitación administrativa.</p>}
        <JourneyOverview date={date} competitions={competitions} controls={controls} categories={options} baseHref={`${COMPETITIONS_PATH}?${new URLSearchParams({ temporada: String(season.id), fecha: String(date.id) })}`}/>
        {date.estado === "borrador" && <p className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Esta fecha está en borrador: su registro no constituye confirmación oficial de la Liga. Las inscripciones no pueden habilitarse mientras la fecha no esté publicada.</p>}
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]"><section className="panel-card min-w-0" aria-label="Listado de competencias">
          <Form action={COMPETITIONS_PATH} role="search" className="mb-5 flex flex-wrap items-end gap-3"><input type="hidden" name="temporada" value={season.id}/><input type="hidden" name="fecha" value={date.id}/><label className="form-label flex-1">Buscar categoría o identificador<input className="input" name="q" type="search" maxLength={100} defaultValue={q}/></label><label className="form-label">Estado<select className="input" name="estado" defaultValue={state}><option value="todos">Todos</option><option value="activo">Activas</option><option value="inactivo">Inactivas</option><option value="borrador">No publicadas / borrador</option><option value="pendiente">Sin aprobación deportiva</option><option value="aprobada">Con aprobación deportiva</option></select></label><button className="btn-primary">Buscar</button><Link className="btn-secondary" href={href({ q: "", estado: "todos" })}>Limpiar</Link></Form>
          {!matches.length ? <p className="rounded-xl bg-slate-50 p-4">{competitions.length ? "No hay competencias para estos filtros." : "Todavía no hay competencias asociadas a esta fecha."}</p> : <><p className="mb-3 text-sm">{matches.length} competencias</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Competencias de la fecha {date.numero}</caption><thead><tr className="border-b"><th scope="col" className="p-3">Categoría / estado</th><th scope="col" className="p-3">Condiciones administrativas</th><th scope="col" className="p-3">Control deportivo</th><th scope="col" className="p-3">Acciones</th></tr></thead><tbody>{matches.map(c => <tr key={c.id} className="border-b align-top"><th scope="row" className="p-3">{label(c)}<span className="mt-2 block font-normal">#{c.id} · {c.activo ? "Activa" : "Inactiva"} · {c.publicada ? "Publicada" : "Borrador"}</span></th><td className="space-y-2 p-3"><p>Tarifa: {c.tarifa_clp === null ? "Pendiente" : new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(c.tarifa_clp)}</p><p>Apertura: {displayLeagueTime(c.inscripcion_abre_en)}</p><p>Cierre: {displayLeagueTime(c.inscripcion_cierra_en)}</p><p>Inscripciones: {c.inscripciones_habilitadas ? "Habilitadas administrativamente (sujetas al plazo)" : "Deshabilitadas"}</p></td><td className="space-y-2 p-3">{sports(c.id)?.configuracion_aprobada ? <><p className="font-semibold text-green-800">Aprobación deportiva registrada</p><p>{sports(c.id)?.estado_deportivo}</p><p>Inicio: {displayLeagueTime(sports(c.id)?.inicio_programado ?? null)}</p></> : <p className="font-semibold text-amber-900">Sin aprobación deportiva del Juez General</p>}</td><td className="p-3"><Link className="font-semibold text-brand underline" href={href({ editar: String(c.id) })}>Editar<span className="sr-only"> competencia #{c.id}</span></Link></td></tr>)}</tbody></table></div></>}
        </section>{query.editar && !editing ? <p role="alert" className="panel-card">La competencia no existe en esta fecha. <Link className="underline" href={href()}>Volver</Link></p> : <CompetitionForm key={`${season.id}-${date.id}-${editing?.id ?? "nuevo"}-${query.categoria ?? ""}`} seasonId={season.id} date={date} record={editing} categories={options} registeredCategoryIds={competitions.map(c => c.categoria_temporada_id)} initialCategoryId={validId(query.categoria ?? "") ? Number(query.categoria) : null} sports={editing ? sports(editing.id) : null} cancelHref={href()}/>}</div>
      </>}
    </>}
  </DashboardShell>;
}
