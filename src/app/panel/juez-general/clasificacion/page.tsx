import { KnockoutOperations } from "@/components/knockout-operations";
import { DashboardShell } from "@/components/dashboard-shell";
import { JudgeNavigation } from "@/components/judge-navigation";
import { JudgeContextSelector } from "@/components/judge-context-selector";
import { GroupStandingsCollection, StandingsRefresh } from "@/components/group-standings";
import { KnockoutPreview, type PersistedElimination } from "@/components/knockout-preview";
import type { GroupStanding } from "@/lib/clasificacion";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { COMPETITION_COLUMNS, type Competition, type CompetitionDate } from "@/lib/competencias";
import type { Season, SeasonCategory, Concept } from "@/lib/temporadas-deportivas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clasificación de grupos · Juez General" };
export default async function StandingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireRole("juez_general");
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === "string" ? value : ""]));
  let seasons: Season[] = [], dates: CompetitionDate[] = [], competitions: Competition[] = [], categories: SeasonCategory[] = [], concepts: Concept[] = [], levels: Concept[] = [];
  const standings: GroupStanding[] = [];
  let persisted: PersistedElimination | null = null;
  let currentProposal: PersistedElimination | null = null;
  let confirmedKey: PersistedElimination | null = null;
  let historicalDrafts: PersistedElimination[] = [];
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
          const groups = await read<{ id: number }>("grupos_competencia", "id", { competencia_id: competition.id });
          // Concurrencia de transporte acotada, sin limitar la cantidad de grupos.
          for (let offset = 0; offset < groups.length; offset += 8) {
            const batch = await Promise.all(groups.slice(offset, offset + 8).map(async group => {
              const response = await db.rpc("consultar_clasificacion_grupo", { p_grupo_id: group.id });
              if (response.error) throw new Error(response.error.code + ": " + response.error.message);
              if (!response.data) throw new Error("Clasificación sin respuesta");
              return response.data as GroupStanding;
            }));
            standings.push(...batch);
          }
          try {
            const keys = await read<PersistedElimination>("eliminatorias_llaves", "id,competencia_id,estado,posiciones,clasificados,pases_automaticos,propuesta,clasificaciones_fuente,referencia_guardado,confirmado_por,confirmado_en,referencia_confirmacion,creado_en", { competencia_id: competition.id });
            const activos = keys.filter(item => item.estado === "confirmada" || item.estado === "borrador").sort((left, right) => right.id - left.id);
            const singleGroup = standings.length === 1;
            confirmedKey = activos.find(item => item.estado === "confirmada" && (singleGroup ? item.propuesta?.version_regla === 19 : item.propuesta?.version_regla === 17)) ?? null;
            currentProposal = activos.find(item => item.estado === "borrador" && (singleGroup ? item.propuesta?.version_regla === 19 : item.propuesta?.version_regla === 17)) ?? null;
            historicalDrafts = activos.filter(item => item.estado === "borrador" && item !== currentProposal);
            persisted = confirmedKey ?? currentProposal ?? historicalDrafts[0] ?? null;
          } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            if (!detail.includes("42P01") && !detail.includes("PGRST205")) console.warn("[eliminatorias] lectura opcional fallida", { detail });
          }
        }
      }
    }
  } catch (error) {
    failed = true;
    const detail = error instanceof Error ? error.message : String(error);
    failureMessage = detail.includes("42P01") || detail.includes("42883") || detail.includes("PGRST205") || detail.includes("PGRST202")
      ? "Clasificación no disponible: revisa la aplicación manual de 015 y sus dependencias."
      : "No se pudo consultar la competencia o su nómina. Revisa el registro del servidor y vuelve a intentar.";
    console.error("[clasificacion] consulta fallida", { detail, temporada: query.temporada, fecha: query.fecha || query.jornada, competencia: query.competencia });
  }
  const season = seasons.find(item => String(item.id) === query.temporada) ?? (seasons.length === 1 ? seasons[0] : undefined);
  const date = dates.find(item => String(item.id) === (query.fecha || query.jornada));
  const competition = competitions.find(item => String(item.id) === query.competencia);
  const category = categories.find(item => item.id === competition?.categoria_temporada_id);
  const label = category ? `${concepts.find(item => item.id === category.categoria_id)?.nombre ?? category.codigo} · ${levels.find(item => item.id === category.nivel_id)?.nombre ?? "Nivel pendiente"}` : "Competencia individual";

  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    <JudgeNavigation current="/panel/juez-general/clasificacion" />
    <h2 className="text-2xl font-bold">Clasificación y eliminatorias</h2>
    <p className="my-3 text-sm text-slate-600">Consulta interna de resultados confirmados. Clasifican primero y segundo de cada grupo por definición del usuario. El orden por victorias, los desempates y la distribución requieren respaldo deportivo validado. Los datos de prueba no se publican.</p>
    <JudgeContextSelector seasons={seasons} dates={dates} competitions={competitions} categories={categories} concepts={concepts} levels={levels} seasonId={season?.id} dateId={date?.id} competitionId={competition?.id} />
    {failed ? <p role="alert" className="panel-card">{failureMessage} No se muestra una tabla parcial. Recarga antes de continuar.</p> : !competition ? <p className="panel-card">Selecciona una competencia individual.</p> : <>
      <h3 className="mt-4 font-bold">{label} · Jornada {date?.numero}</h3><StandingsRefresh />
      {standings.length ? <GroupStandingsCollection groups={standings} /> : <p className="panel-card">No hay grupos para esta competencia.</p>}
      {confirmedKey?.estado === "confirmada" && <KnockoutOperations key={`knockout-operations-${confirmedKey.id}`} keyId={confirmedKey.id} positions={confirmedKey.posiciones} />}
      <KnockoutPreview key={`knockout-preview-${competition.id}`} groups={standings} competitionId={competition.id} persisted={persisted} currentProposal={currentProposal} confirmed={confirmedKey} historicalDrafts={historicalDrafts} showSingleGroupFinal={!confirmedKey} />
    </>}
  </DashboardShell>;
}
