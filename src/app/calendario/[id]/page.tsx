import Link from "next/link";
import { notFound } from "next/navigation";
import { CompetitionCards, PublicReadNotice } from "@/components/public-tournament";
import { getPublicTournaments, publicState } from "@/lib/public-tournaments";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jornada y categorías" };

export default async function JourneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  const { data, unavailable } = await getPublicTournaments();
  const journey = data.jornadas.find(item => String(item.id) === id);
  if (!journey && !unavailable) notFound();
  return <section className="container-page space-y-6 py-10"><Link href="/calendario" className="inline-flex min-h-11 items-center font-semibold text-brand">← Calendario</Link>
    <PublicReadNotice unavailable={unavailable} />{journey && <><header><span className="tag">{publicState(journey.estado)}</span><h1 className="mt-3 text-3xl font-extrabold">Jornada {journey.numero}</h1><p className="mt-3 text-slate-600">{formatDate(journey.fecha)} · {journey.recinto} · {journey.comuna}</p></header><h2 className="text-xl font-bold">Categorías</h2><CompetitionCards competitions={data.competencias.filter(item => item.fecha_id === journey.id)} /></>}
  </section>;
}
