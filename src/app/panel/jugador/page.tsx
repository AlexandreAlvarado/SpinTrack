import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { Medal, CalendarDays } from "lucide-react";

export const metadata: Metadata = { title: "Jugador" };
export default async function PlayerPage() {
  const profile = await requireRole("jugador");
  return <DashboardShell role={profile.rol} nombre={profile.nombre}><div className="grid gap-5 md:grid-cols-2"><section className="panel-card"><CalendarDays className="mb-4 text-brand" size={28}/><h2 className="text-xl font-bold">Inscripciones</h2><p className="mt-2 text-slate-600">Aquí podrás inscribirte a categorías habilitadas cuando implementemos el módulo deportivo.</p><Link href="/calendario" className="btn-secondary mt-5">Consultar calendario</Link></section><section className="panel-card"><Medal className="mb-4 text-brand" size={28}/><h2 className="text-xl font-bold">Mi ranking</h2><p className="mt-2 text-slate-600">El ranking individual se mostrará cuando existan resultados oficiales validados.</p></section></div><p className="mt-6 text-sm text-slate-500">Cuenta registrada con rol Jugador. La asignación de cargos administrativos o deportivos se realiza únicamente por personal autorizado.</p></DashboardShell>;
}
