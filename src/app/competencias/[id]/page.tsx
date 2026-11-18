import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicBracket, PublicMatchCard, PublicReadNotice } from "@/components/public-tournament";
import { getPublicTournaments, publicState } from "@/lib/public-tournaments";
import { formatDate } from "@/lib/format";
import { PublicLiveRefresh } from "@/components/public-live-refresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "Competencia y resultados" };

export default async function CompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  const { data, unavailable } = await getPublicTournaments(Number(id));
  const competition = data.competencias.find(item => String(item.id) === id);
  const journey = data.jornadas.find(item => item.id === competition?.fecha_id);
  if ((!competition || !data.detalle) && !unavailable) notFound();
  if (!competition || !data.detalle || !journey) return <section className="container-page py-10"><PublicReadNotice unavailable={unavailable} /></section>;
  return <section className="container-page min-w-0 space-y-7 py-8">
    <PublicLiveRefresh />
    <Link href={`/calendario/${journey.id}`} className="inline-flex min-h-11 items-center font-semibold text-brand">← Jornada {journey.numero}</Link>
    <header><span className="tag">{publicState(competition.estado)}</span><h1 className="mt-3 text-3xl font-extrabold">{competition.nombre}</h1><p className="mt-3 text-slate-600">{formatDate(journey.fecha)} · {journey.recinto} · {journey.comuna}</p></header>
    <nav aria-label="Secciones de competencia" className="flex flex-wrap gap-3"><a className="btn-secondary" href="#grupos">Grupos y resultados</a><a className="btn-secondary" href="#eliminatorias">Eliminatorias</a></nav>
    {competition.campeon && <section className="panel-card border-t-4 border-t-success" aria-label="Podio"><h2 className="text-xl font-bold">Campeón: {competition.campeon}</h2><p className="mt-2 text-slate-600">Subcampeón: {competition.subcampeon}</p></section>}
    <section id="grupos" className="space-y-4"><h2 className="text-2xl font-bold">Grupos y resultados</h2>
      {!data.detalle.grupos.length && <p className="empty-state">Los grupos aparecerán cuando estén confirmados.</p>}
      {data.detalle.grupos.map(group => <article key={group.numero} className="panel-card min-w-0 space-y-4"><h3 className="text-xl font-bold">Grupo {group.numero}</h3>
        <p className="text-sm text-slate-600">{group.jugadores.join(" · ")}</p>
        {group.clasificacion.length ? <><h4 className="font-semibold">Clasificación aprobada</h4><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Clasificación aprobada del grupo {group.numero}</caption><thead><tr>{["Pos.", "Jugador", "PJ", "PG", "PP", "SF", "SC"].map(label => <th key={label} scope="col" className="whitespace-nowrap p-2">{label}</th>)}</tr></thead><tbody>{group.clasificacion.map((row,index) => <tr key={index} className={`border-t border-slate-100 ${index < 2 ? "bg-emerald-50" : ""}`}><td className="p-2">{index+1}</td><th scope="row" className="min-w-36 p-2 font-medium">{row.nombre}{index < 2 && <span className="block text-xs text-emerald-800">Clasificado</span>}</th>{[row.pj,row.pg,row.pp,row.sf,row.sc].map((value,i) => <td key={i} className="p-2">{value}</td>)}</tr>)}</tbody></table></div><p className="text-xs text-slate-600">PJ: jugados · PG: ganados · PP: perdidos · SF/SC: sets a favor/en contra.</p></> : <p className="text-sm text-slate-600">Clasificación pendiente de aprobación.</p>}
        <h4 className="font-semibold">Partidos</h4>{group.partidos.length ? <div className="grid gap-3 md:grid-cols-2">{group.partidos.map(match => <PublicMatchCard key={match.numero} match={match} />)}</div> : <p className="text-sm text-slate-600">Aún no hay partidos confirmados en la programación.</p>}
      </article>)}
    </section>
    <section id="eliminatorias" className="space-y-4"><h2 className="text-2xl font-bold">Eliminatorias</h2><PublicBracket rounds={data.detalle.rondas} /></section>
    <p className="text-xs text-slate-500">Los resultados confirmados se actualizan automáticamente.</p>
  </section>;
}
