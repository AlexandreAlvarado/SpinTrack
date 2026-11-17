import { KnockoutOperations } from "@/components/knockout-operations";
import { DashboardShell } from "@/components/dashboard-shell";
import { MatchResults, type ResultObservation } from "@/components/match-results";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MatchResult, ResultEvent } from "@/lib/resultados";
import type { GroupMatch } from "@/components/group-matches";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis partidos · Árbitro" };
type AssignedMatch = GroupMatch & { lote_id: number; competencia_id: number };
type Lot = { id: number; competencia_id: number; mejor_de: number; referencia_formato: string };
type Player = { id: number; nombre_completo: string };

export default async function RefereeResultsPage() {
  const profile = await requireRole("arbitro");
  let matches: AssignedMatch[] = [], players: Player[] = [], lots: Lot[] = [], results: MatchResult[] = [], events: ResultEvent[] = [], observations: ResultObservation[] = [], failed = false, failureMessage = "";
  try {
    const db = await createClient();
    const assignment = await db.from("partidos_arbitros").select("partido_id").eq("arbitro_id", profile.id).eq("activo", true);
    if (assignment.error) throw new Error(`partidos_arbitros: ${assignment.error.code} · ${assignment.error.message}`);
    const ids = (assignment.data ?? []).map(row => row.partido_id as number);
    if (ids.length) {
      const matchResponse = await db.from("partidos").select("id,grupo_id,jugador_a_id,jugador_b_id,lote_id,competencia_id").in("id", ids).order("id");
      if (matchResponse.error) throw new Error(`partidos: ${matchResponse.error.code} · ${matchResponse.error.message}`);
      matches = matchResponse.data as AssignedMatch[];
      const lotIds = [...new Set(matches.map(match => match.lote_id))];
      const lotResponse = await db.from("lotes_partidos_grupos").select("id,competencia_id,mejor_de,referencia_formato").in("id", lotIds).eq("estado", "confirmado");
      if (lotResponse.error) throw new Error(`lotes_partidos_grupos: ${lotResponse.error.code} · ${lotResponse.error.message}`);
      lots = lotResponse.data as Lot[];
      matches = matches.filter(match => lots.some(lot => lot.id === match.lote_id));
      const playerIds = [...new Set(matches.flatMap(match => [match.jugador_a_id, match.jugador_b_id]))];
      const playerResponse = await db.from("jugadores").select("id,nombre_completo").in("id", playerIds);
      if (playerResponse.error) throw new Error(`jugadores: ${playerResponse.error.code} · ${playerResponse.error.message}`);
      players = playerResponse.data as Player[];
      const read = async <T,>(table: string, columns: string, key: string, values: number[]) => {
        if (!values.length) return [] as T[];
        const response = await db.from(table).select(columns).in(key, values).order("id");
        if (response.error) throw new Error(`${table}: ${response.error.code} · ${response.error.message}`);
        return response.data as T[];
      };
      results = await read<MatchResult>("resultados_partidos", "id,partido_id,revision,tipo,sets,mejor_de,sets_a,sets_b,ganador_id,descripcion,referencia,referencia_reglas,motivo_correccion,autor_id,creado_en", "partido_id", matches.map(match => match.id));
      events = await read<ResultEvent>("resultados_partidos_eventos", "id,resultado_id,actor_id,ocurrido_en,referencia", "resultado_id", results.map(result => result.id));
      observations = await read<ResultObservation>("resultados_partidos_observaciones", "id,resultado_id,juez_id,observacion,creado_en", "resultado_id", results.map(result => result.id));
    }
  } catch (error) {
    failed = true;
    const detail = error instanceof Error ? error.message : String(error);
    failureMessage = detail.includes("42P01") || detail.includes("42883") || detail.includes("PGRST205") ? "El registro de resultados requiere aplicar la migración 013 en este entorno." : "No se pudieron consultar tus partidos asignados.";
    console.error("[arbitro-resultados] consulta fallida", { detail, arbitro: profile.id });
  }
  return <DashboardShell arbitrajeHabilitado={profile.arbitrajeHabilitado} role="arbitro" nombre={profile.nombre}><h2 className="text-2xl font-bold">Mis partidos asignados</h2><p className="mb-5 mt-2 text-sm text-slate-600">Registra un partido a la vez y envíalo al Juez General. Solo aparecen partidos confirmados asignados a tu perfil.</p>{failed && <p role="alert" className="panel-card mb-5">{failureMessage}</p>}{!failed && !matches.length && <p className="panel-card">No tienes partidos confirmados asignados en este momento.</p>}{!failed && lots.map(lot => <section key={lot.id} className="mb-7"><h3 className="mb-3 text-lg font-bold">Competencia #{lot.competencia_id} · Mejor de {lot.mejor_de}</h3><MatchResults mode="referee" matches={matches.filter(match => match.lote_id === lot.id)} groups={[...new Map(matches.filter(match => match.lote_id === lot.id).map(match => [match.grupo_id, { id: match.grupo_id, numero: match.grupo_id }])).values()]} players={players} bestOf={lot.mejor_de} results={results} events={events} observations={observations} rulesReference={lot.referencia_formato} actReference="Acta digital del partido" /></section>)}<KnockoutOperations mode="referee" /></DashboardShell>;
}
