"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import type { PublicRankingEntry, PublicRankingPublication } from "@/lib/public-ranking";

function RankingTable({ title, description, entries, available }: { title: string; description: string; entries: PublicRankingEntry[]; available: boolean }) {
  return <section className="panel-card"><h2 className="text-xl font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    {!available ? <p className="empty-state mt-5">Pendiente de publicación de la clasificación oficial en esta PWA.</p> : !entries.length ? <p className="empty-state mt-5">No hay resultados para estos filtros.</p> : <div className="mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label={`${title}: tabla desplazable`}><table className="w-full text-left text-sm"><caption className="sr-only">{title}</caption><thead><tr>{["Posición", "Nombre", "Procedencia", "Puntos"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{entries.map((entry, index) => <tr key={`${entry.position}-${index}`}><td className="font-bold">{entry.position}</td><th scope="row">{entry.name}</th><td>{entry.origin || "Sin procedencia publicada"}</td><td className="font-bold">{entry.points}</td></tr>)}</tbody></table></div>}
  </section>;
}

export function PublicRanking({ publication = null }: { publication?: PublicRankingPublication | null }) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const categories = publication?.categories ?? [];
  const category = categories.find(item => item.id === categoryId) ?? categories[0];
  const search = query.trim().toLocaleLowerCase("es-CL");
  const filter = (entries: PublicRankingEntry[]) => entries.filter(entry => `${entry.name} ${entry.origin}`.toLocaleLowerCase("es-CL").includes(search));
  const available = !!category;
  return <div className="space-y-6">
    <section className="panel-card" aria-labelledby="ranking-filters"><h2 id="ranking-filters" className="font-bold">Consulta por jugador o categoría</h2>
      <p id="ranking-availability" className="mt-2 text-sm text-slate-600">{available ? `${publication!.seasonLabel} · ${publication!.updatedLabel}` : "Los filtros estarán disponibles cuando se publique el ranking interno. El ranking externo tiene sus propios filtros."}</p>
      <fieldset disabled={!available} aria-describedby="ranking-availability" className="mt-4 grid gap-4 sm:grid-cols-[1.5fr_1fr]">
        <legend className="sr-only">Filtros del ranking</legend>
        <label className="form-label">Buscar jugador o ciudad<input type="search" className="input" placeholder="Nombre o procedencia" value={query} onChange={event => setQuery(event.target.value)} maxLength={120} /></label>
        <label className="form-label">Categoría<select className="input" value={category?.id ?? ""} onChange={event => setCategoryId(event.target.value)}>{!categories.length && <option value="">Sin categorías publicadas</option>}{categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </fieldset>
    </section>
    <section className="panel-card" aria-labelledby="podium-title"><div className="flex items-center gap-3"><Trophy className="text-brand" size={25} aria-hidden="true" /><h2 id="podium-title" className="text-xl font-bold">Podio de la categoría{category ? ` · ${category.label}` : ""}</h2></div>
      {category?.podium.length ? <ol className="mt-5 grid gap-4 sm:grid-cols-3">{category.podium.map((entry, index) => <li className="rounded-xl border border-slate-200 bg-slate-50 p-5" key={`${entry.position}-${index}`}><p className="text-sm font-bold text-brand">Posición {entry.position}</p><p className="mt-2 font-bold">{entry.name}</p><p className="mt-1 text-sm text-slate-600">{entry.origin || "Sin procedencia publicada"}</p><p className="mt-3 font-bold">{entry.points} puntos</p></li>)}</ol> : <p className="empty-state mt-5">El podio se mostrará con una clasificación oficial publicada. Todavía no hay posiciones disponibles en esta PWA.</p>}
    </section>
    <div className="grid gap-6 xl:grid-cols-2">
      <RankingTable title="Ranking acumulado" description="Puntuaciones acumuladas de las fechas disputadas, una vez publicadas." entries={filter(category?.accumulated ?? [])} available={available} />
      <RankingTable title="Ranking de premiación" description="Clasificación para la premiación conforme a las Bases aplicables y su validación oficial." entries={filter(category?.awards ?? [])} available={available} />
    </div>
    <section className="panel-card"><h2 className="text-xl font-bold">Fechas disputadas</h2>{publication?.dates.length ? <ul className="mt-4 flex flex-wrap gap-3">{publication.dates.map(date => <li className="tag" key={date}>{date}</li>)}</ul> : <p className="mt-3 text-sm leading-7 text-slate-600">No hay fechas con puntuaciones publicadas en el ranking interno. Una jornada del calendario no se considera disputada ni puntuada por el solo hecho de estar publicada.</p>}</section>
  </div>;
}
