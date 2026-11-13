import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { PublicRanking } from "@/components/public-ranking";
import { EXTERNAL_RANKING_URL } from "@/lib/public-ranking";

export const metadata: Metadata = { title: "Ranking público", description: "Acceso público al ranking individual de la Liga Regional de Tenis de Mesa Los Ríos." };

export default function RankingPage() {
  return <div className="container-page py-10 sm:py-14">
    <span className="tag">Consulta pública · Individuales</span><h1 className="mt-3 text-4xl font-extrabold">Ranking de la Liga</h1><p className="mt-4 max-w-3xl leading-7 text-slate-600">Sigue la clasificación de la temporada, sin iniciar sesión.</p>
    <section className="my-8 rounded-2xl border border-sky/40 bg-blue-50 p-5 sm:p-7" aria-labelledby="ranking-status"><h2 id="ranking-status" className="text-xl font-bold">El ranking interno aún no está disponible</h2><p className="mt-3 max-w-3xl leading-7 text-slate-700">Esta PWA todavía no publica resultados oficiales ni calcula clasificaciones. Mientras tanto, puedes consultar el ranking de la temporada 2026 en el sitio externo existente de la Liga.</p><a href={EXTERNAL_RANKING_URL} target="_blank" rel="noopener noreferrer" className="btn-primary mt-5">Ver ranking externo 2026 <ExternalLink size={17} aria-hidden="true" /><span className="sr-only"> (abre en una pestaña nueva)</span></a><p className="mt-3 text-sm text-slate-600">Saldrás de la PWA. La información y las actualizaciones corresponden al sitio externo; no se importan aquí.</p></section>
    <PublicRanking />
    <aside className="mt-6 rounded-xl border-l-4 border-accent bg-white p-5" aria-label="Criterio general de las Bases"><h2 className="font-bold">Qué establecen las Bases 2026</h2><p className="mt-2 text-sm leading-7 text-slate-600">Para el puntaje general del ranking se consideran las seis mejores puntuaciones de siete fechas. La clasificación provisional que pueda mostrar el sitio externo requiere validación independiente y no se aplica como regla en esta PWA.</p><p className="mt-2 text-xs text-slate-500">Referencia: Bases 2026, secciones 7 (Reglamento) y 9 (Ranking). Consulta limitada a competencias individuales.</p></aside>
  </div>;
}
