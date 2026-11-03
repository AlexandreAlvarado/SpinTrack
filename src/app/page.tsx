import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardList, Medal, ShieldCheck, Trophy } from "lucide-react";
import { DateList } from "@/components/date-list";
import { getPublishedDates } from "@/lib/fechas";
import { supabaseConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const fechas = (await getPublishedDates()).slice(0, 3);
  return (
    <>
      <section className="overflow-hidden bg-ink text-white">
        <div className="container-page grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/80"><Trophy size={16} /> Temporada de competencias</p>
            <h1 className="max-w-xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">El tenis de mesa de <span className="text-red-400">Los Ríos</span>, en un solo lugar.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">Consulta las fechas de la liga y sigue la actividad deportiva desde tu computador o teléfono. Las funciones de competencia se habilitan según tu perfil.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/calendario" className="btn-primary">Ver calendario <ArrowRight size={17}/></Link><Link href="/login" className="btn-secondary">Acceso a usuarios</Link></div>
          </div>
          <div className="relative flex min-h-72 items-center justify-center rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 p-8 shadow-2xl sm:min-h-96">
            <div className="absolute left-8 top-7 h-24 w-24 rounded-full border border-red-400/20"/>
            <div className="absolute bottom-7 right-8 h-36 w-36 rounded-full border border-red-400/20"/>
            <div className="relative flex h-48 w-48 items-center justify-center rounded-full border-[20px] border-white bg-brand shadow-[0_25px_70px_rgba(213,42,54,.35)] sm:h-56 sm:w-56"><span className="absolute h-28 w-28 rounded-full border-[4px] border-white/20"/><Trophy size={91} strokeWidth={1.4} aria-label="Trofeo" /></div>
            <p className="absolute bottom-6 left-7 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Pasión · Competencia · Comunidad</p>
          </div>
        </div>
      </section>
      <section className="container-page py-14">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><span className="tag">Competencia</span><h2 className="mt-3 text-3xl font-bold">Próximas fechas</h2></div><Link href="/calendario" className="text-sm font-semibold text-brand hover:underline">Ver todas las fechas →</Link></div>
        {!supabaseConfigured() && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Modo instalación: falta configurar Supabase. Consulta el README para activar los datos reales.</div>}
        <DateList fechas={fechas} />
      </section>
      <section className="bg-white py-14"><div className="container-page grid gap-5 md:grid-cols-3">
        {[{icon:CalendarDays,title:"Programación",body:"Fechas, sedes y horarios publicados para la temporada."},{icon:Medal,title:"Resultados y ranking",body:"Próximo módulo: seguimiento de encuentros y clasificación."},{icon:ShieldCheck,title:"Acceso por perfiles",body:"Herramientas separadas para administración, juez general, arbitraje y jugadores."}].map(({icon:Icon,title,body})=><div className="panel-card" key={title}><Icon size={29} className="mb-5 text-brand"/><h3 className="font-bold text-lg">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></div>)}
      </div></section>
      <section className="container-page py-14"><div className="rounded-2xl bg-red-50 p-7 sm:p-10"><div className="flex flex-wrap items-center justify-between gap-5"><div><h2 className="text-2xl font-bold">¿Participas en la liga?</h2><p className="mt-2 text-slate-600">Crea tu cuenta de Jugador y accede a tu panel personal.</p></div><Link href="/registro" className="btn-primary">Crear cuenta <ClipboardList size={18}/></Link></div></div></section>
    </>
  );
}
