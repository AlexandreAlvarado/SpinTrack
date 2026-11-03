import Link from "next/link";
import Form from "next/form";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminNavigation } from "@/components/admin-navigation";
import { TaxonomyFeedback, TaxonomyForm, TaxonomyStatusButton } from "@/components/taxonomy-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";
import { TAXONOMIES, TAXONOMY_PATH, isTaxonomy, type TaxonomyRecord } from "@/lib/categorias-niveles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categorías y niveles" };

export default async function TaxonomyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireRole("administrador");
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === "string" ? value : ""]));
  const table = isTaxonomy(query.tipo ?? "") ? query.tipo as keyof typeof TAXONOMIES : "categorias";
  const q = (query.q ?? "").trim().slice(0, 100);
  const estado = ["activo", "inactivo"].includes(query.estado) ? query.estado : "todos";
  const href = (changes: Record<string, string> = {}) => `${TAXONOMY_PATH}?${new URLSearchParams({ tipo: table, q, estado, ...changes })}`;
  let allRecords: TaxonomyRecord[] = [];
  let listError = false;
  try {
    const supabase = await createClient();
    let request = supabase.from(table).select(TAXONOMIES[table].columns);
    if (table === "categorias") request = request.order("orden_presentacion", { ascending: true, nullsFirst: false });
    const { data, error } = await request.order("nombre").order("id");
    listError = !!error;
    if (!error) allRecords = (data ?? []) as unknown as TaxonomyRecord[];
  } catch { listError = true; }
  // Como máximo existen cinco categorías/cuatro niveles por los CHECK/UNIQUE del esquema.
  // Filtrar ambas columnas aquí evita construir expresiones OR de PostgREST con texto del usuario.
  const search = q.toLocaleLowerCase("es");
  const records = allRecords.filter(record => (estado === "todos" || record.activo === (estado === "activo"))
    && (record.nombre.toLocaleLowerCase("es").includes(search) || record.codigo.includes(search)));
  const record = query.editar && validId(query.editar) ? allRecords.find(item => item.id === Number(query.editar)) ?? null : null;
  const editError = query.editar && !listError && !record ? "El identificador no es válido o el registro no existe." : "";
  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    <AdminNavigation current={TAXONOMY_PATH}/>
    <h2 className="text-2xl font-bold">Categorías y niveles</h2>
    <p className="mb-5 mt-2 text-sm text-slate-600">Catálogos individuales de la Liga. Esta sección no configura temporadas, inscripciones ni reglas de competencia.</p>
    <nav aria-label="Categorías y niveles" className="mb-6 flex flex-wrap gap-3">
      {Object.entries(TAXONOMIES).map(([key, config]) => <Link className="btn-secondary" key={key} aria-current={key === table ? "page" : undefined} href={`${TAXONOMY_PATH}?tipo=${key}`}>{config.title}</Link>)}
    </nav>
    <p className="mb-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Los registros ya asociados a una temporada están protegidos por PostgreSQL: no pueden editarse ni desactivarse con la migración actual.</p>
    <TaxonomyFeedback key={table}><div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="panel-card min-w-0" aria-label={`Listado de ${TAXONOMIES[table].title.toLowerCase()}`}>
        <Form action={TAXONOMY_PATH} role="search" className="mb-5 flex flex-wrap items-end gap-3">
          <input type="hidden" name="tipo" value={table}/>
          <label className="form-label min-w-0 flex-1">Buscar por nombre o código<input className="input" name="q" type="search" maxLength={100} defaultValue={q}/></label>
          <label className="form-label">Estado<select className="input" name="estado" defaultValue={estado}><option value="todos">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select></label>
          <button type="submit" className="btn-primary">Buscar</button><Link className="btn-secondary" href={`${TAXONOMY_PATH}?tipo=${table}`}>Limpiar</Link>
        </Form>
        {listError ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No se pudo consultar el catálogo. Comprueba la conexión y los permisos de la migración 003. <Link className="font-semibold underline" href={href()}>Reintentar</Link></p>
          : records.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-slate-600">{q || estado !== "todos" ? "No hay registros para estos filtros." : "Todavía no hay registros. Registra los conceptos reales utilizando el formulario."}</p>
          : <><p className="mb-3 text-sm text-slate-500">{records.length} registros encontrados</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{TAXONOMIES[table].title}</caption>
            <thead><tr className="border-b text-slate-500"><th scope="col" className="p-3">Nombre / Código</th>{table === "categorias" && <th scope="col" className="p-3">Orden</th>}<th scope="col" className="p-3">Estado</th><th scope="col" className="p-3">Acciones</th></tr></thead>
            <tbody>{records.map(item => <tr key={item.id} className="border-b border-slate-100 align-top"><th scope="row" className="p-3 font-semibold">{item.nombre}<span className="block font-normal text-slate-500">{item.codigo} · #{item.id}</span></th>
              {table === "categorias" && <td className="p-3">{item.orden_presentacion ?? "Sin asignar"}</td>}
              <td className={`p-3 font-semibold ${item.activo ? "text-green-700" : "text-slate-500"}`}>{item.activo ? "Activo" : "Inactivo"}</td>
              <td className="space-y-2 p-3"><Link className="inline-block font-semibold text-brand underline" href={href({ editar: String(item.id) })}>Editar<span className="sr-only"> {item.nombre} #{item.id}</span></Link><TaxonomyStatusButton table={table} record={item}/></td>
            </tr>)}</tbody>
          </table></div></>}
      </section>
      {listError ? <section className="panel-card"><p role="alert" className="text-amber-900">El formulario no está disponible hasta que se pueda consultar el catálogo.</p></section>
        : editError ? <section className="panel-card"><p role="alert" className="text-amber-900">{editError}</p><Link className="btn-secondary mt-4" href={href()}>Volver al registro</Link></section>
        : <TaxonomyForm key={`${table}-${record?.id ?? "nuevo"}`} table={table} record={record} registeredCodes={allRecords.map(item => item.codigo)} cancelHref={href()}/>}
    </div></TaxonomyFeedback>
  </DashboardShell>;
}
