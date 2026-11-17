"use server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCatalogOptions } from "@/lib/admin-options";
import { PLAYER_COLUMNS, PLAYERS_PATH, type PlayerRecord } from "@/lib/jugadores";
import { readExcel, MAX_FILE } from "@/lib/excel-jugadores";
import { reviewRows, type ImportRow } from "@/lib/importacion-jugadores";
import { revalidatePath } from "next/cache";

export async function uploadPlayers(data: FormData) {
  await requireRole("administrador");
  try {
    const file = data.get("archivo");
    if (!(file instanceof File) || !/\.xlsx$/i.test(file.name) || file.size > MAX_FILE) return { error: "Selecciona un archivo .xlsx de hasta 2 MB." };
    return { sheets: await readExcel(Buffer.from(await file.arrayBuffer())) };
  } catch { return { error: "No se pudo leer el Excel. Comprueba que no esté cifrado, dañado o exceda 2000 filas, 50 columnas y 20 hojas. Fórmulas y vínculos no se importan." }; }
}
async function context() {
  const db = await createClient();
  const players: PlayerRecord[] = [];
  for (let start = 0; ; start += 500) {
    const result = await db.from("jugadores").select(PLAYER_COLUMNS).order("id").range(start, start + 499);
    if (result.error) throw new Error("No se pudieron consultar los jugadores.");
    players.push(...result.data);
    if (result.data.length < 500) break;
    if (players.length > 50000) throw new Error("Catálogo demasiado grande para este importador.");
  }
  const [clubs, localities] = await Promise.all([getCatalogOptions("clubes"), getCatalogOptions("localidades")]);
  if (clubs.error || localities.error) throw new Error("No se pudieron consultar los catálogos.");
  return { db, players, clubs: clubs.data, localities: localities.data };
}
function validateRows(rows: ImportRow[]) {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 2000 || JSON.stringify(rows).length > 1500000) throw new Error("Lote inválido (máximo 2000 filas).");
  for (const r of rows) {
    if (!r || typeof r.selected !== "boolean") throw new Error("Fila inválida.");
    for (const field of ["source", "id", "nombre_completo", "fecha_nacimiento", "club_id", "localidad_procedencia_id"] as const) if (typeof r[field] !== "string" || r[field].length > 300) throw new Error("Campo inválido.");
  }
}
export async function previewPlayers(rows: ImportRow[]) {
  await requireRole("administrador");
  try {
    validateRows(rows);
    const c = await context();
    return { review: reviewRows(rows, c.players, c.clubs, c.localities), clubs: c.clubs, localities: c.localities };
  } catch { return { error: "No se pudo validar el lote. Revisa sus límites y tu conexión." }; }
}
export type ImportResult = { source: string; estado: string; id?: number; mensaje?: string };
export async function confirmPlayers(rows: ImportRow[], confirmed: boolean) {
  await requireRole("administrador");
  if (confirmed !== true) return { error: "Confirma expresamente las filas seleccionadas." };
  try {
    validateRows(rows);
    const c = await context(), review = reviewRows(rows, c.players, c.clubs, c.localities);
    const results: ImportResult[] = [];
    const accepted = [];
    for (const r of review) {
      if (!r.row.selected) results.push({ source: r.row.source, estado: "omitido" });
      else if (r.errors.length) results.push({ source: r.row.source, estado: "error", mensaje: r.errors.join(" ") });
      else if (r.row.id || r.repeated || r.matches.length) results.push({ source: r.row.source, estado: "duplicado", mensaje: "Coincidencia pendiente de revisión individual; no se modificó ninguna ficha." });
      else accepted.push(r);
    }
    if (accepted.length) {
      const response = await c.db.rpc("importar_fichas_jugadores", { filas: accepted.map(r => r.payload) });
      if (response.error) return { error: "No se confirmó el lote. La función 008 debe estar revisada y aplicada manualmente. Ante un error de conexión, vuelve a previsualizar antes de reintentar: las coincidencias se omiten.", results: [...results, ...accepted.map(r => ({ source: r.row.source, estado: "sin_confirmar", mensaje: "Comprueba el listado y vuelve a validar antes de reintentar." }))] };
      const saved = response.data as { fila: number; estado: string; id?: number; mensaje?: string }[];
      if (!Array.isArray(saved) || saved.length !== accepted.length) throw new Error("Respuesta incompleta");
      for (const r of saved) results.push({ source: accepted[r.fila - 1].row.source, estado: r.estado, id: r.id, mensaje: r.mensaje });
      revalidatePath(PLAYERS_PATH);
    }
    return { results };
  } catch { return { error: "No se pudo confirmar el resultado. Vuelve a previsualizar antes de reintentar; no presupongas que el lote se guardó.", results: Array.isArray(rows) ? rows.filter(r => r && typeof r.source === "string").map(r => ({ source: r.source, estado: "sin_confirmar" })) : [] }; }
}
