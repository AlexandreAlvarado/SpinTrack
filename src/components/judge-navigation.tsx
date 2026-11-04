import Link from "next/link";
import { JUDGE_PATH } from "@/lib/preparacion-deportiva";
import { HABILITATIONS_PATH } from "@/lib/habilitaciones";

export function JudgeNavigation({ current }: { current: string }) {
  return <nav aria-label="Dirección deportiva" className="mb-6 flex flex-wrap gap-3">
    {[["/panel/juez-general", "Inicio del Juez General"], [JUDGE_PATH, "Preparación deportiva"], [HABILITATIONS_PATH, "Habilitaciones deportivas"]].map(([href, label]) => <Link key={href} href={href} className="btn-secondary" aria-current={current === href ? "page" : undefined}>{label}</Link>)}
  </nav>;
}
