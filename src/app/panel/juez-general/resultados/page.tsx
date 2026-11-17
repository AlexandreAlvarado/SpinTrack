import { matchSummary } from "@/lib/gestion-partidos";
import { GroupMatches } from "@/components/group-matches";
import { MatchManagement, MatchCounts } from "@/components/match-management";
import { type ResultObservation } from "@/components/match-results";
import { type RefereeOption, type MatchAssignment } from "@/components/referee-assignment";
import { refereeLabel } from "@/lib/clasificacion";
import type { MatchResult, ResultEvent } from "@/lib/resultados";
import { DashboardShell } from "@/components/dashboard-shell";
import { JudgeNavigation } from "@/components/judge-navigation";
import { JudgeContextSelector } from "@/components/judge-context-selector";
import type { MatchLot, GroupMatch } from "@/components/group-matches";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { COMPETITION_COLUMNS, type Competition, type CompetitionDate } from "@/lib/competencias";
import type { Season, SeasonCategory, Concept } from "@/lib/temporadas-deportivas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resultados por set · Juez General" };
type Participant = { jugador_id: number };
type Player = { id: number; nombre_completo: string; perfil_id: string | null };
type GroupRow = { id: number; competencia_id: number; numero: number; estado: string };



export default async function ResultsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireRole("juez_general");
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === "string" ? value : ""]));
  let seasons: Season[] = [], dates: CompetitionDate[] = [], competitions: Competition[] = [], categories: SeasonCategory[] = [], concepts: Concept[] = [], levels: Concept[] = [], participants: Participant[] = [], players: Player[] = [], groupRows: GroupRow[] = [], results: MatchResult[] = [], events: ResultEvent[] = [], observations: ResultObservation[] = [], assignments: MatchAssignment[] = [], referees: RefereeOption[] = [];
  let lots: MatchLot[] = [], matches: GroupMatch[] = [];
  let people: Record<string, string> = {};
  let history: { id: number; evento: string; ocurrido_en: string; referencia: string }[] = [];
  let failed = false;
  let failureMessage = "";
  try {
    const db = await createClient();
    const read = async <T,>(table: string, columns: string, filters: Record<string, number> = {}) => {
      let all: T[] = [];
      for (let offset = 0;; offset += 500) {
        let request = db.from(table).select(columns).order(table === "competencia_control_deportivo" ? "competencia_id" : "id");
        for (const [key, value] of Object.entries(filters)) request = request.eq(key, value);
        const response = await request.range(offset, offset + 499);
        if (response.error) throw new Error(`${table}: ${response.error.code ?? "sin código"} · ${response.error.message}`);
        all = all.concat(response.data as T[]);
        if (response.data.length < 500) return all;
      }
    };
    seasons = await read<Season>("temporadas", "id,nombre,anio");
    const season = seasons.find(item => String(item.id) === query.temporada) ?? (seasons.length === 1 ? seasons[0] : undefined);
    if (season) {
      dates = await read<CompetitionDate>("fechas", "id,temporada_id,numero,fecha,comuna,recinto,estado", { temporada_id: season.id });
      const date = dates.find(item => String(item.id) === (query.fecha || query.jornada));
      if (date) {
        competitions = await read<Competition>("competencias", COMPETITION_COLUMNS, { temporada_id: season.id, fecha_id: date.id });
        [categories, concepts, levels] = await Promise.all([
          read<SeasonCategory>("categorias_temporada", "id,temporada_id,categoria_id,nivel_id,codigo,rama,criterio_nacimiento,anio_nacimiento_desde,anio_nacimiento_hasta,reglamento_id,activo", { temporada_id: season.id }),
          read<Concept>("categorias", "id,codigo,nombre,activo"), read<Concept>("niveles", "id,codigo,nombre,activo"),
        ]);
        const competition = competitions.find(item => String(item.id) === query.competencia);
        if (competition) {
          participants = await read<Participant>("participantes_competencia", "jugador_id", { competencia_id: competition.id });
          const ids = participants.map(item => item.jugador_id);
          if (ids.length) {
            players = await read<Player>("jugadores", "id,nombre_completo,perfil_id", {});
            players = players.filter(player => ids.includes(player.id));
          }
          groupRows = await read<GroupRow>("grupos_competencia", "id,competencia_id,numero,estado", { competencia_id: competition.id });
          lots = await read<MatchLot>("lotes_partidos_grupos", "id,estado,mejor_de,referencia_formato,motivo_descarte", { competencia_id: competition.id });
          matches = await read<GroupMatch>("partidos", "id,grupo_id,jugador_a_id,jugador_b_id,lote_id", { competencia_id: competition.id });
          history = await read<typeof history[number]>("partidos_grupos_historial", "id,evento,ocurrido_en,referencia", { competencia_id: competition.id });
          const confirmedLot = lots.find(item => item.estado === "confirmado" || item.estado === "borrador");
          matches = confirmedLot ? matches.filter(match => (match as GroupMatch & { lote_id: number }).lote_id === confirmedLot.id) : [];
          // Siempre se prueba la disponibilidad de 012, incluso sin resultados existentes.
          const matchIds = matches.map(match => match.id);
          const readResultRows = async <T,>(table: string, columns: string, key: string, ids: number[], orderColumn = "id") => {
            const rows: T[] = [];
            for (let start = 0; start < Math.max(ids.length, 1); start += 100) {
              for (let offset = 0;; offset += 500) {
                const response = await db.from(table).select(columns).in(key, ids.slice(start, start + 100)).order(orderColumn).range(offset, offset + 499);
                if (response.error) throw new Error(`${table}: ${response.error.code} · ${response.error.message}`);
                rows.push(...response.data as T[]);
                if (response.data.length < 500) break;
              }
            }
            return rows;
          };
          results = await readResultRows<MatchResult>("resultados_partidos", "id,partido_id,revision,tipo,sets,mejor_de,sets_a,sets_b,ganador_id,descripcion,referencia,referencia_reglas,motivo_correccion,autor_id,creado_en", "partido_id", matchIds);
          events = await readResultRows<ResultEvent>("resultados_partidos_eventos", "id,resultado_id,actor_id,ocurrido_en,referencia", "resultado_id", results.map(r => r.id));
          observations = await readResultRows<ResultObservation>("resultados_partidos_observaciones", "id,resultado_id,juez_id,observacion,creado_en", "resultado_id", results.map(r => r.id));
          assignments = await readResultRows<MatchAssignment>("partidos_arbitros", "partido_id,arbitro_id,activo", "partido_id", matchIds, "partido_id");
          const profiles = await read<{ id: string; nombre_completo: string; arbitraje_habilitado: boolean }>("perfiles", "id,nombre_completo,arbitraje_habilitado");
          referees = profiles.filter(p => p.arbitraje_habilitado).map(p => ({ id: p.id, nombre_completo: refereeLabel(p.nombre_completo, p.id) }));
          people = Object.fromEntries(profiles.map(p => [p.id, p.nombre_completo?.trim() || "Nombre pendiente"]));
          assignments = assignments.filter(a => a.activo !== false).map(a => ({ ...a, arbitro_nombre: a.arbitro_id ? people[a.arbitro_id] ?? "Nombre no disponible" : null }));
        }
      }
    }
  } catch (error) {
    failed = true;
    const detail = error instanceof Error ? error.message : String(error);
    failureMessage = detail.includes("42P01") || detail.includes("42883") || detail.includes("PGRST205") || detail.includes("PGRST202")
      ? "Los resultados aún no están disponibles: falta aplicar la migración 013 (y sus dependencias) en este entorno."
      : "No se pudo consultar la competencia o su nómina. Revisa el registro del servidor y vuelve a intentar.";
    console.error("[resultados] consulta fallida", { detail, temporada: query.temporada, fecha: query.fecha || query.jornada, competencia: query.competencia });
  }
  const season = seasons.find(item => String(item.id) === query.temporada) ?? (seasons.length === 1 ? seasons[0] : undefined);
  const date = dates.find(item => String(item.id) === (query.fecha || query.jornada));
  const competition = competitions.find(item => String(item.id) === query.competencia);
  const category = categories.find(item => item.id === competition?.categoria_temporada_id);
  const label = category ? `${concepts.find(item => item.id === category.categoria_id)?.nombre ?? category.codigo} · ${levels.find(item => item.id === category.nivel_id)?.nombre ?? "Nivel pendiente"}` : "Competencia individual";

  const lot = lots.find(item => item.estado === "confirmado" || item.estado === "borrador");
  const ready = groupRows.length > 0 && groupRows.every(g => g.estado === "confirmado");
  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    <JudgeNavigation current="/panel/juez-general/partidos" />
    <h2 className="text-2xl font-bold">2. Gestionar partidos</h2>
    <p className="mb-5 mt-2 text-sm text-slate-600">Asignación de árbitros y revisión de resultados enviados. El Juez General no reingresa los sets.</p>
    {failed && <p role="alert" className="panel-card mb-5">{failureMessage} Recarga antes de continuar.</p>}
    <JudgeContextSelector seasons={seasons} dates={dates} competitions={competitions} categories={categories} concepts={concepts} levels={levels} seasonId={season?.id} dateId={date?.id} competitionId={competition?.id} />
    {!competition ? <p className="panel-card">Selecciona una competencia individual para revisar sus partidos.</p> : <><section className="panel-card mb-5"><h3 className="font-bold">{label}</h3><p className="text-sm text-slate-600">Jornada {date?.numero} · {date?.fecha}</p></section>{failed ? <p role="alert" className="panel-card">No se muestran partidos porque la lectura desde Supabase falló.</p> : lot?.estado === "confirmado" ? <><MatchManagement matches={matches} groups={groupRows} players={players} bestOf={lot.mejor_de} results={results} events={events} observations={observations} assignments={assignments} referees={referees} people={people} classificationHref={`/panel/juez-general/clasificacion?temporada=${season?.id ?? ""}&fecha=${date?.id ?? ""}&competencia=${competition.id}`} /><details className="panel-card mt-5"><summary className="cursor-pointer font-semibold">Herramientas avanzadas · lote e historial</summary><p className="mt-3 text-sm break-words">Lote #{lot.id} · Respaldo: {lot.referencia_formato}</p>{history.map(h => <p className="mt-2 break-words text-sm" key={h.id}>{h.evento} · {h.ocurrido_en} · {h.referencia}</p>)}</details></> : <><section className="panel-card mb-5"><MatchCounts summary={matchSummary(matches, results, events, observations, assignments)} /></section><GroupMatches competitionId={competition.id} players={players} groups={groupRows} matches={matches} lot={lot} ready={ready} history={history} /></>}</>}
  </DashboardShell>;
}

