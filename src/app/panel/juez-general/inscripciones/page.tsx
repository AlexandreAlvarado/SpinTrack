import Link from "next/link";
import Form from "next/form";
import { DashboardShell } from "@/components/dashboard-shell";
import { JudgeNavigation } from "@/components/judge-navigation";
import { RegistrationDecisionForm, RegistrationRefresh } from "@/components/registration-decision-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";
import { COMPETITION_COLUMNS, displayLeagueTime as formatLeagueTime, type Competition, type CompetitionDate, type SportsControl } from "@/lib/competencias";
import { PLAYER_COLUMNS, type PlayerRecord } from "@/lib/jugadores";
import { HABILITATION_COLUMNS, eligibilityIssues, type Habilitation } from "@/lib/habilitaciones";
import type { Season, SeasonCategory, Rule } from "@/lib/temporadas-deportivas";
import { REGISTRATIONS_PATH as PATH, REGISTRATION_COLUMNS, HISTORY_COLUMNS, sportsEvidence, REGISTRATION_STATES, type Registration, type RegistrationHistory } from "@/lib/inscripciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resolución de inscripciones · Juez General" };

function displayLeagueTime(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? formatLeagueTime(value) : "No disponible";
}

export default async function RegistrationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireRole("juez_general");
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([k,v]) => [k, typeof v === "string" ? v : ""]));
  const q = (query.q ?? "").trim().slice(0,100);
  const estado = Object.hasOwn(REGISTRATION_STATES, query.estado ?? "") ? query.estado : "todos";
  let seasons: Season[] = [], dates: CompetitionDate[] = [], competitions: Competition[] = [], categories: SeasonCategory[] = [], registrations: Registration[] = [], players: PlayerRecord[] = [], clubs: { id: number; nombre: string }[] = [], history: RegistrationHistory[] = [], habilitations: Habilitation[] = [], rules: Rule[] = [], concepts: { id: number; activo: boolean }[] = [], levels: { id: number; activo: boolean }[] = [], controls: SportsControl[] = [], other: Registration[] = [];
  let failed = false;
  try {
    const db = await createClient();
    async function read<T>(table: string, columns: string, filters: Record<string, number> = {}, order = "id"): Promise<T[]> {
      const rows: T[] = [];
      for (let offset = 0; ; offset += 500) {
        let request = db.from(table).select(columns).order(order);
        for (const [key,value] of Object.entries(filters)) request = request.eq(key,value);
        const result = await request.range(offset,offset+499);
        if (result.error || !Array.isArray(result.data)) throw new Error("Consulta incompleta");
        rows.push(...result.data as T[]);
        if (result.data.length < 500) return rows;
      }
    }
    seasons = await read("temporadas", "id,nombre,anio");
    const season = seasons.find(s => String(s.id) === query.temporada);
    if (season) {
      [dates,categories] = await Promise.all([read<CompetitionDate>("fechas","id,temporada_id,numero,fecha,comuna,recinto,estado",{ temporada_id: season.id }),read<SeasonCategory>("categorias_temporada","id,temporada_id,categoria_id,nivel_id,codigo,rama,criterio_nacimiento,anio_nacimiento_desde,anio_nacimiento_hasta,reglamento_id,activo",{ temporada_id: season.id })]);
      const day = dates.find(d => String(d.id) === query.jornada);
      if (day) competitions = await read("competencias",COMPETITION_COLUMNS,{ temporada_id: season.id, fecha_id: day.id });
      const competition = competitions.find(c => String(c.id) === query.competencia);
      if (competition) {
        [registrations,controls] = await Promise.all([read<Registration>("inscripciones",REGISTRATION_COLUMNS,{ competencia_id: competition.id }),read<SportsControl>("competencia_control_deportivo","competencia_id,configuracion_aprobada,estado_deportivo,inicio_programado,minimo_participantes",{ competencia_id: competition.id },"competencia_id")]);
        if (registrations.length) [players,clubs] = await Promise.all([read<PlayerRecord>("jugadores",PLAYER_COLUMNS),read<{id:number;nombre:string}>("clubes","id,nombre")]);
        const selected = registrations.find(r => String(r.id) === query.solicitud);
        if (selected) {
          [history,habilitations,rules,concepts,levels,other] = await Promise.all([
            read<RegistrationHistory>("inscripciones_historial",HISTORY_COLUMNS,{ inscripcion_id: selected.id }),
            read<Habilitation>("habilitaciones_jugador_categoria",HABILITATION_COLUMNS,{ jugador_id: selected.jugador_id, categoria_temporada_id: competition.categoria_temporada_id }),
            read<Rule>("reglamentos_temporada","id,temporada_id,version,titulo,estado_revision,referencia_aprobacion",{ temporada_id: season.id }),
            read<{id:number;activo:boolean}>("categorias","id,activo"),read<{id:number;activo:boolean}>("niveles","id,activo"),
            read<Registration>("inscripciones",REGISTRATION_COLUMNS,{ jugador_id: selected.jugador_id }),
          ]);
        }
      }
    }
  } catch { failed = true; }
  const season = seasons.find(s => String(s.id) === query.temporada), day = dates.find(d => String(d.id) === query.jornada), competition = competitions.find(c => String(c.id) === query.competencia);
  const category = categories.find(c => c.id === competition?.categoria_temporada_id), control = controls[0];
  const selected = registrations.find(r => String(r.id) === query.solicitud), player = players.find(p => p.id === selected?.jugador_id), habilitation = habilitations[0];
  const href = (changes: Record<string,string> = {}) => `${PATH}?${new URLSearchParams({ temporada: query.temporada ?? "", jornada: query.jornada ?? "", competencia: query.competencia ?? "", q, estado, ...changes })}`;
  const matches = registrations.filter(r => (estado === "todos" || r.estado === estado) && (!q || `${players.find(p => p.id === r.jugador_id)?.nombre_completo ?? ""} #${r.jugador_id}`.toLocaleLowerCase("es").includes(q.toLocaleLowerCase("es"))));
  const pages = Math.max(1,Math.ceil(matches.length/25)), page = Math.min(pages,validId(query.pagina ?? "") ? Number(query.pagina) : 1);
  const issues = player && category ? eligibilityIssues(player, { ...category, catalogos_activos: !!concepts.find(c => c.id === category.categoria_id)?.activo && !!levels.find(l => l.id === category.nivel_id)?.activo },rules.find(r => r.id === category.reglamento_id) ?? null,habilitation?.tipo_resolucion === "excepcion_documentada") : ["No están disponibles el jugador o la categoría vigente."];
  return <DashboardShell role={profile.rol} nombre={profile.nombre}><JudgeNavigation current={PATH}/><h2 className="mb-4 text-2xl font-bold">Resolución de inscripciones</h2>
    <Form action={PATH} className="panel-card mb-4 flex flex-wrap gap-3"><label className="form-label">Temporada<select name="temporada" className="input" defaultValue={query.temporada ?? ""} required><option value="">Selecciona</option>{seasons.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label><button className="btn-primary">Consultar temporada</button></Form>
    {failed ? <p role="alert" className="panel-card">No se pudieron comprobar todos los datos. Resoluciones deshabilitadas. <Link href={href()} className="underline">Reintentar</Link></p> : <>
      {!season ? <p>Selecciona una temporada disponible.</p> : <Form action={PATH} className="panel-card mb-4 flex gap-3"><input type="hidden" name="temporada" value={season.id}/><label className="form-label">Jornada<select className="input" name="jornada" defaultValue={query.jornada ?? ""} required><option value="">Selecciona</option>{dates.map(d => <option key={d.id} value={d.id}>Jornada {d.numero} · {d.fecha} · {d.recinto}</option>)}</select></label><button className="btn-primary">Consultar jornada</button></Form>}
      {season && day && <Form action={PATH} className="panel-card mb-4 flex gap-3"><input type="hidden" name="temporada" value={season.id}/><input type="hidden" name="jornada" value={day.id}/><label className="form-label">Competencia individual<select className="input" name="competencia" defaultValue={query.competencia ?? ""} required><option value="">Selecciona</option>{competitions.map(c => <option key={c.id} value={c.id}>{categories.find(ct => ct.id === c.categoria_temporada_id)?.codigo ?? "Categoría no disponible"} · #{c.id}</option>)}</select></label><button className="btn-primary">Consultar competencia</button></Form>}
      {day && !competitions.length && <p>No hay competencias individuales disponibles en esta jornada.</p>}
      {competition && <>
        <section className="panel-card mb-4"><h3 className="font-bold">{category?.codigo ?? "Categoría no disponible"}</h3><p>Estado deportivo: {control?.estado_deportivo ?? "Sin preparación"} · Inicio: {displayLeagueTime(control?.inicio_programado ?? null)}</p>
          {(!control?.configuracion_aprobada || control.estado_deportivo !== "preparada") && <p role="status">La competencia aún no está preparada o ya cambió su estado deportivo. La RPC comprobará si es posible aceptar.</p>}
          {(!competition.activo || !competition.publicada || day?.estado !== "publicada" ) && <p>Condiciones administrativas incompletas para aceptar participantes.</p>}
          {competition.tarifa_clp === null && <p role="status">La base de datos conserva un requisito heredado pendiente de actualización del esquema; no permite nuevas solicitudes ni aceptaciones para esta competencia.</p>}
          <p>Nuevas inscripciones: {competition.inscripciones_habilitadas ? "habilitadas" : "deshabilitadas"}. Apertura: {displayLeagueTime(competition.inscripcion_abre_en)} · Cierre: {displayLeagueTime(competition.inscripcion_cierra_en)} (America/Santiago).</p><p>El cierre de nuevas solicitudes no impide resolver pendientes presentadas a tiempo. La aceptación requiere elegibilidad vigente e inicio deportivo futuro.</p>
          <p>Pendientes: {registrations.filter(r => r.estado === "pendiente").length} · Participantes aceptados: {registrations.filter(r => r.estado === "aceptada").length}</p><Link className="underline mr-4" href={href({estado:"pendiente"})}>Ver pendientes</Link><Link className="underline" href={href({estado:"aceptada"})}>Ver participantes aceptados</Link>
        </section>
        <Form action={PATH} className="panel-card mb-4 flex flex-wrap gap-3" role="search">{["temporada","jornada","competencia"].map(k => <input key={k} type="hidden" name={k} value={query[k]}/>)}<label className="form-label">Jugador o ID<input name="q" type="search" maxLength={100} className="input" defaultValue={q}/></label><label className="form-label">Estado<select className="input" name="estado" defaultValue={estado}><option value="todos">Todos</option>{Object.entries(REGISTRATION_STATES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label><button className="btn-primary">Filtrar</button></Form>
        <div className="panel-card overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable horizontalmente"><table className="w-full text-left text-sm"><thead><tr>{["Jugador","Categoría","Club","Solicitud (America/Santiago)","Estado","Revisión"].map(label => <th className="p-2" key={label} scope="col">{label}</th>)}</tr></thead><tbody>{matches.slice((page-1)*25,page*25).map(r => { const p = players.find(p => p.id === r.jugador_id); return <tr key={r.id} className="border-t"><td className="p-2">{p?.nombre_completo ?? "Jugador no disponible"} · #{r.jugador_id}</td><td>{category?.codigo ?? "No disponible"}</td><td>{clubs.find(c => c.id === p?.club_id)?.nombre ?? "No registrado"}</td><td>{displayLeagueTime(r.creado_en)}</td><td>{REGISTRATION_STATES[r.estado]}</td><td><Link className="underline" href={href({ solicitud:String(r.id) })}>Revisar #{r.id}</Link></td></tr>; })}</tbody></table>{!matches.length && <p>No hay solicitudes para esta selección y filtros.</p>}<nav aria-label="Páginas de solicitudes" className="flex gap-3 mt-3"><span>Página {page} de {pages}</span>{page > 1 && <Link href={href({pagina:String(page-1)})}>Anterior</Link>}{page < pages && <Link href={href({pagina:String(page+1)})}>Siguiente</Link>}</nav></div>
        {query.solicitud && !selected && <p role="alert">La solicitud no pertenece a esta competencia o no está disponible.</p>}
        {selected && <section className="mt-5 space-y-4"><div className="panel-card"><h3 className="font-bold">Antecedentes de {player?.nombre_completo ?? `jugador #${selected.jugador_id}`}</h3><p>Nacimiento: {player?.fecha_nacimiento ?? "Desconocido"} · {player?.activo ? "Activo" : "Actividad no confirmada"}</p><p>Habilitación vigente: {habilitation?.estado ?? "Sin resolución"} · {habilitation?.tipo_resolucion ?? "Sin tipo"}</p><p>Motivo: {habilitation?.motivo ?? "No registrado"} · Referencia: {habilitation?.referencia_evidencia ?? "No registrada"}</p><p>Validación: {displayLeagueTime(habilitation?.validado_en ?? null)}</p><p>Regla: {category?.criterio_nacimiento} · Rango inclusivo: {category?.anio_nacimiento_desde ?? "—"} a {category?.anio_nacimiento_hasta ?? "—"} · Rama: {category?.rama ?? "Pendiente"}</p>{issues.map(issue => <p key={issue}>{issue}</p>)}<p>Revisar documentalmente condición federativa y combinaciones deportivas. Los datos básicos compatibles no conceden admisión automática.</p><h4 className="font-bold mt-3">Otras solicitudes de la misma jornada</h4>{other.filter(r => r.id !== selected.id && competitions.some(c => c.id === r.competencia_id)).map(r => <p key={r.id}>{categories.find(ct => ct.id === competitions.find(c => c.id === r.competencia_id)?.categoria_temporada_id)?.codigo ?? `Competencia #${r.competencia_id}`} · {REGISTRATION_STATES[r.estado]}</p>)}<details><summary>Resumen deportivo conservado en la solicitud</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(sportsEvidence(selected.antecedentes),null,2)}</pre></details></div>
          <section className="panel-card"><h3 className="font-bold">Historial de decisiones (privado para operadores)</h3>{!history.length && <p role="alert">No se encontró historial. Recarga antes de resolver.</p>}{history.map(h => <article className="border-t py-3" key={h.id}><p>{h.estado_anterior ?? "Solicitud inicial"} → {h.estado_nuevo} · {displayLeagueTime(h.ocurrido_en)} · Actor: {h.actor}</p><p>Motivo: {h.motivo ?? "Sin resolución inicial"}</p><p>Referencia: {h.referencia_resolucion ?? "No registrada"}</p><details><summary>Respaldo deportivo de este evento</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(sportsEvidence(h.antecedentes),null,2)}</pre></details></article>)}</section>
          {selected.estado === "pendiente" && player && category && history.length > 0 && <RegistrationDecisionForm key={selected.id} id={selected.id} competition={competition.id} canAccept={competition.tarifa_clp !== null}/>}
          <RegistrationRefresh/>
        </section>}
      </>}
    </>}
  </DashboardShell>;
}
