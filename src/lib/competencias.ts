import { validId, type CatalogState } from "./catalogos";

export const COMPETITIONS_PATH = "/panel/administrador/competencias";
export const LEAGUE_ZONE = "America/Santiago";
export type CompetitionState = CatalogState;
export type CompetitionDate = { id: number; temporada_id: number; numero: number; fecha: string; comuna: string; recinto: string; estado: string };
export type Competition = {
  id: number; temporada_id: number; fecha_id: number; categoria_temporada_id: number;
  tarifa_clp: number | null; inscripcion_abre_en: string | null; inscripcion_cierra_en: string | null;
  activo: boolean; publicada: boolean; inscripciones_habilitadas: boolean;
};
export type SportsControl = { competencia_id: number; configuracion_aprobada: boolean; estado_deportivo: string; inicio_programado: string | null; minimo_participantes: number | null };
export const COMPETITION_COLUMNS = "id,temporada_id,fecha_id,categoria_temporada_id,tarifa_clp,inscripcion_abre_en,inscripcion_cierra_en,activo,publicada,inscripciones_habilitadas";
const localFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: LEAGUE_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

export function localDateTime(instant: string | null) {
  if (!instant) return "";
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) return "";
  const p = Object.fromEntries(localFormatter.formatToParts(date).map(part => [part.type, part.value]));
  const fraction = date.getUTCMilliseconds();
  return `${p.year.padStart(4, "0")}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${fraction ? `.${String(fraction).padStart(3, "0")}` : ""}`;
}

// Buscar offsets reales en Intl/IANA, no asumir UTC-3 ni depender de la zona del dispositivo.
export function santiagoCandidates(local: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(local) || Number(local.slice(0, 4)) < 1) return [];
  const normalized = local.length === 16 ? `${local}:00` : local;
  const wall = new Date(`${normalized}Z`);
  if (!Number.isFinite(wall.getTime()) || wall.toISOString().slice(0, 16) !== normalized.slice(0, 16)) return [];
  const found = new Set<string>();
  for (let h = -36; h <= 36; h += 6) {
    const sample = new Date(wall.getTime() + h * 3600000);
    const rendered = localDateTime(sample.toISOString());
    const offset = new Date(`${rendered}Z`).getTime() - sample.getTime();
    if (!Number.isFinite(offset)) continue;
    const candidate = new Date(wall.getTime() - offset).toISOString();
    if (localDateTime(candidate) === localDateTimeCanonical(normalized)) found.add(candidate);
  }
  return [...found].sort();
}
function localDateTimeCanonical(local: string) {
  return local.replace(/\.0+$/, "").replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.(\d{1,2})$/, (_, digits: string) => `.${digits.padEnd(3, "0")}`);
}
export function repeatedHourChoice(instant: string | null) {
  if (!instant) return "";
  const choices = santiagoCandidates(localDateTime(instant));
  return choices.length > 1 ? (choices[0] === new Date(instant).toISOString() ? "primera" : "segunda") : "";
}
export function displayLeagueTime(instant: string | null) {
  if (!instant) return "Pendiente";
  return new Intl.DateTimeFormat("es-CL", { timeZone: LEAGUE_ZONE, dateStyle: "short", timeStyle: "long" }).format(new Date(instant));
}
export function validateCompetition(form: FormData, editing: boolean) {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};
  const payload: Record<string, number | string | boolean | null> = {};
  const read = (key: string) => {
    const raw = form.get(key);
    if (raw !== null && typeof raw !== "string") errors[key] = "No se permiten archivos en este campo.";
    return values[key] = typeof raw === "string" ? raw.trim() : "";
  };
  if (!editing) {
    const category = read("categoria_temporada_id");
    if (!validId(category)) errors.categoria_temporada_id = "Selecciona una categoría de esta temporada.";
    payload.categoria_temporada_id = Number(category);
  }
  for (const key of ["tarifa_clp"]) {
    const value = read(key);
    const min = key === "tarifa_clp" ? 0 : 1;
    if (value && (!/^\d+$/.test(value) || Number(value) < min || Number(value) > 2147483647)) errors[key] = `Usa un entero entre ${min} y 2147483647, sin puntos ni separadores.`;
    payload[key] = value ? Number(value) : null;
  }
  for (const key of ["inscripcion_abre_en", "inscripcion_cierra_en"]) {
    const local = read(key);
    const choice = read(`${key}_ocurrencia`);
    payload[key] = null;
    if (!local) continue;
    const candidates = santiagoCandidates(local);
    if (!candidates.length) errors[key] = "Fecha/hora inválida o inexistente en America/Santiago por cambio de horario.";
    else if (candidates.length > 1 && !["primera", "segunda"].includes(choice)) errors[key] = "Esta hora ocurre dos veces: selecciona la primera o segunda ocurrencia.";
    else payload[key] = candidates[candidates.length > 1 && choice === "segunda" ? 1 : 0];
  }
  for (const key of ["activo", "publicada", "inscripciones_habilitadas"]) {
    const value = read(key);
    if (!["true", "false"].includes(value)) errors[key] = "Selecciona un estado válido.";
    payload[key] = value === "true";
  }
  if (payload.inscripcion_abre_en && payload.inscripcion_cierra_en && String(payload.inscripcion_abre_en) >= String(payload.inscripcion_cierra_en)) errors.inscripcion_cierra_en = "El cierre debe ser posterior a la apertura.";
  if (payload.publicada && !payload.activo) errors.publicada = "Una competencia inactiva no puede estar publicada.";
  return { payload, values, errors };
}

