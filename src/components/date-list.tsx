import Link from "next/link";
import { CalendarDays, MapPin, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/format";

export type EventDate = {
  id: number;
  numero: number;
  fecha: string;
  comuna: string;
  recinto: string;
  estado: string;
};

export function DateList({ fechas }: { fechas: EventDate[] }) {
  if (fechas.length === 0) {
    return <div className="panel-card text-slate-600">Todavía no hay fechas publicadas. El calendario aparecerá aquí cuando el Administrador las publique.</div>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {fechas.map((item) => (
        <article key={item.id} className="panel-card flex flex-col gap-4">
          <div className="flex items-center justify-between"><span className="tag">Fecha {item.numero}</span><CalendarDays size={19} className="text-slate-400" aria-hidden="true" /></div>
          <h3 className="text-lg font-bold">{formatDate(item.fecha)}</h3>
          <div className="flex items-start gap-2 text-sm text-slate-600"><MapPin size={16} className="mt-0.5 shrink-0" /> <span>{item.recinto} · {item.comuna}</span></div>
          <Link href="/calendario" className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-brand">Ver calendario <ArrowRight size={15} /></Link>
        </article>
      ))}
    </div>
  );
}
