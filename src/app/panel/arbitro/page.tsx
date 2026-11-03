import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { ClipboardList, Flag, WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Árbitro" };
export default async function RefereePage() {
  const profile = await requireRole("arbitro");
  return <DashboardShell role={profile.rol} nombre={profile.nombre}><section className="panel-card"><ClipboardList className="mb-4 text-brand" size={30}/><h2 className="text-xl font-bold">Mis partidos asignados</h2><p className="mt-2 text-slate-600">En el siguiente módulo podrás ingresar el marcador set a set, incidencias y confirmar el acta de cada encuentro.</p><p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><Flag className="mr-2 inline" size={16}/> Por ahora no existen asignaciones de partidos.</p></section><section className="mt-5 rounded-2xl border border-dashed border-slate-300 p-5"><h3 className="flex items-center gap-2 font-bold"><WifiOff size={20}/> Funcionamiento sin conexión</h3><p className="mt-2 text-sm text-slate-600">Pendiente: cola local, sincronización e idempotencia. No se debe registrar un resultado como confirmado mientras no esté sincronizado.</p></section></DashboardShell>;
}
