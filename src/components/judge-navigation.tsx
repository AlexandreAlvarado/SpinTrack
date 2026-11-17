"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { JUDGE_PATH } from "@/lib/preparacion-deportiva";
import { HABILITATIONS_PATH } from "@/lib/habilitaciones";

const PARTICIPANTS_PATH = "/panel/juez-general/participantes";

export function JudgeNavigation({ current }: { current: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const context = new URLSearchParams();
  for (const key of ["temporada", "fecha", "jornada", "competencia"]) {
    const value = params.get(key);
    if (value) context.set(key === "jornada" ? "fecha" : key, value);
  }
  const href = (path: string) => {
    const query = context.toString();
    return query ? `${path}${path.includes("?") ? "&" : "?"}${query}` : path;
  };
  const active = current || pathname;
  return <nav aria-label="Navegación del Juez General" className="space-y-5">
    <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Inicio</p><Link href={href("/panel/juez-general")} className="sidebar-link" aria-current={active === "/panel/juez-general" ? "page" : undefined}>Mi panel</Link></div>
    <div className="grid gap-1">
      <Link href={href("/panel/juez-general?etapa=preparar")} className="sidebar-link">1. Preparar competencia</Link>
      <Link href={href("/panel/juez-general/partidos")} className="sidebar-link">2. Gestionar partidos</Link>
      <Link href={href("/panel/juez-general/clasificacion")} className="sidebar-link">3. Clasificación y eliminatorias</Link>
    </div>
    <details><summary className="cursor-pointer text-sm font-bold">Herramientas avanzadas y consultas</summary><div className="mt-3 grid gap-1">
      <Link href={href(JUDGE_PATH)} className="sidebar-link" aria-current={active === JUDGE_PATH ? "page" : undefined}>Preparación deportiva</Link>
      <Link href={href(HABILITATIONS_PATH)} className="sidebar-link" aria-current={active === HABILITATIONS_PATH ? "page" : undefined}>Habilitaciones deportivas</Link>
      <Link href={href(PARTICIPANTS_PATH)} className="sidebar-link" aria-current={active === PARTICIPANTS_PATH ? "page" : undefined}>Participantes confirmados</Link>
      <Link href={href("/panel/juez-general/grupos")} className="sidebar-link" aria-current={active === "/panel/juez-general/grupos" ? "page" : undefined}>Organización de grupos</Link>
      <Link href={href("/panel/juez-general/partidos")} className="sidebar-link" aria-current={active === "/panel/juez-general/partidos" ? "page" : undefined}>Programación de partidos · Grupos</Link>
      <Link href={href("/panel/juez-general/resultados")} className="sidebar-link" aria-current={active === "/panel/juez-general/resultados" ? "page" : undefined}>Resultados por set</Link>
      <Link href={href("/panel/juez-general/clasificacion")} className="sidebar-link" aria-current={active === "/panel/juez-general/clasificacion" ? "page" : undefined}>Clasificación de grupos</Link>
    </div></details>
    <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Consultas</p><div className="grid gap-1"><Link href="/calendario" className="sidebar-link">Calendario de jornadas</Link><Link href="/" className="sidebar-link">Inicio público</Link></div></div>
  </nav>;
}
