import type { Metadata } from "next";
import Link from "next/link";
import { JudgeNavigation } from "@/components/judge-navigation";
import { JUDGE_PATH } from "@/lib/preparacion-deportiva";
import { HABILITATIONS_PATH } from "@/lib/habilitaciones";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { ClipboardCheck, ListChecks, Table2, Gavel } from "lucide-react";

export const metadata: Metadata = { title: "Juez General" };
const modules = [
  {title:"Grupos y clasificación",desc:"Generar grupos de 3 o 4 y controlar avance de fases.",icon:ListChecks},
  {title:"Mesas y árbitros",desc:"Programar enfrentamientos y distribuir asignaciones.",icon:Table2},
  {title:"Resultados e incidencias",desc:"Supervisar resultados y gestionar correcciones con auditoría.",icon:ClipboardCheck},
];
export default async function JudgePage() {
  const profile = await requireRole("juez_general");
  return <DashboardShell role={profile.rol} nombre={profile.nombre}><JudgeNavigation current="/panel/juez-general"/><div className="panel-card mb-6 flex items-center gap-3"><Gavel className="text-brand"/><div><strong>Dirección deportiva</strong><p className="mb-4 text-sm text-slate-600">Prepara las competencias individuales y revisa las habilitaciones por temporada. Las decisiones deportivas se confirman en PostgreSQL.</p><div className="flex flex-wrap gap-3"><Link className="btn-primary" href="/panel/juez-general/inscripciones">Resolución de inscripciones</Link><Link className="btn-primary" href={JUDGE_PATH}>Preparación deportiva</Link><Link className="btn-secondary" href={HABILITATIONS_PATH}>Habilitaciones deportivas</Link></div></div></div><div className="grid gap-4 sm:grid-cols-2">{modules.map(({icon:Icon,title,desc})=><div className="panel-card" key={title}><Icon className="mb-4 text-brand" size={25}/><h2 className="font-bold">{title}</h2><p className="mt-2 text-sm text-slate-600">{desc}</p><span className="mt-5 inline-block text-xs font-semibold uppercase tracking-wide text-amber-700">Pendiente de implementación</span></div>)}</div></DashboardShell>;
}
