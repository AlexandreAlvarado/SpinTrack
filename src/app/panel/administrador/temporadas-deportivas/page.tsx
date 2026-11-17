import Link from "next/link";
import Form from "next/form";
import { DashboardShell } from "@/components/dashboard-shell";
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
      read<Concept>("categorias", "id,codigo,nombre,activo"),
      read<Concept>("niveles", "id,codigo,nombre,activo"),
      read<Rule>("reglamentos_temporada", "id,temporada_id,version,titulo,referencia_documental,hash_documento,estado_revision,referencia_aprobacion", selected.id),
      read<SeasonCategory>("categorias_temporada", "id,temporada_id,categoria_id,nivel_id,codigo,rama,criterio_nacimiento,anio_nacimiento_desde,anio_nacimiento_hasta,reglamento_id,activo", selected.id),
    ]);
  } catch { failed = true; }
  const season = seasons.find(item => String(item.id) === query.temporada);
  const href = (changes: Record<string, string> = {}) => `${SEASON_PATH}?${new URLSearchParams({ temporada: query.temporada ?? "", tipo: kind, q, estado: status, ...changes })}`;
  const all: (Rule | SeasonCategory)[] = kind === "reglamentos" ? rules : combinations;
  const label = (item: Rule | SeasonCategory) => "version" in item ? `${item.version} — ${item.titulo}` : `${categories.find(c => c.id === item.categoria_id)?.nombre ?? item.categoria_id} / ${levels.find(n => n.id === item.nivel_id)?.nombre ?? item.nivel_id}`;
  const matches = all.filter(item => label(item).toLocaleLowerCase("es").includes(q.toLocaleLowerCase("es")) && (status === "todos" || ("version" in item ? item.estado_revision === status : (status === "activo" ? item.activo : status === "inactivo" ? !item.activo : false))));
  const editing = validId(query.editar ?? "") ? all.find(item => item.id === Number(query.editar)) ?? null : null;
  const creating = query.nuevo === "reglamento" || query.nuevo === "categoria";
  const currentRule = rules[0] ?? null;
  const birthRange = (item: SeasonCategory) => item.criterio_nacimiento === "rango_anios" ? `${item.anio_nacimiento_desde ?? "—"}–${item.anio_nacimiento_hasta ?? "—"}` : item.criterio_nacimiento === "sin_limite" ? "Sin límite documentado" : "Pendiente";
  const categoryTable = matches as SeasonCategory[];
  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    <h2 className="text-2xl font-bold">Reglamentos y categorías por temporada</h2>
    <Form action={SEASON_PATH} className="panel-card mb-5 mt-4 flex flex-wrap items-end gap-3"><input type="hidden" name="tipo" value={kind}/><label className="form-label">Temporada<select className="input" name="temporada" defaultValue={query.temporada ?? ""} required><option value="">Selecciona una temporada existente</option>{seasons.map(item => <option key={item.id} value={item.id}>{item.nombre} ({item.anio})</option>)}</select></label><button className="btn-primary">Consultar temporada</button></Form>
    {failed ? <p role="alert" className="panel-card text-amber-900">No se pudo consultar la configuración. Comprueba conexión y permisos. <Link className="underline" href={href()}>Reintentar</Link></p> : !season ? <p className="panel-card">Selecciona una temporada válida.</p> : <>
      <nav className="mb-5 flex flex-wrap gap-3" aria-label="Configuración por temporada"><Link className="btn-secondary" href={href({ tipo: "reglamentos", estado: "todos", q: "" })} aria-current={kind === "reglamentos" ? "page" : undefined}>Reglamentos</Link><Link className="btn-secondary" href={href({ tipo: "categorias", estado: "todos", q: "" })} aria-current={kind === "categorias" ? "page" : undefined}>Categorías por temporada</Link></nav>
      {kind === "reglamentos" ? <section className="panel-card space-y-4" aria-labelledby="current-rule-title">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-slate-500">Bases Oficiales de la temporada</p><h3 id="current-rule-title" className="text-xl font-bold">{currentRule ? currentRule.titulo : "Sin reglamento registrado"}</h3></div><div className="flex flex-wrap gap-2">{currentRule && <Link className="btn-secondary" href={href({ editar: String(currentRule.id) })}>Editar</Link>}<Link className="btn-primary" href={href({ nuevo: "reglamento" })}>{currentRule ? "Registrar nueva versión" : "Registrar reglamento"}</Link></div></div>
        {currentRule ? <div className="grid gap-3 text-sm sm:grid-cols-2"><p><strong>Temporada:</strong> {season.nombre} ({season.anio})</p><p><strong>Estado de validación:</strong> {currentRule.estado_revision === "validado" ? "Validado formalmente" : "Pendiente de validación"}</p><p className="sm:col-span-2"><strong>Referencia documental:</strong> {currentRule.referencia_documental}</p><p><strong>Aprobación formal:</strong> {currentRule.referencia_aprobacion ?? "Sin referencia registrada"}</p><p><strong>Documento:</strong> {currentRule.hash_documento ? <details className="inline"><summary className="cursor-pointer underline">Ver datos técnicos</summary><span className="ml-2 break-all">SHA-256: {currentRule.hash_documento}</span></details> : "Sin SHA-256 registrado"}</p></div> : <p className="text-sm text-slate-600">Registrar las Bases Oficiales no las valida automáticamente. La aprobación formal se registra por separado y requiere una referencia verificable.</p>}
      </section> : <section className="panel-card min-w-0" aria-labelledby="category-table-title"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 id="category-table-title" className="text-xl font-bold">Categorías de {season.nombre}</h3><p className="text-sm text-slate-600">{matches.length} combinaciones individuales configuradas.</p></div><Link className="btn-primary" href={href({ nuevo: "categoria" })}>Registrar combinación</Link></div><Form action={SEASON_PATH} role="search" className="mb-4 flex flex-wrap items-end gap-3"><input type="hidden" name="temporada" value={season.id}/><input type="hidden" name="tipo" value={kind}/><label className="form-label flex-1">Buscar<input className="input" name="q" type="search" maxLength={100} defaultValue={q}/></label><label className="form-label">Estado<select className="input" name="estado" defaultValue={status}><option value="todos">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select></label><button className="btn-secondary">Filtrar</button></Form><div className="overflow-hidden"><table className="w-full table-fixed text-left text-sm"><caption className="sr-only">Categorías de {season.nombre}</caption><thead><tr className="border-b"><th className="p-2">Categoría</th><th className="p-2">Nivel</th><th className="p-2">Nacimiento</th><th className="p-2">Estado</th><th className="p-2">Acción</th></tr></thead><tbody>{categoryTable.map(item => <tr key={item.id} className="border-b align-top"><td className="break-words p-2 font-semibold">{categories.find(c => c.id === item.categoria_id)?.nombre ?? item.codigo}</td><td className="break-words p-2">{levels.find(n => n.id === item.nivel_id)?.nombre ?? "Pendiente"}</td><td className="break-words p-2">{birthRange(item)}</td><td className="p-2">{item.activo ? "Activo" : "Inactivo"}</td><td className="p-2"><Link className="font-semibold text-brand underline" href={href({ editar: String(item.id) })}>Editar</Link></td></tr>)}</tbody></table>{!categoryTable.length && <p className="rounded-xl bg-slate-50 p-4">Todavía no hay combinaciones en esta temporada.</p>}</div></section>}
      {(creating || editing) && <section className="mt-5"><SeasonConfigurationForm key={`${kind}-${season.id}-${editing?.id ?? "nuevo"}`} kind={kind} seasonId={season.id} record={editing} categories={categories} levels={levels} rules={rules} cancelHref={href()}/></section>}
    </>}
  </DashboardShell>;
}
