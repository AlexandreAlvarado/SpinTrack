import Link from "next/link";
import Form from "next/form";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { CatalogForm, CatalogStatusButton } from "@/components/catalog-form";
import { getCatalogOptions } from "@/lib/admin-options";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CATALOGS, catalogPath, isCatalog, validId, type CatalogRecord } from "@/lib/catalogos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catálogos administrativos" };
const PAGE_SIZE = 25;

export default async function CatalogPage({ params, searchParams }: {
  params: Promise<{ catalogo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRole("administrador");
  const { catalogo } = await params;
  if (!isCatalog(catalogo)) notFound();
  const rawQuery = await searchParams;
  const query = Object.fromEntries(Object.entries(rawQuery).map(([key, value]) => [key, typeof value === "string" ? value : undefined]));
  const q = (query.q ?? "").trim().slice(0, 100);
  const estado = ["activo", "inactivo"].includes(query.estado ?? "") ? query.estado! : "todos";
  const pageNumber = Number(query.pagina ?? "1");
  const page = Number.isSafeInteger(pageNumber) && pageNumber > 0 && pageNumber <= 1000000 ? pageNumber : 1;
  const base = catalogPath(catalogo);
  function href(changes: Record<string, string> = {}) {
    const search = new URLSearchParams({ q, estado, pagina: String(page), ...changes });
    return `${base}?${search}`;
  }
  const supabase = await createClient();
  let records: CatalogRecord[] = [];
  let count = 0;
  let listError = false;
  let record: CatalogRecord | null = null;
  let editError = "";
  const [localidades, asociaciones] = await Promise.all([
    catalogo === "localidades" ? { data: [], error: false } : getCatalogOptions("localidades"),
    catalogo === "clubes" ? getCatalogOptions("asociaciones") : { data: [], error: false },
  ]);
  try {
    let request = supabase.from(catalogo).select(CATALOGS[catalogo].columns, { count: "exact" });
    if (q) request = request.ilike("nombre", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
    if (estado !== "todos") request = request.eq("activo", estado === "activo");
    const result = await request.order("nombre").order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    listError = !!result.error;
    if (!listError) {
      records = (result.data ?? []) as unknown as CatalogRecord[];
      count = result.count ?? 0;
    }
    if (query.editar) {
      if (!validId(query.editar)) editError = "El identificador solicitado no es válido.";
      else {
        const result = await supabase.from(catalogo).select(CATALOGS[catalogo].columns).eq("id", query.editar).maybeSingle();
        if (result.error) editError = "No se pudo consultar el registro para editar. Inténtalo nuevamente.";
        else if (!result.data) editError = "El registro solicitado no existe o no está disponible para tu sesión.";
        else record = result.data as unknown as CatalogRecord;
      }
    }
  } catch {
    listError = true;
    if (query.editar) editError = "No se pudo cargar el registro para editar. Comprueba la conexión.";
  }
  const optionsError = localidades.error || asociaciones.error;
  const localityNames = new Map(localidades.data.map(item => [item.id, item.nombre]));
  const associationNames = new Map(asociaciones.data.map(item => [item.id, item.nombre]));
  const relationName = (id: number | null | undefined, names: Map<number, string>) => id == null ? "Sin asignar" : names.get(id) ?? `#${id} (nombre no disponible)`;

  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    
    <h2 className="mb-5 text-2xl font-bold">Gestión de {CATALOGS[catalogo].title.toLowerCase()}</h2>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="panel-card min-w-0" aria-label="Listado de registros">
        <Form action={base} className="mb-6 flex flex-wrap items-end gap-3" role="search">
          <label className="form-label min-w-0 flex-1">Buscar por nombre<input className="input" name="q" type="search" maxLength={100} defaultValue={q}/></label>
          <label className="form-label">Estado<select className="input" name="estado" defaultValue={estado}><option value="todos">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select></label>
          <button className="btn-primary" type="submit">Buscar</button>
          <Link className="btn-secondary" href={base}>Limpiar</Link>
        </Form>
        {listError ? <div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No se pudo consultar el listado. Comprueba la conexión, la migración 002 y los permisos de Supabase. <Link className="font-semibold underline" href={href()}>Reintentar</Link></div>
          : records.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-slate-600">{q || estado !== "todos" ? "No hay resultados para estos filtros." : page > 1 ? "No hay registros en esta página." : "Todavía no hay registros. Utiliza el formulario para registrar el primero."}</p>
          : <><p className="mb-3 text-sm text-slate-500">{count} registros encontrados · Página {page}</p>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable horizontalmente"><table className="w-full text-left text-sm"><caption className="sr-only">{CATALOGS[catalogo].title}</caption>
              <thead><tr className="border-b text-slate-500"><th scope="col" className="p-3">Registro</th><th scope="col" className="p-3">{catalogo === "localidades" ? "Ubicación" : "Relaciones"}</th><th scope="col" className="p-3">Estado</th><th scope="col" className="p-3">Acciones</th></tr></thead>
              <tbody>{records.map(item => <tr key={item.id} className="border-b border-slate-100 align-top">
                <th scope="row" className="p-3 font-semibold"><span className="block">{item.nombre}</span><span className="font-normal text-slate-500">#{item.id}</span></th>
                <td className="p-3 text-slate-600">{catalogo === "localidades" ? <>{item.region ?? "Sin región"}<br/>{item.pais ?? "Sin país"}</> : <>{relationName(item.localidad_id, localityNames)}{catalogo === "clubes" && <><br/>{relationName(item.asociacion_id, associationNames)}</>}</>}</td>
                <td className={`p-3 font-semibold ${item.activo ? "text-green-700" : "text-slate-500"}`}>{item.activo ? "Activo" : "Inactivo"}</td>
                <td className="space-y-2 p-3"><Link className="inline-block font-semibold text-brand underline" href={href({ editar: String(item.id) })}>Editar<span className="sr-only"> {item.nombre} #{item.id}</span></Link><CatalogStatusButton catalog={catalogo} record={item}/></td>
              </tr>)}</tbody>
            </table></div></>}
        {!listError && (page > 1 || count > page * PAGE_SIZE) && <nav className="mt-5 flex flex-wrap gap-3" aria-label="Paginación">
          {page > 1 && <Link className="btn-secondary" href={href({ pagina: String(page - 1) })}>Anterior</Link>}
          {count > page * PAGE_SIZE && <Link className="btn-secondary" href={href({ pagina: String(page + 1) })}>Siguiente</Link>}
        </nav>}
      </section>
      {editError ? <section className="panel-card"><p role="alert" className="text-amber-900">{editError}</p><Link className="btn-secondary mt-4" href={href()}>Volver al registro</Link></section>
        : optionsError ? <section className="panel-card"><p role="alert" className="text-amber-900">No se pudieron cargar las localidades o asociaciones. El formulario no se habilita para evitar perder relaciones.</p><Link className="btn-secondary mt-4" href={href(query.editar ? { editar: query.editar } : {})}>Reintentar</Link></section>
        : <CatalogForm key={`${catalogo}-${record?.id ?? "nuevo"}`} catalog={catalogo} record={record} localidades={localidades.data} asociaciones={asociaciones.data} cancelHref={href()}/>}
    </div>
  </DashboardShell>;
}
