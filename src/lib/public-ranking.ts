// Contrato de presentación: solo información destinada a publicación pública.
// Un futuro adaptador de resultados oficiales debe entregar posiciones y puntos
// ya validados. Este módulo no calcula, ordena ni resuelve clasificaciones.
export const EXTERNAL_RANKING_URL = "https://rankingtemporada2026.netlify.app/ranking";

export type PublicRankingEntry = {
  position: number;
  name: string;
  origin: string;
  points: number;
};
export type PublicRankingCategory = {
  id: string;
  label: string;
  podium: PublicRankingEntry[];
  accumulated: PublicRankingEntry[];
  awards: PublicRankingEntry[];
};
export type PublicRankingPublication = {
  seasonLabel: string;
  updatedLabel: string;
  dates: string[];
  categories: PublicRankingCategory[];
};
