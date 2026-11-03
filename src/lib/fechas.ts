import { supabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { EventDate } from "@/components/date-list";

export async function getPublishedDates(): Promise<EventDate[]> {
  if (!supabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("fechas")
    .select("id, numero, fecha, comuna, recinto, estado")
    .eq("estado", "publicada")
    .order("fecha", { ascending: true });
  if (error) return [];
  return data ?? [];
}
