import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Trophy, Users, HeartHandshake, GraduationCap } from "lucide-react";
import { DateList } from "@/components/date-list";
import { getPublicTournaments, homeSchedule } from "@/lib/public-tournaments";
import { CompetitionCards, PublicReadNotice } from "@/components/public-tournament";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { data, unavailable } = await getPublicTournaments();
  const schedule = homeSchedule(data);
  const fechas = schedule.upcoming.map(item => ({ ...item, categorias: data.competencias.filter(c => c.fecha_id === item.id).map(c => c.nombre) }));
  const champions = data.competencias.filter(item => item.campeon).sort((a,b) => (data.jornadas.find(j => j.id === b.fecha_id)?.fecha ?? "").localeCompare(data.jornadas.find(j => j.id === a.fecha_id)?.fecha ?? "")).slice(0,6);
  return <>
    <section className="relative overflow-hidden bg-brand text-white" aria-labelledby="liga-title">
      <div className="container-page grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:py-20">
        <div>
          <p className="mb-5 flex items-center gap-2 text-sm font-semibold text-blue-100"><span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />Liga Regional · {schedule.season?.nombre ?? "Temporada por confirmar"}</p>
          <h1 id="liga-title" className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">El tenis de mesa que une a <span className="text-sky">Los Ríos.</span></h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-100 sm:text-lg">Sigue las jornadas, consulta los resultados y acompaña a los jugadores hasta la final.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/calendario" className="btn-secondary">Ver calendario <CalendarDays size={18} aria-hidden="true" /></Link><Link href="/ranking" className="btn-secondary border-sky bg-transparent text-white hover:bg-white/10">Consultar ranking <ArrowRight size={18} aria-hidden="true" /></Link></div>
        </div>
        <aside className="hidden rounded-2xl border border-white/20 bg-white/5 p-6 sm:block sm:p-8" aria-label="Propósito de la Liga">
          <Trophy size={32} className="text-accent" aria-hidden="true" />
          <h2 className="mt-5 text-2xl font-bold">Una región. Un deporte. Una comunidad.</h2>
          <p className="mt-4 leading-7 text-blue-100">Fortalecer el tenis de mesa desde sus etapas formativas y abrir espacios para crecer a través de la competencia.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-white/10 px-3 py-2">Formación</span><span className="rounded-full bg-white/10 px-3 py-2">Respeto</span><span className="rounded-full bg-white/10 px-3 py-2">Cooperación</span></div>
        </aside>
      </div>
    </section>
    <section className="container-page space-y-6 py-8" aria-label="Sigue el torneo">
      <PublicReadNotice unavailable={unavailable} />
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold">Competencias y resultados</h2><Link href="/calendario" className="btn-primary">Elegir jornada →</Link></div>
      {!unavailable && <div><h3 className="mb-3 text-xl font-bold">Próximas jornadas</h3>{fechas.length ? <DateList fechas={fechas} /> : <p className="empty-state">No hay próximas jornadas publicadas.</p>}</div>}
      {schedule.latest ? <div><h3 className="mb-3 font-bold">Jornada más reciente</h3><DateList fechas={[schedule.latest]} /></div> : !unavailable && <p className="text-sm text-slate-600">Todavía no hay jornadas disputadas publicadas.</p>}
      {champions.length > 0 && <div><h3 className="mb-3 text-xl font-bold">Últimos campeones</h3><CompetitionCards competitions={champions} /></div>}
    </section>
    <section className="container-page py-12 sm:py-16" aria-labelledby="about-title">
      <span className="tag">Nuestra Liga</span><h2 id="about-title" className="mt-3 text-3xl font-bold">Formarse, competir y encontrarse.</h2>
      <p className="mt-4 max-w-3xl leading-7 text-slate-600">La Liga Deportiva Regional de Tenis de Mesa Los Ríos organiza, junto a sus clubes miembros e invitados, un espacio de desarrollo deportivo basado en el respeto y la cooperación.</p>
      <div className="mt-7 grid gap-5 md:grid-cols-3">
        {[{ icon: GraduationCap, title: "Un espacio para aprender", body: "Instancias de competencia para niveles aficionados, formativos, intermedios y avanzados, de acuerdo con las categorías y habilitaciones de las Bases." }, { icon: HeartHandshake, title: "Competir con respeto", body: "Jornadas que buscan un alto nivel deportivo y relaciones humanas basadas en el respeto y la cooperación." }, { icon: Users, title: "Una organización regional", body: "Las Bases 2026 reúnen a clubes organizadores de Futrono, Paillaco, Panguipulli, Lago Ranco y La Unión." }].map(({ icon: Icon, title, body }) => <article key={title} className="panel-card"><Icon className="mb-5 text-brand" size={28} aria-hidden="true" /><h3 className="text-lg font-bold">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{body}</p></article>)}
      </div>
      <p className="mt-4 text-xs text-slate-500">Fuente: Bases de la Liga Regional 2026, Organización, Objetivos y Participantes. Las comunas de los clubes organizadores no representan sedes o fechas confirmadas.</p>
    </section>
    <section className="container-page grid gap-6 py-12 sm:py-16 lg:grid-cols-2" aria-label="Ranking y participación">
      <article className="panel-card border-t-4 border-t-sky"><Trophy className="text-brand" size={28} aria-hidden="true" /><h2 className="mt-4 text-2xl font-bold">Sigue el ranking de la Liga</h2><p className="mt-3 leading-7 text-slate-600">Consulta el acceso público al ranking de la temporada. No necesitas una cuenta para seguir la clasificación individual.</p><Link href="/ranking" className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-brand underline underline-offset-4">Ir al ranking público <ArrowRight size={17} aria-hidden="true" /></Link></article>
      <article className="panel-card border-t-4 border-t-success"><MapPin className="text-brand" size={28} aria-hidden="true" /><h2 className="mt-4 text-2xl font-bold">¿Cómo participar?</h2><p className="mt-3 leading-7 text-slate-600">La participación está sujeta a las habilitaciones y restricciones de las Bases 2026. Consulta la categoría que te corresponde y las instrucciones y plazos de cada jornada.</p><p className="mt-3 text-sm leading-7 text-slate-600">Las Bases indican un formulario digital difundido en Instagram por <a href="https://www.instagram.com/ligaregional_losrios/" className="font-semibold text-brand underline" target="_blank" rel="noopener noreferrer">@ligaregional_losrios (sitio externo)</a>. Confirma allí las instrucciones vigentes con la organización. Crear una cuenta en esta PWA no equivale a una inscripción deportiva.</p></article>
    </section>
  </>;
}
