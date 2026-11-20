"use client";
import { useState } from "react";
import { calculateRanking, type RankingScope } from "@/lib/ranking";

export function PublicRanking({ scopes = [], unavailable = false }: { scopes?: RankingScope[]; unavailable?: boolean }) {
  const [season, setSeason] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const seasons = [...new Map(scopes.map(s => [String(s.seasonId), s.seasonLabel])).entries()];
  const seasonId = seasons.some(([id]) => id === season) ? season : seasons[0]?.[0];
  const categories = scopes.filter(s => String(s.seasonId) === seasonId);
  const scope = categories.find(s => String(s.id) === category) ?? categories[0];
  const ranking = scope ? calculateRanking(scope) : null;
  return <section className="panel-card mt-6 min-w-0">
    <h2 className="text-xl font-bold">Ranking de temporada</h2>
    <p className="mt-2 text-sm text-slate-600">Seis mejores puntuaciones de siete fechas. Solo resultados confirmados y categorías con respaldo oficial.</p>
    {!scope ? <p className="empty-state mt-5" role="status">{unavailable ? "No se pudo consultar el ranking. Intenta nuevamente más tarde." : "Pendiente de configuración autorizada de temporada, categoría y siete fechas oficiales."}</p> : <>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="form-label">Temporada<select className="input" value={seasonId} onChange={e => { setSeason(e.target.value); setCategory(""); }}>{seasons.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="form-label">Categoría / modalidad individual<select className="input" value={scope.id} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label className="form-label">Buscar jugador<input className="input" type="search" value={search} onChange={e => setSearch(e.target.value)} maxLength={120}/></label>
      </div>
      <p className="mt-4 text-sm font-semibold" role="status">{ranking!.provisional ? "Provisional · hay fechas o resoluciones pendientes. Las posiciones y desempates pueden cambiar." : "Siete fechas contabilizadas · revisar los desempates indicados antes de la premiación."}</p>
      <div className="mt-4 max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Ranking: tabla desplazable">
        <table className="w-full whitespace-nowrap text-left text-sm"><caption className="sr-only">{scope.seasonLabel} · {scope.label}</caption><thead><tr><th scope="col">Pos.</th><th scope="col">Jugador</th>{scope.dates.map(d => <th scope="col" key={d.id} title={d.complete ? "Competencia finalizada" : "Fecha pendiente"}>F{d.number}</th>)}<th scope="col">Total 7</th><th scope="col">Mejores 6</th><th scope="col">1.º</th><th scope="col">Desempate / estado</th></tr></thead>
          <tbody>{ranking!.rows.filter(r => r.name.toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es"))).map(r => <tr key={r.playerId}>
            <td>{r.position === null ? "—" : `${r.position}${ranking!.provisional ? "*" : ""}`}</td><th scope="row" className="max-w-48 whitespace-normal">{r.name}</th>
            {r.dates.map((d, i) => <td key={scope.dates[i].id} title={!d ? "Sin puntuación registrada; no equivale a cero puntos" : d.state === "sin_escala" ? "Sin puntuación definida después del puesto 32" : d.state !== "confirmado" ? "Pendiente de resultado o resolución deportiva" : d.place ? `Puesto ${d.place} confirmado` : "Banda de puestos confirmada"}>{d?.state === "confirmado" ? d.points : d?.state === "sin_escala" ? "S/E" : d ? "Pend." : "—"}</td>)}
            <td>{r.total}</td><td className="font-bold text-brand">{r.valid}</td><td>{r.wins}</td><td className="max-w-64 whitespace-normal text-xs">{r.tie}{r.pending && " · puntuación incompleta"}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!ranking!.rows.length && <p className="empty-state mt-4">Sin participantes con resultados publicables.</p>}
      <p className="mt-3 text-xs leading-5 text-slate-500">Pend.: resultado o puesto pendiente, excluido de la suma. —: sin puntuación registrada. S/E: sin escala reglamentaria. Los totales muestran solo puntos confirmados. Posiciones compartidas conservan el empate; el orden de nombres no lo resuelve.</p>
    </>}
  </section>;
}
