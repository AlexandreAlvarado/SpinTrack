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
  categorias?: string[];
};

export function DateList({ fechas }: { fechas: EventDate[] }) {
  if (fechas.length === 0) {
    return <div className="empty-state">Todavía no hay fechas publicadas.</div>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {fechas.map((item) => (
        <article key={item.id} className="panel-card flex flex-col gap-4">
          <div className="flex items-center justify-between"><span className="tag">Fecha {item.numero}</span><CalendarDays size={19} className="text-slate-400" aria-hidden="true" /></div>
          <h3 className="text-lg font-bold">{formatDate(item.fecha)}</h3>
          <p className="text-sm font-semibold text-brand">{item.estado === "finalizada" ? "Finalizada" : "Publicada"}</p>
          <div className="flex items-start gap-2 text-sm text-slate-600"><MapPin size={16} className="mt-0.5 shrink-0" /> <span>{item.recinto} · {item.comuna}</span></div>
          {item.categorias && <p className="text-sm text-slate-600">{item.categorias.length ? item.categorias.join(" · ") : "Categorías por publicar"}</p>}
          <Link href={`/calendario/${item.id}`} className="mt-auto inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand">Ver categorías y resultados <ArrowRight size={15} /></Link>
        </article>
      ))}
    </div>
  );
}
