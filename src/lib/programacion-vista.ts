import type { ScheduleData, Table } from "./programacion";

/** Presentación de la fotografía existente; no cambia la elegibilidad deportiva. */
export function schedulingOverview(data: ScheduleData, now: number) {
  const active = data.reservas.filter(r => !["liberada", "cancelada"].includes(r.estado));
  const tableState = (table: Table) => table.estado === "fuera_servicio" ? "fuera_servicio" : active.some(r => r.mesa_id === table.id &&
    (["en_juego", "revision"].includes(r.estado) || Date.parse(r.inicio) <= now && now < Date.parse(r.fin))) ? "ocupada" : "disponible";
  const pending = data.partidos.filter(m => m.estado !== "confirmado" && !active.some(r => r.tipo === m.tipo && r.partido === m.id));
  const confirmed = data.partidos.filter(m => m.estado === "confirmado").length;
  return {
    active, pending, confirmed, tableState,
    total: data.mesas.length,
    available: data.mesas.filter(t => tableState(t) === "disponible").length,
    occupied: data.mesas.filter(t => tableState(t) === "ocupada").length,
    unavailable: data.mesas.filter(t => tableState(t) === "fuera_servicio").length,
    allConfirmed: data.partidos.length > 0 && confirmed === data.partidos.length,
  };
}
