import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { PlayerRefresh } from "@/components/player-refresh";
import { loadPlayerPanel, PLAYER_ACCESS_NOTICE } from "@/lib/panel-jugador";
import { displayLeagueTime } from "@/lib/competencias";
import { todayInChile } from "@/lib/jugadores";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi panel · Jugador" };
export default async function PlayerPage() {
  const profile = await requireProfile();
  let panel;
  try { panel = await loadPlayerPanel(await createClient(), profile.id); }
  catch { return <DashboardShell arbitrajeHabilitado={profile.arbitrajeHabilitado} role="jugador" nombre={profile.nombre}><p role="alert" className="panel-card">No pudimos comprobar tu información deportiva. <Link href="/panel/jugador" className="underline">Reintentar</Link></p></DashboardShell>; }
  const { player, club, locality, dates, participations } = panel;
  return <DashboardShell arbitrajeHabilitado={profile.arbitrajeHabilitado} role="jugador" nombre={profile.nombre}>
    <nav aria-label="Secciones del jugador" className="mb-5 flex flex-wrap gap-4 text-sm font-bold text-brand"><a href="#perfil">Mi perfil</a><a href="#competencias">Próximas jornadas</a><a href="#participaciones">Mis participaciones</a><Link href="/ranking">Ranking público</Link></nav>
    <div className="space-y-5 break-words">
      <section id="perfil" className="panel-card scroll-mt-32"><h2 className="text-xl font-bold">Mi perfil deportivo</h2>
        {player ? <><dl className="mt-4 grid gap-3 sm:grid-cols-2">{[["Nombre completo", player.nombre_completo], ["Club", club ?? "Sin registrar"], ["Localidad", locality ?? "Sin registrar"], ["Nacimiento", player.fecha_nacimiento ?? "Sin registrar"], ["Estado de la ficha", player.activo ? "Activa" : "Inactiva"]].map(([label,value]) => <div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl><p className="mt-4 text-sm text-slate-600">Para corregir tu ficha, contacta al Administrador. Una ficha activa requiere además habilitación deportiva para cada categoría.</p></> : <p className="mt-3" role="status">Tu cuenta todavía no tiene una ficha deportiva vinculada. Solicita la vinculación al Administrador; no se asigna por coincidencia de nombres.</p>}
        <p className="mt-3 text-sm text-slate-500">Tu cuenta de acceso y tu ficha deportiva son registros distintos.</p>
      </section>
      <section id="competencias" className="panel-card scroll-mt-32"><h2 className="text-xl font-bold">Próximas jornadas publicadas</h2>
        {!dates.some(d => d.fecha >= todayInChile()) && <p className="mt-3">No hay próximas jornadas publicadas.</p>}
        {dates.filter(d => d.fecha >= todayInChile()).map(day => <article key={day.id} className="mt-3 border-t pt-3"><h3 className="font-bold">Jornada {day.numero} · {day.fecha}</h3><p className="text-sm text-slate-600">{day.recinto} · {day.comuna}</p></article>)}
        <p role="status" className="mt-4 rounded-lg bg-sky-50 p-3 text-sm">{PLAYER_ACCESS_NOTICE}</p>
        <div className="mt-4 space-y-3">{participations.map(item => <article key={item.competencia_id} className="border-t pt-3"><h3 className="font-bold">{item.categoria_nombre} · {item.categoria_codigo}</h3><p className="text-sm">Jornada {item.jornada_numero} · {item.fecha} · {item.recinto}</p><p className="text-sm">Inicio deportivo: {item.inicio_programado ? displayLeagueTime(item.inicio_programado) : "Pendiente de confirmación"}</p><p className="text-sm text-slate-600">Participación confirmada por el Juez General.</p></article>)}</div>
      </section>
      <section id="participaciones" className="panel-card scroll-mt-32"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Mis participaciones confirmadas</h2><PlayerRefresh/></div>
        <p className="mt-3 text-sm text-slate-600">Esta lista la confirma el Juez General por competencia individual.</p>
        {!participations.length && <p className="mt-4">Todavía no tienes participaciones confirmadas.</p>}
        <div className="mt-4 space-y-3">{participations.map(item => <article key={`confirmed-${item.competencia_id}`} className="border-t pt-3"><h3 className="font-bold">{item.categoria_nombre} · {item.categoria_codigo}</h3><p className="text-sm">Jornada {item.jornada_numero} · {item.fecha} · {item.recinto}</p></article>)}</div>
      </section>
    </div>
  </DashboardShell>;
}
