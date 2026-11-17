export type StandingRow = { jugador_id: number; nombre_completo: string; pj: number; pg: number; pp: number; sf: number; sc: number; pf: number; pc: number; empate: boolean };
export type GroupStanding = {
  grupo_id: number; numero: number; filas: StandingRow[]; total: number; confirmados: number; pendientes: number;
  empate: boolean; aprobable: boolean; snapshot: unknown;
  aprobacion: null | { id: number; vigente: boolean; actor_id: string; ocurrido_en: string; referencia: string };
};

/** No inventa nombres de personas ni usa correo/metadata como identidad deportiva. */
export function refereeLabel(name: string, id: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  return `${!clean || /^(usuario|árbitro|arbitro)$/i.test(clean) ? "Árbitro · nombre pendiente" : clean} · ${id.slice(0, 8)}`;
}
