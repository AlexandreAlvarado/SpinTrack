import { validatePlayer, type PlayerInput, type PlayerRecord } from "@/lib/jugadores";
import { validId, type CatalogOption } from "@/lib/catalogos";
export type ImportRow = { source: string; nombre_completo: string; fecha_nacimiento: string; club_id: string; localidad_procedencia_id: string; id: string; selected: boolean };
export type ReviewRow = { row: ImportRow; payload: PlayerInput; errors: string[]; matches: PlayerRecord[]; repeated: boolean };
const HEADER_ALIASES: Record<string, keyof ImportRow> = { id: "id", nombre: "nombre_completo", nombrecompleto: "nombre_completo", fechanacimiento: "fecha_nacimiento", club: "club_id", clubid: "club_id", localidad: "localidad_procedencia_id", localidadprocedencia: "localidad_procedencia_id", localidadprocedenciaid: "localidad_procedencia_id" };
const headerKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/g, "");
export function inferColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  headers.forEach((header, index) => { const field = HEADER_ALIASES[headerKey(header)]; if (field && mapping[field] === undefined) mapping[field] = String(index); });
  return mapping;
}
export function normalizeImportBirthDate(value: string) {
  const input = value.trim();
  if (!input) return "";
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(input);
  const chile = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(input);
  if (!iso && !chile) return input;
  const [, a, b, c] = (iso ?? chile)!;
  const year = iso ? Number(a) : Number(c), month = Number(b), day = iso ? Number(c) : Number(a);
  const normalized = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day ? normalized : input;
}
export const nameKey = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-zñ0-9]/g, "");
export function nearbyName(a: string, b: string) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 8 || Math.abs(a.length - b.length) > 2) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
    if (Math.min(...current) > 2) return false;
    previous = current;
  }
  return previous[b.length] <= 2;
}
export function reviewRows(rows: ImportRow[], players: PlayerRecord[], clubs: CatalogOption[], localities: CatalogOption[]): ReviewRow[] {
  const seen = new Set<string>();
  const existing = players.map(p => ({ p, key: nameKey(p.nombre_completo) }));
  return rows.map(row => {
    row = { ...row };
    row.fecha_nacimiento = normalizeImportBirthDate(row.fecha_nacimiento);
    for (const [field, options] of [["club_id", clubs], ["localidad_procedencia_id", localities]] as const) {
      const matching = options.filter(o => o.activo && nameKey(o.nombre) === nameKey(row[field]));
      if (row[field] && !validId(row[field]) && matching.length === 1) row[field] = String(matching[0].id);
    }
    const data = new FormData();
    for (const field of ["nombre_completo", "fecha_nacimiento", "club_id", "localidad_procedencia_id"] as const) data.set(field, row[field]);
    data.set("activo", "true");
    const checked = validatePlayer(data), errors = Object.values(checked.errors);
    if (row.id && (!validId(row.id) || !players.some(p => String(p.id) === row.id))) errors.push("ID de jugador inexistente o inválido.");
    for (const [value, options, label] of [[row.club_id, clubs, "Club"], [row.localidad_procedencia_id, localities, "Localidad"]] as const) {
      if (value && !options.some(o => String(o.id) === value && o.activo)) errors.push(`${label}: selecciona una opción activa existente.`);
    }
    if (/\[Contenido no admitido\]|^[=+@\-]|[\u0000-\u001f]/.test(row.nombre_completo)) errors.push("Nombre con contenido no admitido.");
    const key = nameKey(row.nombre_completo);
    const repeated = seen.has(key) || Array.from(seen).some(previous => nearbyName(previous, key));
    if (row.selected) seen.add(key);
    const matches = existing.filter(({p, key: candidate}) => (row.id && String(p.id) === row.id) || nearbyName(candidate, key)).map(({p}) => p);
    return { row, payload: checked.payload, errors, matches, repeated };
  });
}
