import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { JudgeNavigation } from "@/components/judge-navigation";
import { ParticipantRosterForm } from "@/components/participant-roster-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PLAYER_COLUMNS, type PlayerRecord, validBirthDate } from "@/lib/jugadores";
import { HABILITATION_COLUMNS, HABILITATIONS_PATH, type Habilitation } from "@/lib/habilitaciones";
import { COMPETITION_COLUMNS, type Competition, type CompetitionDate, type SportsControl } from "@/lib/competencias";
import type { Rule, Season, SeasonCategory } from "@/lib/temporadas-deportivas";
import { JudgeContextSelector } from "@/components/judge-context-selector";

export const dynamic = "force-dynamic";
export const metadata = { title: "Participantes confirmados · Juez General" };
type Named = { id: number; codigo: string; nombre: string; activo: boolean };

function categoryLabel(category: SeasonCategory | undefined, categories: Named[], levels: Named[]) {
  if (!category) return "Competencia individual";
  const base = categories.find(item => item.id === category.categoria_id)?.nombre;
  const level = levels.find(item => item.id === category.nivel_id)?.nombre;
  return [base, level].filter(Boolean).join(" · ") || category.codigo.replaceAll("_", " ");
}

function eligibilityReason(player: PlayerRecord, category: SeasonCategory, habilitation: Habilitation | undefined, catalogsActive: boolean, blocker: string | null) {
  if (blocker) return blocker;
  if (!player.activo) return "Ficha deportiva inactiva.";
  if (!category.activo || !catalogsActive) return "Categoría o nivel inactivo.";
  if (!category.rama) return "La rama de la categoría está pendiente.";
  if (!["rango_anios", "sin_limite"].includes(category.criterio_nacimiento)) return "El criterio de nacimiento está pendiente.";
  if (!habilitation) return "Sin habilitación deportiva para esta categoría.";
  if (habilitation.estado === "pendiente") return "Habilitación pendiente de resolución.";
  if (habilitation.estado !== "habilitado") return "Habilitación marcada como no habilitada.";
  if (!habilitation.validado_por || !habilitation.validado_en || !habilitation.motivo?.trim() || !habilitation.referencia_evidencia?.trim()) return "Falta completar la validación y evidencia de la habilitación.";
  if (category.criterio_nacimiento === "rango_anios" && habilitation.tipo_resolucion !== "excepcion_documentada") {
    if (!player.fecha_nacimiento || !validBirthDate(player.fecha_nacimiento)) return "Nacimiento desconocido o inválido para la categoría.";
    const year = Number(player.fecha_nacimiento.slice(0, 4));
    if (category.anio_nacimiento_desde === null || category.anio_nacimiento_hasta === null || year < category.anio_nacimiento_desde || year > category.anio_nacimiento_hasta) return "Nacimiento fuera del rango de la categoría.";
  }
  return null;
}

