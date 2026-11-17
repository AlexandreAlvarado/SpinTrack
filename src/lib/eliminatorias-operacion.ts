import type { MatchResult, ResultEvent } from "@/lib/resultados";
export const KNOCKOUT_PAGE_SIZE = 16;
export type OperativeMatch = {
  id: number; llave_id: number; ronda_id: number; ronda_numero: number; numero: number;
  jugador_a_id: number | null; jugador_b_id: number | null; fuente_a_id: number | null; fuente_b_id: number | null;
  mejor_de: number; referencia_reglas: string; arbitro_id: string | null;
  estado: string; revision: number; ganador_id: number | null; perdedor_id: number | null;
};
export type KnockoutAct = { id: number; partido_id: number; revision: number; sets: MatchResult["sets"]; sets_a: number; sets_b: number; ganador_id: number; autor_id: string; creado_en: string; referencia: string };
export type KnockoutEvent = ResultEvent & { llave_id: number; partido_id: number | null; acta_id: number | null; evento: string };
export type KnockoutPage = {
  error?: string; matches: OperativeMatch[]; more: boolean; acts: KnockoutAct[]; history: KnockoutEvent[];
  players: { id: number; nombre_completo: string; perfil_id?: string | null }[];
  referees: { id: string; nombre_completo: string }[];
  champion: number | null; finalist: number | null; state: string | null; authorized: boolean; authorizationIssue?: string;
};
export function knockoutResult(act: KnockoutAct, match: OperativeMatch): MatchResult {
  return { ...act, tipo: "ordinario", mejor_de: match.mejor_de, descripcion: "", referencia_reglas: match.referencia_reglas, motivo_correccion: act.revision > 1 ? act.referencia : null };
}
