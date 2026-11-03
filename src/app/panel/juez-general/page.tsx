import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { ClipboardCheck, ListChecks, Users, Table2, Gavel } from "lucide-react";

export const metadata: Metadata = { title: "Juez General" };
const modules = [
  {title:"Validación de participantes",desc:"Confirmar inscripciones y habilitación deportiva.",icon:Users},
  {title:"Grupos y clasificación",desc:"Generar grupos de 3 o 4 y controlar avance de fases.",icon:ListChecks},
  {title:"Mesas y árbitros",desc:"Programar enfrentamientos y distribuir asignaciones.",icon:Table2},
  {title:"Resultados e incidencias",desc:"Supervisar resultados y gestionar correcciones con auditoría.",icon:ClipboardCheck},
];
export default async function JudgePage() {
  const profile = await requireRole("juez_general");
  return <DashboardShell role={profile.rol} nombre={profile.nombre}><div className="panel-card mb-6 flex items-center gap-3"><Gavel className="text-brand"/><div><strong>Dirección deportiva</strong><p className="text-sm text-slate-600">La estructura del panel está creada. Las operaciones de torneo se implementarán en la siguiente etapa.</p></div></div><div className="grid gap-4 sm:grid-cols-2">{modules.map(({icon:Icon,title,desc})=><div className="panel-card" key={title}><Icon className="mb-4 text-brand" size={25}/><h2 className="font-bold">{title}</h2><p className="mt-2 text-sm text-slate-600">{desc}</p><span className="mt-5 inline-block text-xs font-semibold uppercase tracking-wide text-amber-700">Pendiente de implementación</span></div>)}</div></DashboardShell>;
}
