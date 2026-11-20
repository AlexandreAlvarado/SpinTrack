"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
export type RankingActionState = { error?: string; success?: string };
const id = (v: FormDataEntryValue | null) => typeof v === "string" && /^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v)) ? Number(v) : null;
const text = (f: FormData, key: string, min: number, max: number) => { const v = f.get(key); return typeof v === "string" && v.trim().length >= min && v.trim().length <= max ? v.trim() : null; };
function refresh() { for (const path of ["/ranking", "/panel/administrador/ranking", "/panel/juez-general/ranking"]) revalidatePath(path); }
export async function configureRanking(_previous: RankingActionState, form: FormData): Promise<RankingActionState> {
  await requireRole("administrador");
  const category = id(form.get("categoria")), rule = id(form.get("reglamento")), dates = form.getAll("fechas").map(id), reference = text(form, "referencia", 10, 2000);
  if (!category || !rule || dates.length !== 7 || dates.some(v => !v) || new Set(dates).size !== 7 || !reference || form.get("respaldo") !== "true") return { error: "Selecciona categoría, reglamento, siete fechas y confirma el respaldo documental del alcance anual." };
  try {
    const db = await createClient();
    const { error } = await db.rpc("configurar_ranking_026", { p_categoria_id: category, p_reglamento_id: rule, p_fecha_ids: dates, p_referencia: reference });
    if (error) return { error: error.code === "23505" ? "La categoría ya tiene configuración registrada." : "No se pudo configurar: comprueba temporada 2026, reglamento validado, fechas 1–7 de la misma temporada y migración 026." };
    refresh(); return { success: "Configuración oficial registrada con trazabilidad." };
  } catch { return { error: "No se pudo conectar. Conserva los datos y reintenta." }; }
}
export async function resolveRankingPlace(_previous: RankingActionState, form: FormData): Promise<RankingActionState> {
  await requireRole("juez_general");
  const competition = id(form.get("competencia")), player = id(form.get("jugador")), place = form.get("puesto") === "revocar" ? null : id(form.get("puesto"));
  const authority = text(form, "autoridad", 3, 200), reference = text(form, "referencia", 10, 2000), reason = text(form, "motivo", 10, 2000);
  if (!competition || !player || (place === null && form.get("puesto") !== "revocar") || (place !== null && (place < 3 || place > 8)) || !authority || !reference || !reason || form.get("respaldo") !== "true") return { error: "Completa la decisión respaldada de autoridad, referencia y motivo." };
  try {
    const db = await createClient();
    const { error } = await db.rpc("resolver_puesto_ranking_026", { p_competencia_id: competition, p_jugador_id: player, p_puesto: place, p_autoridad: authority, p_referencia: reference, p_motivo: reason });
    if (error) return { error: error.code === "23505" ? "Puesto ocupado. Revoca la decisión anterior antes de corregir." : "No se pudo registrar. Revisa resultados confirmados, banda compatible, permisos y configuración oficial." };
    refresh(); return { success: "Resolución registrada. Se conserva el historial anterior." };
  } catch { return { error: "No se pudo conectar. Reintenta sin cambiar resultados." }; }
}
