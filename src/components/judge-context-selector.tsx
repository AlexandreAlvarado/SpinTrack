"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type { Competition, CompetitionDate } from "@/lib/competencias";
import type { Season, SeasonCategory, Concept } from "@/lib/temporadas-deportivas";

type Props = { seasons: Season[]; dates: CompetitionDate[]; competitions: Competition[]; categories: SeasonCategory[]; concepts: Concept[]; levels: Concept[]; seasonId?: number; dateId?: number; competitionId?: number; includeCompetition?: boolean };

export function JudgeContextSelector({ seasons, dates, competitions, categories, concepts, levels, seasonId, dateId, competitionId, includeCompetition = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    // Materializa los valores elegidos por el servidor para que todos los enlaces los conserven.
    const next = new URLSearchParams(params.toString());
    if (seasonId && !next.has("temporada")) next.set("temporada", String(seasonId));
    if (dateId && !next.has("fecha") && !next.has("jornada")) next.set("fecha", String(dateId));
    if (next.toString() !== params.toString()) router.replace(`${pathname}?${next}`, { scroll: false });
  }, [seasonId, dateId, params, pathname, router]);
  const navigate = (key: "temporada" | "fecha" | "competencia", value: string) => {
    const next = new URLSearchParams(params.toString());
    if (key === "temporada") { next.set("temporada", value); next.delete("fecha"); next.delete("jornada"); next.delete("competencia"); }
    if (key === "fecha") { next.set("fecha", value); next.delete("jornada"); next.delete("competencia"); }
    if (key === "competencia") next.set("competencia", value);
    router.push(`${pathname}?${next.toString()}`);
  };
  const categoryLabel = (competition: Competition) => {
    const category = categories.find(item => item.id === competition.categoria_temporada_id);
    if (!category) return `Competencia #${competition.id}`;
    return `${concepts.find(item => item.id === category.categoria_id)?.nombre ?? category.codigo} · ${levels.find(item => item.id === category.nivel_id)?.nombre ?? "Nivel pendiente"}`;
  };
  return <div className="panel-card mb-5 flex flex-wrap items-end gap-3">
    <label className="form-label">Temporada<select className="input" value={seasonId ?? ""} onChange={event => navigate("temporada", event.target.value)}><option value="">Selecciona una temporada</option>{seasons.map(item => <option key={item.id} value={item.id}>{item.nombre} ({item.anio})</option>)}</select></label>
    <label className="form-label">Jornada<select className="input" value={dateId ?? ""} disabled={!seasonId} onChange={event => navigate("fecha", event.target.value)}><option value="">Selecciona una jornada</option>{dates.map(item => <option key={item.id} value={item.id}>Jornada {item.numero} · {item.fecha} ({item.estado})</option>)}</select></label>
    {includeCompetition && <label className="form-label">Competencia individual<select className="input" value={competitionId ?? ""} disabled={!dateId} onChange={event => navigate("competencia", event.target.value)}><option value="">Selecciona una competencia</option>{competitions.map(item => <option key={item.id} value={item.id}>{categoryLabel(item)}</option>)}</select></label>}
  </div>;
}

