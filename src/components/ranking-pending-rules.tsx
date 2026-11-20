import { PENDING_RANKING_RULES } from "@/lib/ranking-hypotheses";
export function RankingPendingRules() {
  return <details className="panel-card"><summary className="cursor-pointer font-bold">Hipótesis pendientes de respaldo oficial · deshabilitadas</summary>
    <p className="mt-3 text-sm text-slate-600">Estos criterios no participan del ranking publicado. Su futura aplicación requiere autorización documentada, versión y alcance explícito por categoría y fechas.</p>
    <ul className="mt-3 space-y-3">{PENDING_RANKING_RULES.map(rule => <li key={rule.id}><h3 className="text-sm font-semibold">{rule.label}</h3><p className="text-sm text-slate-600">{rule.description}</p></li>)}</ul>
  </details>;
}
