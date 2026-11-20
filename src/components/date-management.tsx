"use client";
import { useActionState, useState } from "react";
import { manageDate, type DateManagementState } from "@/app/panel/administrador/jornadas/actions";

const labels: Record<string, string> = { fechas: "Jornadas", competencias: "Competencias", participantes_competencia: "Participantes", grupos_competencia: "Grupos", grupo_participantes: "Jugadores en grupos", partidos: "Partidos de grupos", eliminatorias_partidos: "Partidos de eliminatorias", resultados_partidos: "Resultados enviados", eliminatorias_actas: "Actas de eliminatorias", mesas_jornada: "Mesas", programacion_reservas: "Reservas de mesa" };
export function DateManagement({ id }: { id: number }) {
  const [state, action, pending] = useActionState<DateManagementState, FormData>(manageDate, {});
  const [second, setSecond] = useState(false);
  const review = state.review;
  const counts = { competencias: 0, participantes_competencia: 0, grupos_competencia: 0, partidos: 0, eliminatorias_partidos: 0, resultados_partidos: 0, ...review?.dependencias };
  return <section className="panel-card mt-5 space-y-4">
    <h2 className="text-xl font-bold">Gestión de jornada</h2>
    <form action={action}><input type="hidden" name="fecha_id" value={id}/><input type="hidden" name="operacion" value="revisar"/><button className="btn-secondary" disabled={pending} onClick={() => setSecond(false)}>1. Revisar jornada y dependencias</button></form>
    {state.error && <p role="alert" className="text-red-700">{state.error}</p>}{state.success && <p role="status" className="text-green-800">{state.success}</p>}
    {review && <>
      <p><strong>Jornada {review.jornada.numero}</strong> · {review.jornada.fecha} · {review.jornada.estado}{review.jornada.archivada ? " · Archivada" : ""}</p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">{Object.entries(counts).map(([table, count]) => <div key={table}><dt className="inline font-semibold">{labels[table] ?? table.replaceAll("_", " ")}: </dt><dd className="inline">{count}</dd></div>)}</dl>
      <p className="text-sm">{review.protegida ? "Existen registros deportivos o históricos protegidos. La eliminación está bloqueada; puedes archivar conservando los datos y su consulta histórica." : "Eliminar retirará definitivamente la jornada y las configuraciones relacionadas indicadas. No elimina jugadores ni cuentas. La operación no puede deshacerse."}</p>
      <form action={action} className="flex flex-wrap gap-3"><input type="hidden" name="fecha_id" value={id}/><input type="hidden" name="token" value={review.token}/><input type="hidden" name="revisada" value="on"/><button className="btn-secondary" name="operacion" value="archivar" disabled={pending || review.jornada.archivada}>Archivar conservando historial</button>{!review.protegida && review.jornada.estado === "publicada" && <button className="btn-secondary" name="operacion" value="despublicar" disabled={pending}>Despublicar</button>}</form>
      {!review.protegida && !second && <button className="btn-secondary" onClick={() => setSecond(true)}>Continuar a segunda confirmación de eliminación</button>}
      {!review.protegida && second && <form action={action} className="space-y-3 rounded-xl border border-red-200 p-4"><input type="hidden" name="fecha_id" value={id}/><input type="hidden" name="token" value={review.token}/><input type="hidden" name="operacion" value="eliminar"/><input type="hidden" name="revisada" value="on"/><label className="form-label">2. Escribe literalmente ELIMINAR JORNADA {review.jornada.numero}<input className="input" name="frase" required autoComplete="off"/></label><button className="btn-primary" disabled={pending}>Eliminar definitivamente la jornada</button></form>}
    </>}
  </section>;
}
