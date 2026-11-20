"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

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
  const isActive = (path: string) => active === path || active.startsWith(`${path}/`) || active.startsWith(`${path}?`);
  return <nav aria-label="Navegación del Juez General" className="space-y-5">
    <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Inicio</p><Link href={href("/panel/juez-general")} className="sidebar-link" aria-current={active === "/panel/juez-general" ? "page" : undefined}>Mi panel</Link></div>
    <div className="grid gap-1">
      <Link href={href("/panel/juez-general?etapa=preparar")} className="sidebar-link" aria-current={active === "/panel/juez-general" ? "page" : undefined}>1. Preparar competencia</Link>
      <Link href={href("/panel/juez-general/partidos")} className="sidebar-link" aria-current={isActive("/panel/juez-general/partidos") ? "page" : undefined}>2. Gestionar partidos</Link>
      <Link href={href("/panel/juez-general/programacion")} className="sidebar-link" aria-current={isActive("/panel/juez-general/programacion") ? "page" : undefined}>Mesas y programación</Link>
      <Link href={href("/panel/juez-general/clasificacion")} className="sidebar-link" aria-current={isActive("/panel/juez-general/clasificacion") ? "page" : undefined}>3. Clasificación y eliminatorias</Link>
    </div>
    <details><summary className="cursor-pointer text-sm font-bold">Herramientas avanzadas y consultas</summary><div className="mt-3 grid gap-1">
      <Link href={href("/panel/juez-general/preparacion")} className="sidebar-link" aria-current={isActive("/panel/juez-general/preparacion") ? "page" : undefined}>Preparación deportiva</Link>
      <Link href={href("/panel/juez-general/habilitaciones")} className="sidebar-link" aria-current={isActive("/panel/juez-general/habilitaciones") ? "page" : undefined}>Habilitaciones deportivas</Link>
      <Link href={href("/panel/juez-general/participantes")} className="sidebar-link" aria-current={isActive("/panel/juez-general/participantes") ? "page" : undefined}>Participantes confirmados</Link>
      <Link href={href("/panel/juez-general/grupos")} className="sidebar-link" aria-current={isActive("/panel/juez-general/grupos") ? "page" : undefined}>Organización de grupos</Link>
      <Link href={href("/panel/juez-general/partidos")} className="sidebar-link" aria-current={isActive("/panel/juez-general/partidos") ? "page" : undefined}>Programación de partidos</Link>
      <Link href={href("/panel/juez-general/resultados")} className="sidebar-link" aria-current={isActive("/panel/juez-general/resultados") ? "page" : undefined}>Resultados por set</Link>
      <Link href={href("/panel/juez-general/clasificacion")} className="sidebar-link" aria-current={isActive("/panel/juez-general/clasificacion") ? "page" : undefined}>Clasificación de grupos</Link>
    </div></details>
    <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Consultas</p><div className="grid gap-1"><Link href="/calendario" className="sidebar-link">Calendario de jornadas</Link><Link href="/" className="sidebar-link">Inicio público</Link><Link href="/panel/juez-general/ranking" className="sidebar-link" aria-current={isActive("/panel/juez-general/ranking") ? "page" : undefined}>Resoluciones de ranking</Link></div></div>
  </nav>;
}
