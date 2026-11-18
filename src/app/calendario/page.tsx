import type { Metadata } from "next";
import { DateList } from "@/components/date-list";
import Link from "next/link";
import { PublicReadNotice } from "@/components/public-tournament";
import { getPublicTournaments } from "@/lib/public-tournaments";

export const metadata: Metadata = { title: "Calendario" };
export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ temporada?: string }> }) {
  const { data, unavailable } = await getPublicTournaments();
  const requested = (await searchParams).temporada;
  const season = data.temporadas.find(item => String(item.id) === requested) ?? data.temporadas[0];
  const dates = data.jornadas.filter(item => item.temporada_id === season?.id).map(item => ({ ...item, categorias: data.competencias.filter(c => c.fecha_id === item.id).map(c => c.nombre) }));
  return <section className="container-page py-10"><span className="tag">Información pública</span><h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Calendario de competencias</h1><p className="mb-6 mt-3 text-slate-600">Jornadas, categorías y resultados. No necesitas iniciar sesión.</p>
    <nav aria-label="Temporadas" className="mb-6 flex flex-wrap gap-2">{data.temporadas.map(item => <Link key={item.id} href={`/calendario?temporada=${item.id}`} aria-current={item.id === season?.id ? "page" : undefined} className={item.id === season?.id ? "btn-primary" : "btn-secondary"}>{item.nombre}</Link>)}</nav>
    <PublicReadNotice unavailable={unavailable} />{!unavailable && <DateList fechas={dates} />}
  </section>;
}
