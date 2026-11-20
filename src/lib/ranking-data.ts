import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/config";
import { calculateRanking, type RankingScope } from "@/lib/ranking";
import { PERSONAL_DATA_REVIEW_PENDING } from "@/lib/legal";
export async function getSeasonRanking(): Promise<{ scopes: RankingScope[]; unavailable: boolean }> {
  if (PERSONAL_DATA_REVIEW_PENDING) return { scopes: [], unavailable: true };
  if (!supabaseConfigured()) return { scopes: [], unavailable: true };
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("consultar_ranking_publico_026");
    if (error || !Array.isArray(data)) return { scopes: [], unavailable: true };
    const scopes = data as RankingScope[];
    scopes.forEach(calculateRanking);
    return { scopes, unavailable: false };
  } catch { return { scopes: [], unavailable: true }; }
}
