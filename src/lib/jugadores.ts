import { validId, type CatalogState } from "@/lib/catalogos";

export const PLAYERS_PATH = "/panel/administrador/jugadores";
export const PLAYER_COLUMNS = "id,nombre_completo,fecha_nacimiento,localidad_procedencia_id,club_id,perfil_id,activo";
export type PlayerInput = {
  nombre_completo: string;
  fecha_nacimiento: string | null;
  localidad_procedencia_id: number | null;
  club_id: number | null;
  perfil_id: string | null;
  activo: boolean;
};
export type PlayerRecord = PlayerInput & { id: number };
export type PlayerState = CatalogState;

export function todayInChile(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function validBirthDate(value: string, today = todayInChile()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] && value <= today;
}

export function validatePlayer(formData: FormData, today = todayInChile()) {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const name of ["nombre_completo", "fecha_nacimiento", "localidad_procedencia_id", "club_id", "perfil_id", "activo"]) {
    const raw = formData.get(name);
    values[name] = typeof raw === "string" ? raw.trim() : "";
    if (raw !== null && typeof raw !== "string") errors[name] = "El valor no es válido.";
  }
  if (!values.nombre_completo || values.nombre_completo.length > 160) errors.nombre_completo = "Ingresa un nombre completo de 1 a 160 caracteres.";
  if (values.fecha_nacimiento && !validBirthDate(values.fecha_nacimiento, today)) errors.fecha_nacimiento = "Ingresa una fecha real que no sea posterior a hoy, o deja el campo vacío.";
  for (const name of ["localidad_procedencia_id", "club_id"]) {
    if (values[name] && !validId(values[name])) errors[name] = "Selecciona una opción válida.";
  }
  if (values.perfil_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(values.perfil_id)) errors.perfil_id = "Selecciona una cuenta existente.";
  if (!["true", "false"].includes(values.activo)) errors.activo = "Selecciona el estado del jugador.";
  // Lista explícita: nunca escribir id, creado_en, rol ni otros campos del cliente.
  const payload: PlayerInput = {
    nombre_completo: values.nombre_completo,
    fecha_nacimiento: values.fecha_nacimiento || null,
    localidad_procedencia_id: values.localidad_procedencia_id ? Number(values.localidad_procedencia_id) : null,
    club_id: values.club_id ? Number(values.club_id) : null,
    perfil_id: values.perfil_id.toLowerCase() || null,
    activo: values.activo === "true",
  };
  return { values, errors, payload };
}

export function playerError(code?: string) {
  if (code === "23505") return "La cuenta seleccionada ya está vinculada a otro jugador. Los nombres iguales sí están permitidos.";
  if (code === "23503") return "La localidad, el club o la cuenta seleccionada ya no existe. Actualiza las opciones e inténtalo nuevamente.";
  if (code === "42501") return "No tienes permisos para guardar. Comprueba tu sesión de Administrador y las políticas RLS.";
  if (["23514", "22001", "22007", "22008", "22P02"].includes(code ?? "")) return "Los datos no cumplen las restricciones. Revisa el nombre, la fecha y las relaciones seleccionadas.";
  return "No se pudo guardar el jugador. Comprueba la conexión y los permisos de Supabase e inténtalo nuevamente.";
}
