"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";
import { parseSetInputs } from "@/lib/resultados";
import { KNOCKOUT_PAGE_SIZE, type KnockoutPage, type OperativeMatch, type KnockoutAct, type KnockoutEvent } from "@/lib/eliminatorias-operacion";
import type { ResultState } from "@/app/panel/juez-general/resultados/actions";

function operationError(code: string | undefined, message: string | undefined, operation: string): string {
  const detail = (message ?? "").toLowerCase();
  if (operation === "preparar_asignar" && ["42883", "PGRST202"].includes(code ?? "")) return "La asignación directa requiere que la migración 020 esté instalada.";
  if (code === "42501" || detail.includes("solo juez") || detail.includes("permiso")) return "Tu cuenta no tiene permiso de Juez General para asignar este árbitro.";
  if (code === "23514" && (detail.includes("autoarbitraje") || detail.includes("árbitro"))) return "Ese árbitro es un participante o no cumple las restricciones de arbitraje.";
  if (code === "55000" && (detail.includes("formato") || detail.includes("respaldo"))) return "Falta configurar el respaldo de la final al mejor de 5 en Preparar competencia.";
  if (code === "55000" && (detail.includes("autoriz") || detail.includes("final oficial"))) return "La final todavía no está autorizada para iniciar.";
  if (code === "55000" && detail.includes("asignación")) return "El árbitro ya tiene una asignación incompatible o la final ya tiene otro árbitro.";
  if (code === "22023") return "La solicitud de asignación contiene datos incompletos.";
  if (code === "23505") return "La asignación ya existe. Recarga la final antes de volver a intentarlo.";
  return "No se pudo asignar el árbitro. Recarga la final y revisa su autorización y formato de sets.";
}

export async function loadKnockoutPage(key: number | null, round: number, page: number): Promise<KnockoutPage> {
  const profile = await requireProfile();
  const empty: KnockoutPage = { matches: [], more: false, acts: [], history: [], players: [], referees: [], champion: null, finalist: null, state: null, authorized: false };
  if ((!profile.arbitrajeHabilitado && profile.rol !== "juez_general") || !Number.isSafeInteger(page) || page < 0 || page > Math.floor(Number.MAX_SAFE_INTEGER / KNOCKOUT_PAGE_SIZE) || !Number.isSafeInteger(round) || round < 1 || (key !== null && !validId(String(key))) || (profile.rol === "juez_general" && key === null)) return { ...empty, error: "Consulta inválida." };
  try {
    const db = await createClient();
    let request = db.from("eliminatorias_partidos").select("*").order("id");
    if ((profile.arbitrajeHabilitado && profile.rol !== "juez_general")) request = request.eq("arbitro_id", profile.id);
    else request = request.eq("llave_id", key!).eq("ronda_numero", round);
    const response = await request.range(page * KNOCKOUT_PAGE_SIZE, (page + 1) * KNOCKOUT_PAGE_SIZE);
    if (response.error) throw response.error;
    const matches = (response.data ?? []) as OperativeMatch[];
    const more = matches.length > KNOCKOUT_PAGE_SIZE;
    matches.splice(KNOCKOUT_PAGE_SIZE);
    const ids = matches.map(m => m.id);
    const read = async <T,>(table: string, field: string, values: number[]): Promise<T[]> => {
      if (!values.length) return [];
      const all: T[] = [];
      for (let offset = 0;; offset += 500) {
        const result = await db.from(table).select("*").in(field, values).order("id").range(offset, offset + 499);
        if (result.error) throw result.error;
        all.push(...result.data as T[]);
        if (result.data.length < 500) return all;
      }
    };
    const [acts, history] = await Promise.all([read<KnockoutAct>("eliminatorias_actas", "partido_id", ids), read<KnockoutEvent>("eliminatorias_eventos", "partido_id", ids)]);
    let champion: number | null = null, finalist: number | null = null, state: string | null = null, authorized = false, authorizationIssue: string | undefined;
    const referees: KnockoutPage["referees"] = [];
    if (profile.rol === "juez_general") {
      const keyMeta = await db.from("eliminatorias_llaves").select("competencia_id,propuesta").eq("id", key!).maybeSingle();
      if (keyMeta.error || !keyMeta.data) throw keyMeta.error ?? new Error("Llave no encontrada");
      const [board, backing, format, supplemental] = await Promise.all([
        db.from("eliminatorias_cuadros").select("campeon_id,finalista_id,estado").eq("llave_id", key!).maybeSingle(),
        db.from("eliminatorias_respaldos").select("llave_id").eq("llave_id", key!).maybeSingle(),
        db.from("competencia_formatos_sets").select("mejor_de,referencia_resolucion").eq("competencia_id", keyMeta.data.competencia_id).eq("etapa", "final").maybeSingle(),
        db.from("competencia_formato_final_021").select("mejor_de,referencia_resolucion").eq("competencia_id", keyMeta.data.competencia_id).maybeSingle(),
      ]);
      if (board.error || backing.error || format.error || (supplemental.error && supplemental.error.code !== "42P01")) throw board.error ?? backing.error ?? format.error ?? supplemental.error;
      champion = board.data?.campeon_id ?? null; finalist = board.data?.finalista_id ?? null; state = board.data?.estado ?? null; authorized = !!backing.data;
      if (!backing.data) { authorized = false; authorizationIssue = "Falta el respaldo documental de la llave; requiere revisión administrativa excepcional."; }
      const isSingleFinal = keyMeta.data.propuesta?.version_regla === 19 && keyMeta.data.propuesta?.posiciones === 2;
      if (isSingleFinal && (format.data?.mejor_de !== 5 || !(format.data.referencia_resolucion?.trim() || supplemental.data?.mejor_de === 5 && supplemental.data.referencia_resolucion?.trim()))) { authorized = false; authorizationIssue = "Falta el formato final al mejor de 5 o su referencia deportiva; requiere revisión administrativa excepcional."; }
      for (let offset = 0;; offset += 500) {
        const result = await db.from("perfiles").select("id,nombre_completo").eq("arbitraje_habilitado", true).order("id").range(offset, offset + 499);
        if (result.error) throw result.error;
        referees.push(...result.data);
        if (result.data.length < 500) break;
      }
    }
    const playerIds = [...new Set([...matches.flatMap(m => [m.jugador_a_id, m.jugador_b_id]), champion, finalist].filter((id): id is number => id !== null))];
    const players = await read<KnockoutPage["players"][number]>("jugadores", "id,nombre_completo,perfil_id", playerIds);
    return { matches, more, acts, history, players, referees, champion, finalist, state, authorized, authorizationIssue };
  } catch (error) {
    console.warn("[eliminatorias-018] lectura", error);
    return { ...empty, error: "No se pudo consultar el cuadro completo de esta página. Revisa la aplicación manual de 017/018 y vuelve a intentar." };
  }
}

