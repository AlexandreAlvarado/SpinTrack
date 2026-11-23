import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/config";
import { calculateRanking, type RankingScope } from "@/lib/ranking";

export async function getSeasonRanking(): Promise<{ scopes: RankingScope[]; unavailable: boolean }> {
  if (!supabaseConfigured()) return { scopes: [], unavailable: true };
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("consultar_ranking_publico_032");
    if (error || !Array.isArray(data)) return { scopes: [], unavailable: true };
    const scopes = data as RankingScope[];
    scopes.forEach(calculateRanking);
    return { scopes, unavailable: false };
  } catch { return { scopes: [], unavailable: true }; }
}