export default async function ParticipantsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireRole("juez_general");
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === "string" ? value : ""]));
  let seasons: Season[] = [], dates: CompetitionDate[] = [], categories: SeasonCategory[] = [], competitions: Competition[] = [], players: PlayerRecord[] = [], habilitations: Habilitation[] = [], selected: number[] = [], categoryCatalog: Named[] = [], levelCatalog: Named[] = [], rules: Rule[] = [], controls: SportsControl[] = [];
  let failed = false;
  let failedReason = "";
  try {
    const db = await createClient();
    const read = async <T,>(table: string, columns: string, filters: Record<string, number> = {}) => {
      let all: T[] = [];
      for (let offset = 0;; offset += 500) {
        let request = db.from(table).select(columns).order(table.startsWith("competencia_") ? "competencia_id" : "id");
        for (const [key, value] of Object.entries(filters)) request = request.eq(key, value);
        const result = await request.range(offset, offset + 499);
        if (result.error) throw Error(`${table}: ${result.error.code ?? "sin código"} · ${result.error.message}`);
        all = all.concat(result.data as T[]);
        if (result.data.length < 500) return all;
      }
    };
    seasons = await read<Season>("temporadas", "id,nombre,anio");
    const season = seasons.find(item => String(item.id) === query.temporada) ?? (seasons.length === 1 ? seasons[0] : undefined);
    if (season) {
      dates = await read<CompetitionDate>("fechas", "id,temporada_id,numero,fecha,comuna,recinto,estado", { temporada_id: season.id });
      const requestedDate = dates.find(item => String(item.id) === (query.fecha || query.jornada));
      const today = new Date().toISOString().slice(0, 10);
      const date = requestedDate ?? dates.filter(item => item.estado === "publicada" && item.fecha >= today).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
      if (date) {
        [categories, categoryCatalog, levelCatalog] = await Promise.all([
          read<SeasonCategory>("categorias_temporada", "id,temporada_id,categoria_id,nivel_id,codigo,rama,criterio_nacimiento,anio_nacimiento_desde,anio_nacimiento_hasta,reglamento_id,activo", { temporada_id: season.id }),
          read<Named>("categorias", "id,codigo,nombre,activo"), read<Named>("niveles", "id,codigo,nombre,activo"),
        ]);
        competitions = await read<Competition>("competencias", COMPETITION_COLUMNS, { fecha_id: date.id, temporada_id: season.id });
        const competition = competitions.find(item => String(item.id) === query.competencia);
        if (competition) {
          [players, habilitations, rules, controls] = await Promise.all([
            read<PlayerRecord>("jugadores", PLAYER_COLUMNS),
            read<Habilitation>("habilitaciones_jugador_categoria", HABILITATION_COLUMNS, { categoria_temporada_id: competition.categoria_temporada_id }),
            read<Rule>("reglamentos_temporada", "id,temporada_id,version,titulo,referencia_documental,hash_documento,estado_revision,referencia_aprobacion", { temporada_id: season.id }),
            read<SportsControl>("competencia_control_deportivo", "competencia_id,configuracion_aprobada,estado_deportivo,inicio_programado,minimo_participantes", { competencia_id: competition.id }),
          ]);
          const rows = await read<{ jugador_id: number }>("participantes_competencia", "jugador_id", { competencia_id: competition.id });
          selected = rows.map(row => row.jugador_id);
        }
      }
    }
  } catch (error) { failed = true; failedReason = error instanceof Error ? error.message : "Error desconocido de Supabase"; console.error("[participantes]", failedReason); }

  const season = seasons.find(item => String(item.id) === query.temporada) ?? (seasons.length === 1 ? seasons[0] : undefined);
  const requestedDate = dates.find(item => String(item.id) === (query.fecha || query.jornada));
  const today = new Date().toISOString().slice(0, 10);
  const date = requestedDate ?? dates.filter(item => item.estado === "publicada" && item.fecha >= today).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  const competition = competitions.find(item => String(item.id) === query.competencia);
  const category = categories.find(item => item.id === competition?.categoria_temporada_id);
  const categoryIsActive = !!category && !!categoryCatalog.find(item => item.id === category.categoria_id)?.activo && !!levelCatalog.find(item => item.id === category.nivel_id)?.activo;
  const rule = rules.find(item => item.id === category?.reglamento_id && item.temporada_id === season?.id);
  const ruleReady = !!rule && rule.estado_revision === "validado" && !!rule.referencia_aprobacion;
  const control = controls.find(item => item.competencia_id === competition?.id);
  const competitionBlocker = !date || date.estado !== "publicada" ? "La jornada todavía no está publicada." : competition && (!competition.publicada || !competition.activo) ? "La jornada está publicada, pero esta competencia individual no está publicada o activa." : !control?.configuracion_aprobada ? "La preparación deportiva aún no fue aprobada." : control.estado_deportivo !== "preparada" ? "La nómina está bloqueada porque la programación deportiva ya comenzó o está consolidada." : !ruleReady ? "El reglamento de la temporada no está validado y aprobado." : null;
  const displayBlocker = failed ? null : competitionBlocker;
  const byPlayer = new Map(habilitations.map(item => [item.jugador_id, item]));
  const rosterPlayers = category ? players.map(player => {
    const reason = eligibilityReason(player, category, byPlayer.get(player.id), categoryIsActive, displayBlocker);
    return { ...player, habilitado: reason === null, motivo: reason ?? "Disponible", confirmado: selected.includes(player.id) };
  }) : [];
  const enabledCount = rosterPlayers.filter(player => player.habilitado).length;
  const pendingCount = rosterPlayers.length - enabledCount;

  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    <JudgeNavigation current="/panel/juez-general/participantes" />
    <h2 className="text-2xl font-bold">Participantes confirmados</h2>
    <p className="mb-5 mt-2 text-sm text-slate-600">Prepara una lista preliminar. La confirmación definitiva siempre vuelve a validar las reglas en PostgreSQL.</p>
    {failed && <p role="alert" className="panel-card mb-5">No se pudieron comprobar todos los catálogos. Recarga antes de continuar.</p>}
    {failed && <p role="status" className="mb-5 text-xs text-slate-600">Consulta fallida: {failedReason}</p>}
    <JudgeContextSelector seasons={seasons} dates={dates} competitions={competitions} categories={categories} concepts={categoryCatalog.map(item => ({ ...item }))} levels={levelCatalog.map(item => ({ ...item }))} seasonId={season?.id} dateId={date?.id} competitionId={competition?.id} />
    {competition && category && <>
      <section className="panel-card mb-5 space-y-2">
        {failed && <p role="status" className="text-sm text-amber-800">Los contadores no están disponibles mientras falla la consulta.</p>}
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">{categoryLabel(category, categoryCatalog, levelCatalog)}</h3><p className="text-sm text-slate-600">Jornada {date?.numero} · {date?.fecha}</p></div><Link className="btn-secondary" href={HABILITATIONS_PATH}>Revisar habilitaciones</Link></div>
            <p className="text-sm text-slate-600">{failed ? "Jugadores: no disponibles por error de consulta." : `Habilitados: ${enabledCount} · Pendientes/no elegibles: ${pendingCount} · Seleccionados: ${selected.length} · Confirmados: ${selected.length}`}</p>
        {displayBlocker && <p role="status" className="text-sm text-amber-800">{displayBlocker}</p>}
      </section>
      <ParticipantRosterForm competitionId={competition.id} players={rosterPlayers} selected={selected} />
    </>}
  </DashboardShell>;
}

