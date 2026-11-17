import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { JudgeNavigation } from "@/components/judge-navigation";
import { JudgeContextSelector } from "@/components/judge-context-selector";
import { GroupOrganizer } from "@/components/group-organizer";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { COMPETITION_COLUMNS, type Competition, type CompetitionDate } from "@/lib/competencias";
import type { Season, SeasonCategory, Concept } from "@/lib/temporadas-deportivas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Organización de grupos · Juez General" };
type Participant = { jugador_id: number };
type Player = { id: number; nombre_completo: string; club?: string | null; localidad?: string | null; club_id?: number | null; localidad_procedencia_id?: number | null };
type GroupRow = { id: number; competencia_id: number; numero: number; estado: string };
type MemberRow = { grupo_id: number; jugador_id: number; posicion: number };
type HistoryRow = { id: number; evento: string; actor_id: string; ocurrido_en: string; referencia_trazabilidad: string };

export default async function GroupsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireRole("juez_general");
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === "string" ? value : ""]));
  let seasons: Season[] = [], dates: CompetitionDate[] = [], competitions: Competition[] = [], categories: SeasonCategory[] = [], concepts: Concept[] = [], levels: Concept[] = [], participants: Participant[] = [], players: Player[] = [], groupRows: GroupRow[] = [], members: MemberRow[] = [], history: HistoryRow[] = [];
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
            players = await read<Player>("jugadores", "id,nombre_completo,club_id,localidad_procedencia_id", {});
            players = players.filter(player => ids.includes(player.id));
            const [clubs, localities] = await Promise.all([
              read<{ id: number; nombre: string }>("clubes", "id,nombre", {}),
              read<{ id: number; nombre: string }>("localidades", "id,nombre", {}),
            ]);
            players = players.map(player => ({ ...player, club: clubs.find(club => club.id === player.club_id)?.nombre ?? null, localidad: localities.find(locality => locality.id === player.localidad_procedencia_id)?.nombre ?? null }));
          }
          groupRows = await read<GroupRow>("grupos_competencia", "id,competencia_id,numero,estado", { competencia_id: competition.id });
          if (groupRows.length) members = await read<MemberRow>("grupo_participantes", "grupo_id,jugador_id,posicion", {});
          history = await read<HistoryRow>("grupos_competencia_historial", "id,evento,actor_id,ocurrido_en,referencia_trazabilidad", { competencia_id: competition.id });
        }
      }
    }
  } catch (error) {
    failed = true;
    const detail = error instanceof Error ? error.message : String(error);
    failureMessage = detail.includes("42P01") || detail.includes("42883")
      ? "La organización de grupos aún no está disponible: falta aplicar la migración 010 en este entorno."
      : "No se pudo consultar la competencia o su nómina. Revisa el registro del servidor y vuelve a intentar.";
    console.error("[grupos] consulta fallida", { detail, temporada: query.temporada, fecha: query.fecha || query.jornada, competencia: query.competencia });
  }
  const season = seasons.find(item => String(item.id) === query.temporada) ?? (seasons.length === 1 ? seasons[0] : undefined);
  const date = dates.find(item => String(item.id) === (query.fecha || query.jornada));
  const competition = competitions.find(item => String(item.id) === query.competencia);
  const category = categories.find(item => item.id === competition?.categoria_temporada_id);
  const label = category ? `${concepts.find(item => item.id === category.categoria_id)?.nombre ?? category.codigo} · ${levels.find(item => item.id === category.nivel_id)?.nombre ?? "Nivel pendiente"}` : "Competencia individual";
  const existingGroups = groupRows.sort((a, b) => a.numero - b.numero).map(group => ({ numero: group.numero, jugador_ids: members.filter(member => member.grupo_id === group.id).sort((a, b) => a.posicion - b.posicion).map(member => member.jugador_id) }));
  const locked = groupRows.some(group => group.estado === "confirmado");
  const persistedStatus = locked ? "confirmado" : groupRows.length ? "borrador" : "sin_propuesta";
  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    <JudgeNavigation current="/panel/juez-general/grupos" />
    <h2 className="text-2xl font-bold">Organización de grupos</h2>
    <p className="mb-5 mt-2 text-sm text-slate-600">Solo se utilizan participantes confirmados. No se aplican cabezas de serie ni criterios de siembra no documentados.</p>
    {failed && <p role="alert" className="panel-card mb-5">{failureMessage} Recarga antes de continuar.</p>}
    <JudgeContextSelector seasons={seasons} dates={dates} competitions={competitions} categories={categories} concepts={concepts} levels={levels} seasonId={season?.id} dateId={date?.id} competitionId={competition?.id} />
    {!competition ? <p className="panel-card">Selecciona una competencia individual para revisar sus participantes confirmados.</p> : <><section className="panel-card mb-5"><h3 className="font-bold">{label}</h3><p className="text-sm text-slate-600">Jornada {date?.numero} · {date?.fecha} · {players.length} participantes confirmados</p><Link href={`/panel/juez-general/participantes?temporada=${season?.id ?? ""}&fecha=${date?.id ?? ""}&competencia=${competition.id}`} className="text-sm text-brand underline">Revisar nómina</Link></section>{failed ? <p role="alert" className="panel-card">No se muestran grupos locales porque la lectura desde Supabase falló.</p> : <GroupOrganizer competitionId={competition.id} players={players} initialGroups={existingGroups} locked={locked} persistedStatus={persistedStatus} history={history} />}</>}
  </DashboardShell>;
}

