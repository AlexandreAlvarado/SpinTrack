import Link from "next/link";
import Form from "next/form";
import { DashboardShell } from "@/components/dashboard-shell";
import { CompetitionForm } from "@/components/competition-form";
import { FinalReferenceRegularization } from "@/components/final-reference-regularization";
import { officialStart } from "@/lib/preparacion-rapida";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";
import type { Season, Concept, SeasonCategory } from "@/lib/temporadas-deportivas";
import { COMPETITIONS_PATH, COMPETITION_COLUMNS, localDateTime, type Competition, type CompetitionDate, type SportsControl } from "@/lib/competencias";

export const dynamic = "force-dynamic";
export const metadata = { title: "Competencias por fecha" };

export default async function CompetitionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireRole("administrador");
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === "string" ? value : ""]));
  const q = (query.q ?? "").trim().slice(0, 100);
  const state = ["activo", "inactivo", "borrador", "pendiente", "aprobada"].includes(query.estado) ? query.estado : "todos";
  let seasons: Season[] = [], dates: CompetitionDate[] = [], categories: SeasonCategory[] = [], concepts: Concept[] = [], levels: Concept[] = [], competitions: Competition[] = [], controls: SportsControl[] = [];
  let finalFormats: { competencia_id: number; mejor_de: number; referencia_resolucion: string | null }[] = [];
  let failed = false;
  try {
    const db = await createClient();
    async function read<T>(table: string, columns: string, filters: Record<string, string | number> = {}): Promise<T[]> {
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
      if (date) [competitions, controls, finalFormats] = await Promise.all([
        // Solo lectura diagnóstica de la columna heredada; nunca configura ni limita participantes.
        read<Competition & { cupo_maximo: number | null }>("competencias", `${COMPETITION_COLUMNS},cupo_maximo`, { temporada_id: season.id, fecha_id: date.id }),
        read<SportsControl>("competencia_control_deportivo", "competencia_id,configuracion_aprobada,estado_deportivo,inicio_programado,minimo_participantes", { temporada_id: season.id }),
        read<{ competencia_id: number; mejor_de: number; referencia_resolucion: string | null }>("competencia_formatos_sets", "competencia_id,mejor_de,referencia_resolucion", { etapa: "final" }),
      ]);
    }
  } catch { failed = true; }
  const season = seasons.find(s => String(s.id) === query.temporada);
  const date = dates.find(d => String(d.id) === query.fecha);
  const options = categories.map(category => ({
    id: category.id, activo: category.activo,
    label: `${concepts.find(item => item.id === category.categoria_id)?.nombre ?? category.codigo} / ${levels.find(item => item.id === category.nivel_id)?.nombre ?? "Nivel pendiente"} · ${category.rama ?? "Rama pendiente"}${!category.activo ? " · Inactiva" : ""}`,
    suggestedStart: date ? officialStart(date.fecha, concepts.find(item => item.id === category.categoria_id)?.codigo ?? "", levels.find(item => item.id === category.nivel_id)?.codigo ?? "", category.rama) : "",
  }));
  const sports = (id: number) => controls.find(item => item.competencia_id === id) ?? null;
  const finalFormat = (id: number) => finalFormats.find(item => item.competencia_id === id) ?? null;
  const registered = new Set(competitions.map(item => item.categoria_temporada_id));
  // Keep every existing record, including inactive categories and unavailable concepts.
  const rows = [
    ...options.flatMap(category => {
      const existing = competitions.filter(item => item.categoria_temporada_id === category.id);
      return existing.length ? existing.map(record => ({ category, record: record as Competition | null })) : category.activo ? [{ category, record: null as Competition | null }] : [];
    }),
    ...competitions.filter(item => !options.some(category => category.id === item.categoria_temporada_id)).map(record => ({ category: { id: record.categoria_temporada_id, activo: false, label: `Categoría #${record.categoria_temporada_id} · No disponible`, suggestedStart: "" }, record: record as Competition | null })),
  ];
  const missing = options.filter(category => category.activo && !registered.has(category.id));
  const matches = rows.filter(({ category, record }) => `${category.label} #${record?.id ?? ""}`.toLocaleLowerCase("es").includes(q.toLocaleLowerCase("es")) && (state === "todos" || (!!record && (state === "activo" ? record.activo : state === "inactivo" ? !record.activo : state === "borrador" ? !record.publicada : state === "aprobada" ? !!sports(record.id)?.configuracion_aprobada : !sports(record.id)?.configuracion_aprobada))));
  // Preserve old bookmarks, but render a single management view.
  const selectedId = query.gestionar ?? query.editar ?? query.revisar;
  const managing = validId(selectedId ?? "") ? competitions.find(item => item.id === Number(selectedId)) ?? null : null;
  const creating = validId(query.categoria ?? "") ? missing.find(item => item.id === Number(query.categoria)) ?? null : null;
  const alreadyCreated = validId(query.categoria ?? "") ? competitions.find(item => item.categoria_temporada_id === Number(query.categoria)) ?? null : null;
  const legacyIds = competitions.filter(item => (item as Competition & { cupo_maximo?: number | null }).cupo_maximo != null).map(item => `#${item.id}`);
  const href = (changes: Record<string, string> = {}) => `${COMPETITIONS_PATH}?${new URLSearchParams({ temporada: query.temporada ?? "", fecha: query.fecha ?? "", q, estado: state, ...changes })}`;
  const day = (iso: string) => iso.split("-").reverse().join("-");
  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    <h2 className="mb-4 text-2xl font-bold">Competencias por fecha</h2>
    <div className="mb-4 grid gap-3 md:grid-cols-2">
      <Form action={COMPETITIONS_PATH} className="flex min-w-0 flex-wrap items-end gap-2"><label className="form-label min-w-0 flex-1">Temporada<select className="input" name="temporada" defaultValue={query.temporada ?? ""} required><option value="">Selecciona una temporada</option>{seasons.map(item => <option key={item.id} value={item.id}>{item.nombre} ({item.anio})</option>)}</select></label><button className="btn-secondary">Consultar temporada</button></Form>
      {season && <Form action={COMPETITIONS_PATH} className="flex min-w-0 flex-wrap items-end gap-2"><input type="hidden" name="temporada" value={season.id}/><label className="form-label min-w-0 flex-1">Jornada<select className="input" name="fecha" defaultValue={query.fecha ?? ""} required><option value="">Selecciona una jornada</option>{dates.map(item => <option key={item.id} value={item.id}>Jornada {item.numero} · {day(item.fecha)} · {item.comuna}</option>)}</select></label><button className="btn-primary">Consultar jornada</button></Form>}
    </div>
    {failed ? <p role="alert" className="panel-card text-amber-900">No se pudo consultar la información. <Link className="underline" href={href()}>Reintentar</Link></p> : !season ? <p className="text-sm text-slate-600">Selecciona una temporada para consultar sus jornadas.</p> : !date ? <p className="text-sm text-slate-600">{dates.length ? "Selecciona una jornada válida de esta temporada." : "Esta temporada todavía no tiene jornadas registradas."}</p> : <>
      <div className="mb-4 text-sm text-slate-600" aria-label="Resumen de la jornada"><p className="font-semibold text-slate-800">Jornada {date.numero} · {day(date.fecha)} · {date.comuna} · {date.recinto}</p><p>{competitions.length} competencias registradas · {missing.length} categorías por crear. {date.estado === "borrador" ? "Jornada en borrador: inscripciones bloqueadas." : `Jornada ${date.estado}.`}</p></div>
      <details className="mb-4" open={!!q || state !== "todos"}><summary className="cursor-pointer text-sm font-semibold text-brand">Buscar y filtrar</summary>
        <Form action={COMPETITIONS_PATH} role="search" className="mt-3 flex flex-wrap items-end gap-3"><input type="hidden" name="temporada" value={season.id}/><input type="hidden" name="fecha" value={date.id}/><label className="form-label min-w-0 flex-1">Categoría o identificador<input className="input" name="q" type="search" maxLength={100} defaultValue={q}/></label><label className="form-label">Estado<select className="input" name="estado" defaultValue={state}><option value="todos">Todos</option><option value="activo">Activas</option><option value="inactivo">Inactivas</option><option value="borrador">Borrador</option><option value="pendiente">Sin aprobación deportiva</option><option value="aprobada">Con aprobación deportiva</option></select></label><button className="btn-secondary">Buscar</button><Link className="btn-secondary" href={href({ q: "", estado: "todos" })}>Limpiar</Link></Form>
      </details>
      {!matches.length ? <p className="panel-card">{rows.length ? "No hay competencias para estos filtros." : <>No hay categorías activas ni competencias. <Link className="font-semibold text-brand underline" href={`/panel/administrador/temporadas-deportivas?temporada=${season.id}&tipo=categorias`}>Configurar categorías</Link></>}</p> : <table className="block w-full table-fixed text-left text-sm md:table" aria-label="Competencias de la jornada">
        <caption className="sr-only">Categorías y competencias de la jornada {date.numero}</caption>
        <thead className="hidden md:table-header-group"><tr className="border-b text-slate-500"><th scope="col" className="w-[28%] p-2">Categoría</th><th scope="col" className="p-2">Estado administrativo</th><th scope="col" className="p-2">Inicio deportivo</th><th scope="col" className="p-2">Inscripciones</th><th scope="col" className="p-2">Acción</th></tr></thead>
        <tbody className="block md:table-row-group">{matches.map(({ category, record }) => {
          const control = record ? sports(record.id) : null;
          const start = control?.inicio_programado;
          return <tr key={record ? `competition-${record.id}` : `category-${category.id}`} className="grid grid-cols-2 border-b border-slate-200 py-2 md:table-row md:py-0">
            <th scope="row" className="col-span-2 min-w-0 break-words p-2 align-top font-semibold [overflow-wrap:anywhere]">{category.label}{record && <span className="block text-xs font-normal text-slate-500">#{record.id}</span>}</th>
            <td className="min-w-0 break-words p-2 align-top"><span className="block text-xs text-slate-500 md:hidden">Estado administrativo</span>{record ? <>{record.activo ? "Activa" : "Inactiva"}<span className="block text-xs text-slate-500">{record.publicada ? "Publicada" : "Borrador"}</span></> : "Por crear"}</td>
            <td className="min-w-0 break-words p-2 align-top"><span className="block text-xs text-slate-500 md:hidden">Inicio deportivo</span>{start ? <>{localDateTime(start).slice(11, 16)}{localDateTime(start).slice(0, 10) !== date.fecha ? <span className="block text-xs text-amber-800">Fecha por revisar</span> : <span className="block text-xs text-slate-500">{control.configuracion_aprobada ? "Aprobado" : "Sin aprobar"}</span>}</> : category.suggestedStart ? <>{category.suggestedStart.slice(11, 16)}<span className="block text-xs text-amber-800">Sugerido · sin guardar</span></> : "Pendiente"}</td>
            <td className="min-w-0 break-words p-2 align-top"><span className="block text-xs text-slate-500 md:hidden">Inscripciones</span>{record?.inscripciones_habilitadas ? "Habilitadas" : "Deshabilitadas"}<span className="block text-xs text-slate-500">{record?.inscripciones_habilitadas ? "Sujetas al plazo" : ""}</span></td>
            <td className="min-w-0 p-2 align-top"><span className="sr-only">Acción: </span>{record ? <Link className="font-semibold text-brand underline" href={href({ gestionar: String(record.id) }) + "#competition-form"}>Gestionar<span className="sr-only"> {category.label}</span></Link> : <Link className="font-semibold text-brand underline" href={href({ categoria: String(category.id) }) + "#competition-form"}>Crear<span className="sr-only"> {category.label}</span></Link>}</td>
          </tr>;
        })}</tbody>
      </table>}
      {!!legacyIds.length && <p role="status" className="mt-3 text-sm text-amber-900">Hay valores heredados de máximo general en {legacyIds.join(", ")}. Requieren revisión; no representan límites ni se han modificado.</p>}
      <p className="my-3 text-xs text-slate-500">Inicio deportivo en America/Santiago, editable por el Juez General. Las sugerencias corresponden solo al 07-11-2026; no se guardan automáticamente.</p>
      {alreadyCreated && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">Categoría asociada a la competencia #{alreadyCreated.id}. <Link className="font-semibold underline" href={href({ gestionar: String(alreadyCreated.id) }) + "#competition-form"}>Gestionar</Link></p>}
      {((selectedId && !managing) || (query.categoria && !creating && !alreadyCreated)) && <p role="alert" className="panel-card mt-4">La competencia no está disponible o la categoría está inactiva o no pertenece a esta temporada. <Link className="underline" href={href()}>Volver al listado</Link></p>}
      {(managing || creating) && <div className="mt-4"><CompetitionForm key={[season.id, date.id, managing?.id ?? "nuevo", creating?.id ?? ""].join("-")} seasonId={season.id} date={date} record={managing} categories={options} registeredCategoryIds={competitions.map(item => item.categoria_temporada_id)} initialCategoryId={creating?.id ?? null} sports={managing ? sports(managing.id) : null} readOnly={!!managing && !options.some(item => item.id === managing.categoria_temporada_id)} cancelHref={href()}/>{managing && sports(managing.id)?.configuracion_aprobada && finalFormat(managing.id)?.mejor_de === 5 && !finalFormat(managing.id)?.referencia_resolucion && <FinalReferenceRegularization competitionId={managing.id}/>}</div>}
    </>}
  </DashboardShell>;
}
