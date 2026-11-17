import Link from "next/link";
import Form from "next/form";
import { DashboardShell } from "@/components/dashboard-shell";
import { PlayerImport } from "@/components/player-import";
import { PlayerForm, PlayerStatusButton } from "@/components/player-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCatalogOptions, getProfileOptions } from "@/lib/admin-options";
import { validId, type CatalogOption } from "@/lib/catalogos";
import { PLAYERS_PATH, PLAYER_COLUMNS, todayInChile, type PlayerRecord } from "@/lib/jugadores";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gestión de jugadores" };
const PAGE_SIZE = 25;

export default async function PlayersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireRole("administrador");
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === "string" ? value : ""]));
  const q = (query.q ?? "").trim().slice(0, 100);
  const estado = ["activo", "inactivo"].includes(query.estado) ? query.estado : "todos";
  const cuenta = ["con", "sin"].includes(query.cuenta) ? query.cuenta : "todas";
  const localidad = validId(query.localidad ?? "") ? query.localidad : "";
  const club = validId(query.club ?? "") ? query.club : "";
  const requestedPage = Number(query.pagina ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1000000 ? requestedPage : 1;
  function href(changes: Record<string, string> = {}) {
    return `${PLAYERS_PATH}?${new URLSearchParams({ q, estado, cuenta, localidad, club, pagina: String(page), ...changes })}`;
  }
  const [localidades, clubes, perfiles] = await Promise.all([getCatalogOptions("localidades"), getCatalogOptions("clubes"), getProfileOptions()]);
  const optionsError = localidades.error || clubes.error || perfiles.error;
  let records: PlayerRecord[] = [];
  let count = 0;
  let listError = false;
  let record: PlayerRecord | null = null;
  let editError = "";
  try {
    const supabase = await createClient();
    let request = supabase.from("jugadores").select(PLAYER_COLUMNS, { count: "exact" });
    if (q) request = request.ilike("nombre_completo", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
    if (estado !== "todos") request = request.eq("activo", estado === "activo");
    if (localidad) request = request.eq("localidad_procedencia_id", localidad);
    if (club) request = request.eq("club_id", club);
    if (cuenta === "con") request = request.not("perfil_id", "is", null);
    if (cuenta === "sin") request = request.is("perfil_id", null);
    const result = await request.order("nombre_completo").order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    listError = !!result.error;
    if (!listError) { records = result.data ?? []; count = result.count ?? 0; }
    if (query.editar) {
      if (!validId(query.editar)) editError = "El identificador del jugador no es válido.";
      else {
        const result = await supabase.from("jugadores").select(PLAYER_COLUMNS).eq("id", query.editar).maybeSingle();
        if (result.error) editError = "No se pudieron consultar los datos del jugador para editar.";
        else if (!result.data) editError = "El jugador no existe o no está disponible para tu sesión.";
        else record = result.data;
      }
    }
  } catch {
    listError = true;
    if (query.editar) editError = "No se pudo cargar el jugador para editar. Comprueba la conexión.";
  }
  const localityNames = new Map(localidades.data.map(item => [item.id, item.nombre]));
  const clubNames = new Map(clubes.data.map(item => [item.id, item.nombre]));
  const relation = (id: number | null, names: Map<number, string>) => id === null ? "Sin asignar" : names.get(id) ?? `#${id} (nombre no disponible)`;
  const optionItems = (options: CatalogOption[]) => options.map(item => <option key={item.id} value={item.id}>{item.nombre} · #{item.id}{item.activo ? "" : " (inactivo)"}</option>);
  const filtered = !!(q || localidad || club || estado !== "todos" || cuenta !== "todas");

  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    
    <h2 className="mb-3 text-2xl font-bold">Gestión de jugadores</h2>
    <p className="mb-5 text-sm text-slate-600">Registro deportivo privado. Identifica a cada persona por su ID, no solo por su nombre.</p>
    <div className="mb-5 flex flex-wrap gap-3"><Link className="btn-primary" href={href({ importar: "si" })}>Importar Excel</Link><Link className="btn-secondary" href={href({ agregar: "si" })}>Agregar jugador</Link></div>
    {query.importar === "si" && <div className="mb-6"><PlayerImport/><Link className="btn-secondary mt-3" href={href()}>Cerrar importación</Link></div>}
    <div className="grid items-start gap-6">
      <section className="panel-card min-w-0" aria-label="Listado de jugadores">
        <Form action={PLAYERS_PATH} role="search" className="mb-6 grid gap-3 sm:grid-cols-2">
          <label className="form-label">Buscar por nombre<input className="input" type="search" name="q" maxLength={100} defaultValue={q}/></label>
          <label className="form-label">Estado<select className="input" name="estado" defaultValue={estado}><option value="todos">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select></label>
          <details className="sm:col-span-2" open={!!(localidad || club || cuenta !== "todas")}><summary className="cursor-pointer font-semibold">Filtros avanzados</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="form-label">Localidad<select className="input" name="localidad" defaultValue={localidad} disabled={localidades.error}><option value="">Todas</option>{optionItems(localidades.data)}</select></label>
          <label className="form-label">Club<select className="input" name="club" defaultValue={club} disabled={clubes.error}><option value="">Todos</option>{optionItems(clubes.data)}</select></label>
          <label className="form-label">Cuenta de usuario<select className="input" name="cuenta" defaultValue={cuenta}><option value="todas">Todas</option><option value="con">Con cuenta vinculada</option><option value="sin">Sin cuenta vinculada</option></select></label>
          </div></details><div className="flex flex-wrap items-end gap-3"><button type="submit" className="btn-primary">Buscar</button><Link href={PLAYERS_PATH} className="btn-secondary">Limpiar</Link></div>
        </Form>
        {optionsError && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">No se pudieron cargar todas las opciones de localidades, clubes o cuentas. El formulario está temporalmente bloqueado para proteger las relaciones existentes.</p>}
        {listError ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No se pudo consultar el listado. Comprueba la conexión y los permisos de Supabase. <Link href={href()} className="font-semibold underline">Reintentar</Link></p>
          : records.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-slate-600">{filtered ? "No hay jugadores para estos filtros." : page > 1 ? "No hay jugadores en esta página." : "Todavía no hay jugadores registrados. Registra el primero con sus datos reales."}</p>
          : <><p className="mb-3 text-sm text-slate-500">{count} jugadores encontrados · Página {page}</p><div className="min-w-0">
            <table className="block w-full table-fixed text-left text-sm md:table"><caption className="sr-only">Jugadores registrados</caption>
              <thead className="hidden md:table-header-group"><tr className="border-b text-slate-500"><th scope="col" className="p-3">Jugador</th><th scope="col" className="p-3">Nacimiento</th><th scope="col" className="p-3">Procedencia / Club</th><th scope="col" className="p-3">Estado / Cuenta</th><th scope="col" className="p-3">Acciones</th></tr></thead>
              <tbody className="block md:table-row-group">{records.map(item => <tr key={item.id} className="block border-b border-slate-100 align-top md:table-row">
                <th scope="row" className="block break-words p-3 font-semibold md:table-cell">{item.nombre_completo}<span className="block font-normal text-slate-500">#{item.id}</span></th>
                <td className="block p-3 md:table-cell">{item.fecha_nacimiento ? item.fecha_nacimiento.split("-").reverse().join("/") : "Sin informar"}</td>
                <td className="block break-words p-3 md:table-cell">{relation(item.localidad_procedencia_id, localityNames)}<br/>{relation(item.club_id, clubNames)}</td>
                <td className="block break-words p-3 md:table-cell"><span className={item.activo ? "font-semibold text-green-700" : "text-slate-500"}>{item.activo ? "Activo" : "Inactivo"}</span><span className="mt-1 block text-xs text-slate-600">{item.perfil_id ? "Cuenta vinculada" : "Sin cuenta"}</span></td>
                <td className="block space-y-2 p-3 md:table-cell"><Link className="inline-block font-semibold text-brand underline" href={href({ editar: String(item.id) })}>Editar<span className="sr-only"> jugador #{item.id}</span></Link><PlayerStatusButton record={item}/></td>
              </tr>)}</tbody>
            </table></div></>}
        {!listError && (page > 1 || count > page * PAGE_SIZE) && <nav aria-label="Paginación de jugadores" className="mt-5 flex flex-wrap gap-3">
          {page > 1 && <Link href={href({ pagina: String(page - 1) })} className="btn-secondary">Anterior</Link>}
          {count > page * PAGE_SIZE && <Link href={href({ pagina: String(page + 1) })} className="btn-secondary">Siguiente</Link>}
        </nav>}
      </section>
      {(query.agregar === "si" || query.editar) && (editError ? <section className="panel-card"><p role="alert" className="text-amber-900">{editError}</p><Link href={href()} className="btn-secondary mt-4">Volver al registro</Link></section>
        : optionsError ? <section className="panel-card"><p role="alert">No se pueden cargar las opciones del formulario.</p><Link href={href(query.editar ? { editar: query.editar } : {})} className="btn-secondary mt-4">Reintentar</Link></section>
        : <PlayerForm key={record?.id ?? "nuevo"} record={record} localidades={localidades.data} clubes={clubes.data} perfiles={perfiles.data} today={todayInChile()} cancelHref={href()}/>)}
    </div>
  </DashboardShell>;
}
