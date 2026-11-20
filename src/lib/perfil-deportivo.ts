import { validBirthDate } from "./jugadores";
import { validId } from "./catalogos";

export function validateSportsProfile(form: FormData) {
  const fields = ["jugador_id", "fecha_nacimiento", "club_id", "localidad_procedencia_id"] as const;
  const values = Object.fromEntries(fields.map(key => [key, form.get(key)]));
  if (fields.some(key => typeof values[key] !== "string")) return null;
  const text = Object.fromEntries(fields.map(key => [key, (values[key] as string).trim()]));
  if (!validId(text.jugador_id) || (text.fecha_nacimiento && !validBirthDate(text.fecha_nacimiento)) ||
      [text.club_id, text.localidad_procedencia_id].some(value => value && !validId(value))) return null;
  let expected: unknown;
  try { expected = JSON.parse(String(form.get("esperado"))); } catch { return null; }
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) return null;
  const snapshot = expected as Record<string, unknown>;
  const editable = ["fecha_nacimiento", "club_id", "localidad_procedencia_id"];
  if (Object.keys(snapshot).length !== 3 || editable.some(key => !Object.hasOwn(snapshot, key))) return null;
  if (snapshot.fecha_nacimiento !== null && (typeof snapshot.fecha_nacimiento !== "string" || !validBirthDate(snapshot.fecha_nacimiento))) return null;
  if ([snapshot.club_id, snapshot.localidad_procedencia_id].some(value => value !== null && (!Number.isSafeInteger(value) || Number(value) <= 0))) return null;
  if (editable.some(key => snapshot[key] !== null && !text[key])) return null;
  return {
    p_jugador_id: Number(text.jugador_id), p_fecha_nacimiento: text.fecha_nacimiento || null,
    p_club_id: text.club_id ? Number(text.club_id) : null,
    p_localidad_id: text.localidad_procedencia_id ? Number(text.localidad_procedencia_id) : null,
    p_esperado: expected,
  };
}