export async function operateKnockout(_previous: ResultState, form: FormData): Promise<ResultState> {
  const profile = await requireProfile();
  const text = (key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
  const operation = text("operacion"), match = text("partido_id"), key = text("llave_id"), revision = Number(text("revision"));
  const refereeOperations = ["capturar", "comenzar"];
  if (!((profile.arbitrajeHabilitado && refereeOperations.includes(operation)) || (profile.rol === "juez_general" && ["iniciar", "asignar", "preparar_asignar", "confirmar", "observar"].includes(operation)))) return { error: "Operación no autorizada para tu rol." };
  let reference = operation === "observar" ? text("observacion") : text("referencia");
  if (!reference && ["iniciar", "asignar", "preparar_asignar", "comenzar"].includes(operation)) reference = operation === "iniciar" ? `Inicio operativo de llave ${key}` : operation === "asignar" ? `Asignación de árbitro para partido ${match}` : operation === "preparar_asignar" ? `Preparación y asignación de árbitro para llave ${key}` : `Inicio de partido ${match}`;
  if (!reference || reference.length > (operation === "observar" ? 2000 : 1000) || ((operation === "iniciar" || operation === "preparar_asignar") ? !validId(key) : !validId(match)) || !Number.isInteger(revision) || revision < 0 || revision > 2147483647) return { error: "Revisa identificador, revisión y referencia." };
  if (operation === "confirmar" && form.get("revision_confirmada") !== "on") return { error: "Revisa expresamente el resultado." };
  const db = await createClient();
  // PostgreSQL exige además el respaldo manual por llave: no se acepta desde el formulario.
  let sets = null;
  if (operation === "capturar") {
    if (revision > 0) {
      const motive = text("motivo");
      if (!motive || motive.length > 500) return { error: "La corrección requiere un motivo de hasta 500 caracteres." };
      reference = `${reference} · Corrección: ${motive}`;
      if (reference.length > 1000) return { error: "Acorta la referencia y el motivo de corrección." };
    }
    if (text("tipo") !== "ordinario") return { error: "Las incidencias eliminatorias requieren una resolución deportiva específica; no se avanza automáticamente." };
    const parsed = parseSetInputs(Array.from({ length: 5 }, (_, i) => ({ a: text(`a_${i}`), b: text(`b_${i}`) })));
    if ("error" in parsed) return parsed;
    sets = parsed;
  }
  const referee = text("arbitro_id");
  if (["asignar", "preparar_asignar"].includes(operation) && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(referee)) return { error: "Selecciona un Árbitro." };
  const response = operation === "preparar_asignar"
    ? await db.rpc("preparar_asignar_final_eliminatoria_020", { p_llave_id: Number(key), p_arbitro_id: referee, p_referencia: reference })
    : operation === "iniciar"
    ? await db.rpc("iniciar_eliminatoria_018", { p_llave_id: Number(key), p_referencia: reference })
    : await db.rpc("operar_eliminatoria_018", { p_partido_id: Number(match), p_operacion: operation === "capturar" ? "enviar" : operation, p_revision: revision, p_referencia: reference, p_arbitro_id: referee || null, p_sets: sets });
  if (response.error) {
    console.warn("[eliminatorias-018] operación rechazada", { code: response.error.code, message: response.error.message, operation });
    return { error: operationError(response.error.code, response.error.message, operation) };
  }
  for (const route of ["/panel/juez-general/clasificacion", "/panel/arbitro/resultados"]) revalidatePath(route);
  return { success: operation === "confirmar" ? "Resultado oficial confirmado; avance y eliminación registrados." : operation === "capturar" ? "Resultado enviado para revisión; todavía no es oficial." : "Operación registrada." };
}
