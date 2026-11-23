import type { Metadata } from "next";
import { PublicRanking } from "@/components/public-ranking";
import { getSeasonRanking } from "@/lib/ranking-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ranking público", description: "Ranking individual de temporada conforme a las Bases Liga Regional Los Ríos 2026." };
export default async function RankingPage() {
  const response = await getSeasonRanking();
  return <div className="container-page min-w-0 py-8">
    <span className="tag">Consulta pública · Individuales</span><h1 className="mt-3 text-3xl font-extrabold">Ranking de la Liga</h1><p className="mt-3 text-slate-600">Consulta la temporada sin iniciar sesión.</p>
    <PublicRanking {...response}/>
    <aside className="mt-5 rounded-xl border-l-4 border-accent bg-white p-5 text-sm leading-6"><h2 className="font-bold">Bases 2026 · apartados 7 y 9</h2><p>Se consideran las seis mejores puntuaciones de siete fechas. Para empates en los primeros tres lugares: mayor total de siete fechas, luego más primeros lugares. Si persiste, queda pendiente un partido de definición autorizado por la Liga.</p><p className="mt-2">No se asignan puestos diferentes a eliminados de la misma ronda sin resolución deportiva respaldada. Las jornadas adicionales, incluida la jornada 8, no suman puntos.</p></aside>
  </div>;
}
