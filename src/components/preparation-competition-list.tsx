import Link from "next/link";
import { preparationLock } from "@/lib/preparacion-deportiva";
import { displayLeagueTime, type Competition } from "@/lib/competencias";
import type { Preparation, StageFormat } from "@/lib/preparacion-deportiva";

type Row = { competition: Competition; label: string; record: Preparation | null; formats: StageFormat[]; blockers: string[]; advancedHref: string };

export function PreparationCompetitionList({ rows }: { rows: Row[] }) {
  return <section aria-label="Competencias individuales" className="grid gap-3">
    <h3 className="text-lg font-bold">Competencias individuales ({rows.length})</h3>
    {rows.map(row => {
      const lock = preparationLock(row.competition, row.record);
      const approved = !!row.record?.configuracion_aprobada;
      const status = approved ? "Aprobada · solo lectura" : lock ? "Bloqueada" : row.blockers.length ? "Requisitos pendientes" : "Lista para aprobar";
      return <article className="panel-card" key={row.competition.id}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h4 className="font-bold">{row.label}</h4><p className="text-sm text-slate-600">#{row.competition.id} · Inicio: {displayLeagueTime(row.record?.inicio_programado ?? null)} · Estado: {status}</p></div>
          <Link className="btn-secondary shrink-0" href={row.advancedHref}>{approved ? "Ver configuración" : "Configurar"}</Link>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-3"><span>Mínimo: {row.record?.minimo_participantes ?? "Pendiente"}</span><span>Grupos: {row.record?.grupo_minimo ?? "—"}–{row.record?.grupo_maximo ?? "—"}</span><span>Sets guardados: {row.formats.length}/5</span></div>
        {lock && <p className="mt-2 text-sm text-amber-800">{lock}</p>}
        {row.blockers.length > 0 && <details className="mt-2 text-sm"><summary>Requisitos pendientes ({row.blockers.length})</summary><ul className="mt-1 list-inside list-disc">{row.blockers.map(reason => <li key={reason}>{reason}</li>)}</ul></details>}
      </article>;
    })}
  </section>;
}

