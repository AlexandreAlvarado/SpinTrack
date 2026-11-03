import Link from "next/link";
import Form from "next/form";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminNavigation } from "@/components/admin-navigation";
import { SeasonConfigurationForm } from "@/components/season-configuration-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";
import { SEASON_PATH, type Season, type Concept, type Rule, type SeasonCategory } from "@/lib/temporadas-deportivas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reglamentos y categorías por temporada" };

export default async function SeasonConfigurationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireRole("administrador");
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === "string" ? value : ""]));
  const kind = query.tipo === "categorias" ? "categorias" : "reglamentos";
  const q = (query.q ?? "").trim().slice(0, 100);
  const status = ["pendiente", "validado", "activo", "inactivo"].includes(query.estado) ? query.estado : "todos";
  let seasons: Season[] = [], categories: Concept[] = [], levels: Concept[] = [], rules: Rule[] = [], combinations: SeasonCategory[] = [];
  let failed = false;
  // Lectura paginada: no asumir que la respuesta de Supabase incluye más de 1000 filas.
  try {
    const db = await createClient();
    const read = async <T,>(table: string, columns: string, seasonId?: number): Promise<T[]> => {
      const rows: T[] = [];
      for (let offset = 0; ; offset += 500) {
        let request = db.from(table).select(columns).order("id").range(offset, offset + 499);
        if (seasonId !== undefined) request = request.eq("temporada_id", seasonId);
        const { data, error } = await request;
        if (error) throw new Error("Consulta no disponible");
        rows.push(...(data ?? []) as unknown as T[]);
        if (!data || data.length < 500) return rows;
      }
    };
    seasons = await read<Season>("temporadas", "id,nombre,anio");
    const selected = validId(query.temporada ?? "") ? seasons.find(item => item.id === Number(query.temporada)) : undefined;
    if (selected) [categories, levels, rules, combinations] = await Promise.all([
      read<Concept>("categorias", "id,codigo,nombre,activo"), read<Concept>("niveles", "id,codigo,nombre,activo"),
      read<Rule>("reglamentos_temporada", "id,temporada_id,version,titulo,referencia_documental,hash_documento,estado_revision,referencia_aprobacion", selected.id),
      read<SeasonCategory>("categorias_temporada", "id,temporada_id,categoria_id,nivel_id,codigo,rama,criterio_nacimiento,anio_nacimiento_desde,anio_nacimiento_hasta,reglamento_id,activo", selected.id),
    ]);
  } catch { failed = true; }
  const season = seasons.find(item => String(item.id) === query.temporada);
  const href = (changes: Record<string, string> = {}) => `${SEASON_PATH}?${new URLSearchParams({ temporada: query.temporada ?? "", tipo: kind, q, estado: status, ...changes })}`;
  const all: (Rule | SeasonCategory)[] = kind === "reglamentos" ? rules : combinations;
  const label = (item: Rule | SeasonCategory) => "version" in item ? `${item.version} — ${item.titulo}` : `${categories.find(c => c.id === item.categoria_id)?.nombre ?? item.categoria_id} / ${levels.find(n => n.id === item.nivel_id)?.nombre ?? item.nivel_id} (${item.codigo})`;
  const matches = all.filter(item => label(item).toLocaleLowerCase("es").includes(q.toLocaleLowerCase("es")) && (status === "todos" || ("version" in item ? item.estado_revision === status : (status === "activo" ? item.activo : status === "inactivo" ? !item.activo : false))));
  const page = Math.min(Math.max(Number(query.pagina) || 1, 1), Math.max(1, Math.ceil(matches.length / 20)));
  const records = matches.slice((Math.floor(page) - 1) * 20, Math.floor(page) * 20);
  const editing = validId(query.editar ?? "") ? all.find(item => item.id === Number(query.editar)) ?? null : null;
  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    <AdminNavigation current={SEASON_PATH}/><h2 className="text-2xl font-bold">Reglamentos y categorías por temporada</h2>
    <p className="mb-5 mt-2 text-sm text-slate-600">Configuración administrativa individual. No aprueba decisiones deportivas ni abre inscripciones.</p>
    <Form action={SEASON_PATH} className="panel-card mb-5 flex flex-wrap items-end gap-3"><input type="hidden" name="tipo" value={kind}/><label className="form-label">Temporada<select className="input" name="temporada" defaultValue={query.temporada ?? ""} required><option value="">Selecciona una temporada existente</option>{seasons.map(item => <option key={item.id} value={item.id}>{item.nombre} ({item.anio})</option>)}</select></label><button className="btn-primary">Consultar temporada</button></Form>
    {failed ? <p role="alert" className="panel-card text-amber-900">No se pudo consultar la configuración. Comprueba conexión y permisos. <Link className="underline" href={href()}>Reintentar</Link></p> : !season ? <p className="panel-card">Selecciona una temporada válida. Puedes registrar temporadas desde «Temporadas y fechas».</p> : <>
      <nav className="mb-5 flex flex-wrap gap-3" aria-label="Configuración por temporada"><Link className="btn-secondary" href={href({ tipo: "reglamentos", estado: "todos", q: "" })} aria-current={kind === "reglamentos" ? "page" : undefined}>Reglamentos</Link><Link className="btn-secondary" href={href({ tipo: "categorias", estado: "todos", q: "" })} aria-current={kind === "categorias" ? "page" : undefined}>Categorías por temporada</Link></nav>
      {season.anio === 2026 && <details className="panel-card mb-5 text-sm"><summary className="cursor-pointer font-semibold">Referencia documental 2026 (no rellena ni aprueba formularios)</summary><p className="mt-3">Bases Oficiales, página 2: Peneca Inicial 2015–2017; Preinfantil Inicial/Federado 2013–2014; Infantil Inicial/Federado 2011–2012; Juvenil Inicial/Federado 2007–2010; TC Aficionado/Federado sin límite de edad. TC Damas Única: nacimiento pendiente de confirmación.</p><p className="mt-2">Excel «Grupos», cuarta fecha: diez combinaciones individuales. Hay ambigüedad entre la denominación TC Varones y la participación femenina indicada en las Bases. No deduzcas ramas por los nombres de jugadores: deja la rama pendiente si falta confirmación de la Liga. No extrapoles estos años a otras temporadas.</p></details>}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]"><section className="panel-card min-w-0">
        <Form action={SEASON_PATH} role="search" className="mb-4 flex flex-wrap items-end gap-3"><input type="hidden" name="temporada" value={season.id}/><input type="hidden" name="tipo" value={kind}/><label className="form-label flex-1">Buscar<input className="input" name="q" type="search" maxLength={100} defaultValue={q}/></label><label className="form-label">Estado<select className="input" name="estado" defaultValue={status}><option value="todos">Todos</option>{kind === "reglamentos" ? <><option value="pendiente">Pendiente</option><option value="validado">Validado</option></> : <><option value="activo">Activo</option><option value="inactivo">Inactivo</option></>}</select></label><button className="btn-primary">Buscar</button><Link className="btn-secondary" href={href({ q: "", estado: "todos" })}>Limpiar</Link></Form>
        {!matches.length ? <p className="rounded-xl bg-slate-50 p-4">{all.length ? "No hay coincidencias con estos filtros." : "Todavía no hay registros en esta temporada."}</p> : <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Configuración de {season.nombre}</caption><thead><tr className="border-b"><th className="p-3">Registro</th><th className="p-3">Configuración</th><th className="p-3">Acciones</th></tr></thead><tbody>{records.map(item => <tr key={item.id} className="border-b align-top"><th scope="row" className="p-3 font-semibold">{label(item)}</th><td className="space-y-2 break-words p-3">{"version" in item ? <><p>{item.estado_revision === "validado" ? "Validado por la Liga" : "Pendiente"}</p><p>{item.referencia_documental}</p><p>Aprobación: {item.referencia_aprobacion ?? "Sin referencia"}</p>{item.hash_documento && <p className="break-all">SHA-256: {item.hash_documento}</p>}</> : <><p>{item.activo ? "Activo" : "Inactivo"} · Rama: {item.rama ?? "Pendiente"}</p><p>Nacimiento: {item.criterio_nacimiento === "rango_anios" ? `${item.anio_nacimiento_desde}–${item.anio_nacimiento_hasta}` : item.criterio_nacimiento === "pendiente" ? "Pendiente" : "Sin límite"}</p><p>Reglamento: {rules.find(rule => rule.id === item.reglamento_id)?.version ?? "Pendiente"}</p></>}</td><td className="p-3"><Link className="font-semibold text-brand underline" href={href({ editar: String(item.id) })}>Editar<span className="sr-only"> {label(item)}</span></Link></td></tr>)}</tbody></table></div><p className="my-3 text-sm">{matches.length} registros · Página {Math.floor(page)} de {Math.ceil(matches.length / 20)}</p><div className="flex gap-3">{page > 1 && <Link className="btn-secondary" href={href({ pagina: String(page - 1) })}>Anterior</Link>}{page * 20 < matches.length && <Link className="btn-secondary" href={href({ pagina: String(page + 1) })}>Siguiente</Link>}</div></>}
      </section>{query.editar && !editing ? <p role="alert" className="panel-card">El registro no existe en esta temporada. <Link href={href()} className="underline">Volver</Link></p> : <SeasonConfigurationForm key={`${kind}-${season.id}-${editing?.id ?? "nuevo"}`} kind={kind} seasonId={season.id} record={editing} categories={categories} levels={levels} rules={rules} cancelHref={href()}/>}</div>
    </>}
  </DashboardShell>;
}
