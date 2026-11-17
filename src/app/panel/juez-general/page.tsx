import { matchSummary } from "@/lib/gestion-partidos";
import type { MatchResult, ResultEvent } from "@/lib/resultados";
import Link from "next/link";
import { JudgeContextSelector } from "@/components/judge-context-selector";
import { JudgeNavigation } from "@/components/judge-navigation";
import { JUDGE_PATH } from "@/lib/preparacion-deportiva";
import { HABILITATIONS_PATH } from "@/lib/habilitaciones";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { COMPETITION_COLUMNS, type Competition, type CompetitionDate, type SportsControl } from "@/lib/competencias";
import type { Season, SeasonCategory, Concept } from "@/lib/temporadas-deportivas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi panel · Juez General" };

type HabilitationRow = { jugador_id: number; categoria_temporada_id: number; estado: string };
type ParticipantRow = { jugador_id: number; competencia_id: number };

export default async function JudgePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireRole("juez_general");
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === "string" ? value : ""]));
  let seasons: Season[] = [], dates: CompetitionDate[] = [], competitions: Competition[] = [], controls: SportsControl[] = [], categories: SeasonCategory[] = [], concepts: Concept[] = [], levels: Concept[] = [], habilitations: HabilitationRow[] = [], participants: ParticipantRow[] = [];
  let groups: { id: number; competencia_id: number; estado: string }[] = [];
  let lots: { id: number; competencia_id: number; estado: string }[] = [];
  let matchState: ReturnType<typeof matchSummary> | undefined;
  let failed = false;
  try {
    const db = await createClient();
    const read = async <T,>(table: string, columns: string, filters: Record<string, number> = {}) => {
      const result: T[] = [];
      for (let offset = 0;; offset += 500) {
        let request = db.from(table).select(columns).order(table === "competencia_control_deportivo" ? "competencia_id" : "id");
        for (const [key, value] of Object.entries(filters)) request = request.eq(key, value);
        const response = await request.range(offset, offset + 499);
        if (response.error) throw new Error("Consulta no disponible");
        result.push(...(response.data as T[]));
        if (response.data.length < 500) return result;
      }
    };
    seasons = await read<Season>("temporadas", "id,nombre,anio");
    const requestedSeason = seasons.find(item => String(item.id) === query.temporada);
    const season = requestedSeason ?? (seasons.length === 1 ? seasons[0] : undefined);
    if (season) {
      dates = await read<CompetitionDate>("fechas", "id,temporada_id,numero,fecha,comuna,recinto,estado", { temporada_id: season.id });
      const requestedDate = dates.find(item => String(item.id) === (query.fecha || query.jornada));
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
      const date = requestedDate ?? dates.filter(item => item.estado === "publicada" && item.fecha >= today).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
      if (date) {
        competitions = await read<Competition>("competencias", COMPETITION_COLUMNS, { temporada_id: season.id, fecha_id: date.id });
        [groups, lots] = await Promise.all([
          read<typeof groups[number]>("grupos_competencia", "id,competencia_id,estado"),
          read<typeof lots[number]>("lotes_partidos_grupos", "id,competencia_id,estado"),
        ]);
        [controls, categories, concepts, levels, habilitations, participants] = await Promise.all([
          read<SportsControl>("competencia_control_deportivo", "competencia_id,configuracion_aprobada,estado_deportivo,inicio_programado,minimo_participantes", { temporada_id: season.id }),
          read<SeasonCategory>("categorias_temporada", "id,temporada_id,categoria_id,nivel_id,codigo,rama,criterio_nacimiento,anio_nacimiento_desde,anio_nacimiento_hasta,reglamento_id,activo", { temporada_id: season.id }),
          read<Concept>("categorias", "id,codigo,nombre,activo"), read<Concept>("niveles", "id,codigo,nombre,activo"),
          read<HabilitationRow>("habilitaciones_jugador_categoria", "jugador_id,categoria_temporada_id,estado"),
          read<ParticipantRow>("participantes_competencia", "jugador_id,competencia_id"),
        ]);
        const selectedCompetition = competitions.find(c => String(c.id) === query.competencia);
        const selectedLot = lots.find(l => l.competencia_id === selectedCompetition?.id && l.estado === "confirmado");
        if (selectedCompetition && selectedLot) {
          const matches = (await read<{ id: number; lote_id: number }>("partidos", "id,lote_id", { competencia_id: selectedCompetition.id })).filter(m => m.lote_id === selectedLot.id);
          const ids = matches.map(m => m.id);
          const readRelated = async <T,>(table: string, columns: string, key: string, ids: number[], order = "id") => {
            const rows: T[] = [];
            for (let start = 0; start < ids.length; start += 100) {
              for (let offset = 0;; offset += 500) {
                const response = await db.from(table).select(columns).in(key, ids.slice(start, start + 100)).order(order).range(offset, offset + 499);
                if (response.error) throw new Error("Consulta no disponible");
                rows.push(...response.data as T[]);
                if (response.data.length < 500) break;
              }
            }
            return rows;
          };
          const [results, assignments] = await Promise.all([
            readRelated<MatchResult>("resultados_partidos", "id,partido_id,revision", "partido_id", ids),
            readRelated<{ partido_id: number; arbitro_id: string | null; activo: boolean }>("partidos_arbitros", "partido_id,arbitro_id,activo", "partido_id", ids, "partido_id"),
          ]);
          const [events, observations] = await Promise.all([
            readRelated<ResultEvent>("resultados_partidos_eventos", "id,resultado_id", "resultado_id", results.map(r => r.id)),
            readRelated<{ resultado_id: number }>("resultados_partidos_observaciones", "id,resultado_id", "resultado_id", results.map(r => r.id)),
          ]);
          matchState = matchSummary(matches, results, events, observations, assignments);
        }
      }
    }
  } catch { failed = true; }

  const season = seasons.find(item => String(item.id) === query.temporada) ?? (seasons.length === 1 ? seasons[0] : undefined);
  const requestedDate = dates.find(item => String(item.id) === (query.fecha || query.jornada));
  const date = requestedDate ?? dates.filter(item => item.estado === "publicada" && item.fecha >= new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date())).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  const categoryLabel = (competition: Competition) => {
    const category = categories.find(item => item.id === competition.categoria_temporada_id);
    return category ? `${concepts.find(item => item.id === category.categoria_id)?.nombre ?? category.codigo} · ${levels.find(item => item.id === category.nivel_id)?.nombre ?? "Nivel pendiente"}` : `Competencia #${competition.id}`;
  };
  const context = (extra: Record<string, string> = {}) => new URLSearchParams({ ...(season ? { temporada: String(season.id) } : {}), ...(date ? { fecha: String(date.id) } : {}), ...extra }).toString();
  const controlFor = (id: number) => controls.find(item => item.competencia_id === id);
  const participantCount = (id: number) => participants.filter(item => item.competencia_id === id).length;
  const readiness = (competition: Competition) => {
    const control = controlFor(competition.id);
    const category = categories.find(item => item.id === competition.categoria_temporada_id);
    const records = habilitations.filter(item => item.categoria_temporada_id === competition.categoria_temporada_id);
    if (control && ["suspendida", "cancelada", "finalizada"].includes(control.estado_deportivo)) return { label: "Consultar estado deportivo", href: `${JUDGE_PATH}?${context({ competencia: String(competition.id) })}` };
    if (!control?.configuracion_aprobada) return { label: "Preparación pendiente", href: `${JUDGE_PATH}?${context({ competencia: String(competition.id) })}` };
    if (!records.some(item => item.estado === "habilitado")) return { label: "Revisar habilitaciones", href: `${HABILITATIONS_PATH}?${context({ competencia: String(competition.id), categoria: String(category?.id ?? "") })}` };
    if (!participantCount(competition.id)) return { label: "Confirmar participantes", href: `/panel/juez-general/participantes?${context({ competencia: String(competition.id) })}` };
    const competitionGroups = groups.filter(item => item.competencia_id === competition.id);
    if (!competitionGroups.length || competitionGroups.some(item => item.estado !== "confirmado")) return { label: "Organizar y confirmar grupos", href: `/panel/juez-general/grupos?${context({ competencia: String(competition.id) })}` };
    const lot = lots.find(item => item.competencia_id === competition.id && item.estado !== "descartado");
    if (!lot || lot.estado !== "confirmado") return { label: lot ? "Revisar y confirmar cruces" : "Generar propuesta de partidos", href: `/panel/juez-general/partidos?${context({ competencia: String(competition.id) })}` };
    return { label: "Revisar asignaciones y resultados", href: `/panel/juez-general/partidos?${context({ competencia: String(competition.id) })}` };
  };

  const selected = competitions.find(item => String(item.id) === query.competencia);
  const selectedCategory = categories.find(item => item.id === selected?.categoria_temporada_id);
  const selectedControl = selected ? controlFor(selected.id) : undefined;
  const selectedRecords = selected ? habilitations.filter(item => item.categoria_temporada_id === selected.categoria_temporada_id) : [];
  const selectedGroups = selected ? groups.filter(item => item.competencia_id === selected.id) : [];
  const selectedLot = selected ? lots.find(item => item.competencia_id === selected.id && item.estado !== "descartado") : undefined;
  const preparationComplete = !!selectedControl?.configuracion_aprobada && selectedRecords.some(item => item.estado === "habilitado") && !!selected && participantCount(selected.id) > 0 && selectedGroups.length > 0 && selectedGroups.every(item => item.estado === "confirmado");
  const matchesComplete = !!selectedLot && selectedLot.estado === "confirmado";
  const managementPath = matchState?.complete ? "/panel/juez-general/clasificacion" : "/panel/juez-general/partidos";
  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    <JudgeNavigation current="/panel/juez-general" />
    <h2 className="text-2xl font-bold">Gestión de competencia</h2>
    <p className="mb-5 mt-2 text-sm text-slate-600">Selecciona el contexto una vez. El panel muestra únicamente el siguiente trabajo pendiente.</p>
    {failed && <p role="alert" className="panel-card mb-5">No se pudo cargar el estado desde Supabase. Las acciones quedan bloqueadas hasta recargar.</p>}
    <JudgeContextSelector seasons={seasons} dates={dates} competitions={competitions} categories={categories} concepts={concepts} levels={levels} seasonId={season?.id} dateId={date?.id} competitionId={selected?.id} />
    {season && date && <p className="mb-5 text-sm text-slate-600">{season.nombre} · Jornada {date.numero} · {date.fecha} · {date.estado}</p>}
    {!selected && !failed && <p className="panel-card">Selecciona una competencia para abrir su flujo guiado.</p>}
    {selected && !failed && <section className="panel-card" aria-label="Flujo de la competencia">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-bold">{categoryLabel(selected)}</h3><p className="text-sm text-slate-600">Competencia #{selected.id} · {participantCount(selected.id)} participantes confirmados</p></div>{!preparationComplete ? <Link className="btn-primary" href={readiness(selected).href}>{readiness(selected).label}</Link> : !matchesComplete ? <Link className="btn-primary" href={`/panel/juez-general/partidos?${context({ competencia: String(selected.id) })}`}>{selectedLot ? "Revisar y confirmar cruces" : "Generar propuesta de partidos"}</Link> : <Link className="btn-primary" href={`${managementPath}?${context({ competencia: String(selected.id) })}`}>{matchState?.action ?? "Gestionar partidos"}</Link>}</div>
      <ol className="mt-5 divide-y border-y">
        <li className="flex items-center justify-between gap-3 py-3"><span><strong>1. Preparar competencia</strong><small className="block text-slate-600">Preparación, habilitaciones, nómina y grupos</small></span><span className={preparationComplete ? "status-badge status-approved" : "status-badge status-pending"}>{preparationComplete ? "Completada" : "Pendiente"}</span></li>
        <li className="flex items-center justify-between gap-3 py-3"><span><strong>2. Gestionar partidos</strong><small className="block text-slate-600">Cruces, árbitros y resultados enviados</small></span><span className={matchState?.complete ? "status-badge status-approved" : "status-badge status-pending"}>{matchState?.complete ? "Resultados completos" : matchesComplete ? "Cruces confirmados · resultados pendientes" : "Pendiente"}</span></li>
        <li className="flex items-center justify-between gap-3 py-3"><span><strong>3. Clasificación y eliminatorias</strong><small className="block text-slate-600">Clasificación automática · Eliminatorias: próxima etapa</small></span><Link className="text-sm underline" href={`/panel/juez-general/clasificacion?${context({ competencia: String(selected.id) })}`}>Consultar</Link></li>
      </ol>
      <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold">Herramientas avanzadas</summary><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{[[JUDGE_PATH, "Preparación deportiva"], [HABILITATIONS_PATH, "Habilitaciones deportivas"], ["/panel/juez-general/participantes", "Participantes confirmados"], ["/panel/juez-general/grupos", "Organización de grupos"], ["/panel/juez-general/partidos", "Programación de partidos · Grupos"], ["/panel/juez-general/resultados", "Resultados por set"]].map(([path, title]) => <Link className="underline" key={path} href={`${path}?${context({ competencia: String(selected.id), categoria: String(selectedCategory?.id ?? "") })}`}>{title}</Link>)}</div></details>
    </section>}
    {season && date && !competitions.length && <p className="panel-card">No hay competencias configuradas para esta jornada.</p>}
  </DashboardShell>;
}
