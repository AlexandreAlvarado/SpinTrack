"use server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { proposeSchedule, type Allocation, type ScheduleData } from "@/lib/programacion";

export type ScheduleState = { error?: string; success?: string; proposal?: Allocation[]; warnings?: string[]; rest?: number };
const integer = (value: FormDataEntryValue | null) => typeof value === "string" && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : NaN;
const uuid = (s: unknown) => typeof s === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
export async function manageSchedule(_previous: ScheduleState, form: FormData): Promise<ScheduleState> {
  await requireRole("juez_general");
  const date = integer(form.get("fecha_id")), operation = String(form.get("operacion"));
  if (!(date > 0)) return { error: "Selecciona una jornada válida." };
  const db = await createClient();
  const reason = String(form.get("motivo") ?? "").trim();
  const rest = integer(form.get("descanso"));
  try {
    let result;
    if (operation === "proponer") {
      const snapshot = await db.rpc("consultar_programacion_027", { p_fecha_id: date });
      if (snapshot.error) throw snapshot.error;
      const available = form.getAll("arbitros").map(String);
      const proposal = proposeSchedule(snapshot.data as ScheduleData, String(form.get("inicio")), integer(form.get("duracion")), rest, available);
      return { proposal: proposal.proposal, warnings: proposal.warnings, rest, success: proposal.proposal.length ? "Propuesta lista para revisar y confirmar." : "No hay asignaciones posibles para esta tanda." };
    }
    if (operation === "mesa") {
      const number = integer(form.get("numero")), status = String(form.get("estado"));
      if (!(number > 0) || !["disponible", "fuera_servicio"].includes(status)) return { error: "Indica número y estado de la mesa." };
      result = await db.rpc("gestionar_mesa_027", { p_fecha_id: date, p_numero: number, p_estado: status });
    } else {
      if (!reason || reason.length > 1000) return { error: "Indica un motivo de hasta 1000 caracteres." };
      if (operation === "confirmar") {
        if (form.get("revisada") !== "on") return { error: "Revisa y confirma expresamente las asignaciones." };
        const raw = String(form.get("asignaciones") ?? "");
        if (raw.length > 100000) return { error: "Propuesta demasiado extensa." };
        const allocations = JSON.parse(raw);
        if (!Array.isArray(allocations) || !allocations.length || allocations.length > 100 || !Number.isInteger(rest) || rest < 0 || rest > 1440) return { error: "Propuesta o descanso inválido." };
        for (const row of allocations) {
          if (!row || !["grupo", "eliminatoria"].includes(row.tipo) || !Number.isSafeInteger(row.partido) || row.partido < 1 || !Number.isSafeInteger(row.mesa_id) || row.mesa_id < 1 || !uuid(row.arbitro_id) || !/T.*(Z|[+-]\d{2}:\d{2})$/.test(row.inicio) || !/T.*(Z|[+-]\d{2}:\d{2})$/.test(row.fin) || !Number.isFinite(Date.parse(row.inicio)) || !Number.isFinite(Date.parse(row.fin)) || Date.parse(row.fin) <= Date.parse(row.inicio) || Date.parse(row.fin) - Date.parse(row.inicio) > 86400000) return { error: "Asignación inválida: revisa participantes, mesa e intervalo." };
        }
        result = await db.rpc("confirmar_programacion_027", { p_fecha_id: date, p_asignaciones: allocations, p_descanso: rest, p_motivo: reason });
      } else if (["comenzar", "liberar"].includes(operation)) {
        const id = integer(form.get("reserva_id")), version = integer(form.get("version"));
        if (!(id > 0) || !(version > 0)) return { error: "Reserva inválida." };
        result = await db.rpc("operar_reserva_027", { p_id: id, p_version: version, p_operacion: operation, p_motivo: reason });
      } else return { error: "Acción no válida." };
    }
    if (result.error) throw result.error;
    revalidatePath("/panel/juez-general/programacion");
    revalidatePath("/panel/juez-general/partidos");
    revalidatePath("/panel/juez-general/clasificacion");
    return { success: "Cambio confirmado. Recursos y estado deportivo validados." };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (["42883", "42P01", "PGRST202", "PGRST205"].includes(code)) return { error: "Mesas y programación requiere la migración 027 y sus dependencias, pendiente de aplicación manual." };
    return { error: "No se confirmó el cambio. Recarga: puede haber una mesa o persona ocupada, participantes pendientes, un resultado en revisión o una reserva modificada." };
  }
}