type RegistrationPeriod = Pick<Competition, "inscripcion_abre_en" | "inscripcion_cierra_en">;

export function competitionTimingIssues(c: RegistrationPeriod, date: Pick<CompetitionDate, "fecha">, sports: SportsControl | null) {
  const errors: Record<string, string> = {};
  const start = sports?.inicio_programado ?? null;
  for (const key of ["inscripcion_abre_en", "inscripcion_cierra_en"] as const) {
    const instant = c[key];
    if (!instant) continue;
    const day = localDateTime(instant).slice(0, 10);
    const label = key === "inscripcion_abre_en" ? "La apertura" : "El cierre";
    if (!day) errors[key] = `${label} no tiene un instante válido.`;
    else if (day > date.fecha) errors[key] = `${label} no puede ser posterior al día de la jornada en America/Santiago.`;
    else if (start && new Date(instant) > new Date(start)) errors[key] = `${label} no puede ser posterior al inicio deportivo programado.`;
  }
  if (c.inscripcion_abre_en && c.inscripcion_cierra_en && new Date(c.inscripcion_abre_en) >= new Date(c.inscripcion_cierra_en)) errors.inscripcion_cierra_en = "El cierre debe ser posterior a la apertura.";
  const sportsIssue = start && localDateTime(start).slice(0, 10) !== date.fecha
    ? "El inicio deportivo no pertenece al día de esta jornada en America/Santiago; requiere revisión del Juez General."
    : null;
  return { errors, sportsIssue };
}

export function journeySummary(competitions: Competition[], controls: SportsControl[]) {
  const approved = new Set(controls.filter(c => c.configuracion_aprobada).map(c => c.competencia_id));
  return {
    configured: competitions.length,
    active: competitions.filter(c => c.activo).length,
    pending: competitions.filter(c => c.activo && !approved.has(c.id)).length,
    published: competitions.filter(c => c.publicada).length,
    enabled: competitions.filter(c => c.inscripciones_habilitadas).length,
  };
}

// Son agrupaciones de inicios, NO intervalos de partidos ni un detector de conflictos.
export function journeyStarts(competitions: Competition[], controls: SportsControl[]) {
  const groups = new Map<number, { instant: string; competitionIds: number[] }>();
  const pending: number[] = [];
  const byId = new Map(controls.map(c => [c.competencia_id, c]));
  for (const competition of competitions.filter(c => c.activo)) {
    const instant = byId.get(competition.id)?.inicio_programado;
    const time = instant ? new Date(instant).getTime() : NaN;
    if (!instant || !Number.isFinite(time)) { pending.push(competition.id); continue; }
    const group = groups.get(time) ?? { instant, competitionIds: [] };
    group.competitionIds.push(competition.id);
    groups.set(time, group);
  }
  return { groups: [...groups.values()].sort((a, b) => new Date(a.instant).getTime() - new Date(b.instant).getTime()), pending };
}

export function openingBlockers(c: Pick<Competition, "activo" | "publicada" | "tarifa_clp" | "inscripcion_abre_en" | "inscripcion_cierra_en">, date: Pick<CompetitionDate, "estado" | "fecha">, sports: SportsControl | null) {
  const reasons: string[] = [];
  if (!sports?.configuracion_aprobada) reasons.push("Falta aprobación deportiva del Juez General.");
  if (sports?.estado_deportivo !== "preparada") reasons.push("La competencia debe estar preparada por el Juez General.");
  if (date.estado !== "publicada") reasons.push("La fecha debe estar publicada.");
  if (!c.activo || !c.publicada) reasons.push("La competencia debe estar activa y publicada.");
  if (c.tarifa_clp === null) reasons.push("La base de datos conserva un requisito heredado pendiente de actualización del esquema. No se pueden habilitar nuevas inscripciones hasta resolverlo.");
  if (!c.inscripcion_abre_en || !c.inscripcion_cierra_en) reasons.push("Faltan los plazos de inscripción.");
  const timing = competitionTimingIssues(c, date, sports);
  return [...new Set([...reasons, ...Object.values(timing.errors), ...(timing.sportsIssue ? [timing.sportsIssue] : [])])];
}
export function competitionError(error: { code?: string; message?: string }) {
  if (error.code === "23505") return "Esta categoría ya está asociada a la fecha. Revisa también las competencias inactivas.";
  if (error.code === "23503") return "La fecha o categoría no existe o pertenece a otra temporada.";
  if (error.code === "42501") return "Tu sesión no está autorizada para modificar competencias.";
  if (error.code === "23514") return "PostgreSQL rechazó el cambio: revisa condiciones administrativas, aprobación deportiva y plazos. Retira la publicación y deshabilita inscripciones antes de modificar condiciones publicadas.";
  return "No se pudo confirmar el guardado. Consulta el listado antes de reintentar.";
}
