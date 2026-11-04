import Link from "next/link";
import Form from "next/form";
import { DashboardShell } from "@/components/dashboard-shell";
import { JudgeNavigation } from "@/components/judge-navigation";
import { HabilitationForm } from "@/components/habilitation-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";
import { PLAYER_COLUMNS, type PlayerRecord } from "@/lib/jugadores";
import type { Season, SeasonCategory, Rule, Concept } from "@/lib/temporadas-deportivas";
import { HABILITATIONS_PATH, HABILITATION_COLUMNS, HABILITATION_STATES, RESOLUTION_TYPES, filterHabilitationPlayers, eligibilityIssues, type Habilitation } from "@/lib/habilitaciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Habilitaciones deportivas · Juez General" };
const PAGE_SIZE = 25;

export default async function HabilitationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireRole("juez_general");
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  const q = (query.q ?? "").trim().slice(0, 100);
  const estado = ["sin_resolucion", ...Object.keys(HABILITATION_STATES)].includes(query.estado) ? query.estado : "todos";
  const tipo = Object.hasOwn(RESOLUTION_TYPES, query.tipo ?? "") ? query.tipo : "todos";
  const activo = ["activo", "inactivo"].includes(query.activo) ? query.activo : "todos";
  const cuenta = ["con", "sin"].includes(query.cuenta) ? query.cuenta : "todas";
  let seasons: Season[] = [], categories: SeasonCategory[] = [], rules: Rule[] = [], players: PlayerRecord[] = [], records: Habilitation[] = [], concepts: Concept[] = [], levels: Concept[] = [], clubs: { id: number; nombre: string }[] = [], locations: { id: number; nombre: string }[] = [];
  let failed = false;
  try {
    const db = await createClient();
    async function read<T>(table: string, columns: string, filters: Record<string, number> = {}): Promise<T[]> {
      const result: T[] = [];
      for (let offset = 0; ; offset += 500) {
        let request = db.from(table).select(columns).order("id");
        for (const [k, v] of Object.entries(filters)) request = request.eq(k, v);
        const { data, error } = await request.range(offset, offset + 499);
        if (error) throw new Error("Consulta no disponible");
        result.push(...(data ?? []) as T[]);
        if (!data || data.length < 500) return result;
      }
    }
    seasons = await read<Season>("temporadas", "id,nombre,anio");
    const season = validId(query.temporada ?? "") ? seasons.find(s => String(s.id) === query.temporada) : undefined;
    if (season) {
      [categories, rules, concepts, levels] = await Promise.all([
        read<SeasonCategory>("categorias_temporada", "id,temporada_id,categoria_id,nivel_id,codigo,rama,criterio_nacimiento,anio_nacimiento_desde,anio_nacimiento_hasta,reglamento_id,activo", { temporada_id: season.id }),
        read<Rule>("reglamentos_temporada", "id,temporada_id,version,titulo,estado_revision,referencia_aprobacion", { temporada_id: season.id }),
        read<Concept>("categorias", "id,nombre,activo"), read<Concept>("niveles", "id,nombre,activo"),
      ]);
      const category = validId(query.categoria ?? "") ? categories.find(ct => String(ct.id) === query.categoria) : undefined;
      if (category) [players, records, clubs, locations] = await Promise.all([
        read<PlayerRecord>("jugadores", PLAYER_COLUMNS),
        read<Habilitation>("habilitaciones_jugador_categoria", HABILITATION_COLUMNS, { categoria_temporada_id: category.id }),
        read<{ id: number; nombre: string }>("clubes", "id,nombre"), read<{ id: number; nombre: string }>("localidades", "id,nombre"),
      ]);
    }
  } catch { failed = true; }
  const season = seasons.find(s => String(s.id) === query.temporada);
  const category = categories.find(ct => String(ct.id) === query.categoria);
  const rule = rules.find(r => r.id === category?.reglamento_id) ?? null;
  const sportsCategory = category ? { ...category, catalogos_activos: !!concepts.find(x => x.id === category.categoria_id)?.activo && !!levels.find(x => x.id === category.nivel_id)?.activo } : null;
  const selected = validId(query.jugador ?? "") ? players.find(p => String(p.id) === query.jugador) : undefined;
  const byPlayer = new Map(records.map(h => [h.jugador_id, h]));
  const matches = filterHabilitationPlayers(players, records, { q, estado, tipo, activo, cuenta });
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const requested = validId(query.pagina ?? "") ? Number(query.pagina) : 1;
  const page = Math.min(requested, pages);
  const visible = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const href = (changes: Record<string, string> = {}) => `${HABILITATIONS_PATH}?${new URLSearchParams({ temporada: season ? String(season.id) : "", categoria: category ? String(category.id) : "", q, estado, tipo, activo, cuenta, pagina: String(page), ...changes })}`;
  const categoryLabel = (ct: SeasonCategory) => `${concepts.find(c => c.id === ct.categoria_id)?.nombre ?? ct.codigo} / ${levels.find(n => n.id === ct.nivel_id)?.nombre ?? "Nivel pendiente"} · ${ct.rama ?? "Rama pendiente"}${ct.activo ? "" : " · Inactiva"}`;
  const birth = (p: PlayerRecord) => p.fecha_nacimiento?.split("-").reverse().join("-") ?? "Desconocido";
  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    <JudgeNavigation current={HABILITATIONS_PATH}/><h2 className="text-2xl font-bold">Habilitaciones deportivas</h2>
    <p className="mb-5 mt-2 text-sm text-slate-600">Resoluciones por jugador, categoría individual y temporada. Una habilitación no constituye inscripción ni acredita por sí sola condición federativa.</p>
    <Form action={HABILITATIONS_PATH} className="panel-card mb-5 flex flex-wrap items-end gap-3"><label className="form-label">Temporada<select className="input" name="temporada" defaultValue={query.temporada ?? ""} required><option value="">Selecciona una temporada</option>{seasons.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.anio})</option>)}</select></label><button className="btn-primary">Consultar temporada</button></Form>
    {failed ? <p role="alert" className="panel-card">No se pudieron consultar jugadores y reglas. No se habilita el formulario hasta comprobar los datos. <Link className="underline" href={href()}>Reintentar</Link></p> : !season ? <p className="panel-card">{seasons.length ? "Selecciona una temporada existente." : "No hay temporadas disponibles."}</p> : <>
      <Form action={HABILITATIONS_PATH} className="panel-card mb-5 flex flex-wrap items-end gap-3"><input type="hidden" name="temporada" value={season.id}/><label className="form-label">Categoría individual<select className="input" name="categoria" defaultValue={query.categoria ?? ""} required><option value="">Selecciona una categoría</option>{categories.map(ct => <option key={ct.id} value={ct.id}>{categoryLabel(ct)}</option>)}</select></label><button className="btn-primary">Consultar categoría</button></Form>
      {!category ? <p className="panel-card">{categories.length ? "Selecciona una categoría válida de esta temporada." : "No hay categorías configuradas en esta temporada."}</p> : <>
        <section className="panel-card mb-5" aria-label="Reglas de elegibilidad"><h3 className="font-bold">{categoryLabel(category)}</h3><p>Nacimiento: {category.criterio_nacimiento === "rango_anios" ? `años ${category.anio_nacimiento_desde} a ${category.anio_nacimiento_hasta} (inclusive)` : category.criterio_nacimiento === "sin_limite" ? "Sin límite de nacimiento configurado" : "Criterio pendiente"}.</p><p>Reglamento: {rule ? `${rule.titulo} · ${rule.version} · ${rule.estado_revision}` : "Pendiente de asociar"}.</p><p className="mt-2 text-sm text-slate-600">La rama y la condición federativa deben revisarse documentalmente. No se deducen del nombre ni del club; el nacimiento se contrasta por año, sin inferir edades.</p></section>
        <Form action={HABILITATIONS_PATH} role="search" className="panel-card mb-5 flex flex-wrap items-end gap-3"><input type="hidden" name="temporada" value={season.id}/><input type="hidden" name="categoria" value={category.id}/><label className="form-label">Nombre o identificador<input className="input" name="q" type="search" maxLength={100} defaultValue={q}/></label>
          <label className="form-label">Resolución<select className="input" name="estado" defaultValue={estado}><option value="todos">Todas</option><option value="sin_resolucion">Sin resolución registrada</option>{Object.entries(HABILITATION_STATES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select></label>
          <label className="form-label">Tipo<select className="input" name="tipo" defaultValue={tipo}><option value="todos">Todos</option>{Object.entries(RESOLUTION_TYPES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select></label>
          <label className="form-label">Jugador<select className="input" name="activo" defaultValue={activo}><option value="todos">Todos</option><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label>
          <label className="form-label">Cuenta<select className="input" name="cuenta" defaultValue={cuenta}><option value="todas">Todas</option><option value="con">Con cuenta</option><option value="sin">Sin cuenta</option></select></label><button className="btn-primary">Filtrar</button><Link className="btn-secondary" href={href({ q: "", estado: "todos", tipo: "todos", activo: "todos", cuenta: "todas", pagina: "1" })}>Limpiar</Link>
        </Form>
        <section className="panel-card mb-5 overflow-x-auto" aria-label="Jugadores registrados"><h3 className="mb-3 font-bold">Jugadores ({matches.length})</h3>{!matches.length ? <p>{players.length ? "No hay jugadores para estos filtros." : "No hay jugadores registrados. Administración debe registrarlos."}</p> : <table className="w-full text-left text-sm"><thead><tr><th className="p-3" scope="col">Jugador</th><th className="p-3" scope="col">Antecedentes</th><th className="p-3" scope="col">Resolución guardada</th><th className="p-3" scope="col">Revisión</th></tr></thead><tbody>{visible.map(p => {
          const h = byPlayer.get(p.id), issues = eligibilityIssues(p, sportsCategory!, rule, h?.tipo_resolucion === "excepcion_documentada");
          return <tr key={p.id} className="border-t align-top"><th className="p-3" scope="row">{p.nombre_completo}<span className="block font-normal">Jugador #{p.id} · {p.activo ? "Activo" : "Inactivo"}</span></th><td className="p-3">Nacimiento: {birth(p)}<p>{p.perfil_id ? "Con cuenta vinculada" : "Sin cuenta vinculada"}</p></td><td className="p-3">{h ? <><strong>{HABILITATION_STATES[h.estado]}</strong><p>{RESOLUTION_TYPES[h.tipo_resolucion]}</p><p>{h.motivo ?? "Pendiente de revisar antecedentes."}</p></> : "Sin resolución registrada"}</td><td className="p-3">{issues.length > 0 && <p className="mb-2 text-amber-900">Revisión vigente: {issues.join(" ")}</p>}<Link className="font-semibold text-brand underline" href={`${href({ jugador: String(p.id) })}#habilitation-form`}>Revisar jugador #{p.id}</Link></td></tr>;
        })}</tbody></table>}<nav className="mt-4 flex flex-wrap items-center gap-3" aria-label="Páginas de jugadores"><span>Página {page} de {pages}</span>{page > 1 && <Link className="btn-secondary" href={href({ pagina: String(page - 1) })}>Anterior</Link>}{page < pages && <Link className="btn-secondary" href={href({ pagina: String(page + 1) })}>Siguiente</Link>}</nav></section>
        {query.jugador && !selected && <p role="alert" className="panel-card">El jugador seleccionado no está disponible.</p>}
        {selected && sportsCategory && <section className="space-y-4"><div className="panel-card"><h3 className="text-xl font-bold">{selected.nombre_completo} · Jugador #{selected.id}</h3><p>Nacimiento registrado: {birth(selected)} · {selected.perfil_id ? "Con cuenta vinculada" : "Sin cuenta vinculada"}.</p><p>Club: {clubs.find(x => x.id === selected.club_id)?.nombre ?? (selected.club_id ? `#${selected.club_id}` : "No registrado")} · Procedencia: {locations.find(x => x.id === selected.localidad_procedencia_id)?.nombre ?? (selected.localidad_procedencia_id ? `#${selected.localidad_procedencia_id}` : "No registrada")}.</p><h4 className="mt-3 font-semibold">Comprobaciones de habilitación ordinaria</h4>{eligibilityIssues(selected, sportsCategory, rule).length ? <ul className="list-inside list-disc text-sm text-amber-900">{eligibilityIssues(selected, sportsCategory, rule).map(reason => <li key={reason}>{reason}</li>)}</ul> : <p>Datos básicos compatibles; aún requiere revisión documental y resolución explícita del Juez.</p>}<p className="mt-3 text-sm">Una excepción documentada permite revisar un nacimiento desconocido o fuera de rango. No omite jugador activo, categoría, rama ni reglamento validados.</p><p className="text-sm">Motivo guardado: {byPlayer.get(selected.id)?.motivo ?? "Sin motivo registrado; antecedentes pendientes de revisión."}</p><p className="text-sm">Referencia guardada: {byPlayer.get(selected.id)?.referencia_evidencia ?? "No registrada"}.</p></div><HabilitationForm key={`${season.id}-${category.id}-${selected.id}`} seasonId={season.id} categoryId={category.id} playerId={selected.id} record={byPlayer.get(selected.id) ?? null} refreshHref={href({ jugador: String(selected.id) })}/></section>}
      </>}
    </>}
  </DashboardShell>;
}
