"use client";
import { useActionState } from "react";
import { configureRanking, resolveRankingPlace } from "@/app/panel/administrador/ranking/actions";
type Option = { id: number; label: string };
function Feedback({ state }: { state: { error?: string; success?: string } }) { return <>{state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.success && <p role="status" className="text-sm text-green-800">{state.success}</p>}</>; }
function Evidence({ resolution = false }: { resolution?: boolean }) { return <>
  {resolution && <label className="form-label">Autoridad de Liga que respalda la decisión<input className="input" name="autoridad" required minLength={3} maxLength={200}/></label>}
  <label className="form-label">Referencia documental de autorización<textarea className="input" name="referencia" required minLength={10} maxLength={2000}/></label>
  {resolution && <label className="form-label">Motivo de la decisión o revocación<textarea className="input" name="motivo" required minLength={10} maxLength={2000}/></label>}
  <label className="flex gap-2 text-sm"><input type="checkbox" name="respaldo" value="true" required/>Confirmo que existe respaldo formal de Liga para esta {resolution ? "decisión deportiva" : "separación anual de categoría/modalidad y padrón de siete fechas"}.</label>
</>; }
export function RankingConfigurationForm({ categories, rules, dates }: { categories: Option[]; rules: Option[]; dates: Option[] }) {
  const [state, action, pending] = useActionState(configureRanking, {});
  return <details className="mt-4"><summary className="cursor-pointer font-semibold">Registrar configuración oficial</summary><form action={action} className="mt-4 grid max-w-2xl gap-4">
    <label className="form-label">Categoría de temporada<select className="input" name="categoria" required defaultValue=""><option value="" disabled>Seleccionar</option>{categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    <label className="form-label">Reglamento validado<select className="input" name="reglamento" required defaultValue=""><option value="" disabled>Seleccionar</option>{rules.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
    <fieldset><legend className="font-semibold text-sm">Siete fechas oficiales de la misma temporada</legend>{dates.map(d => <label key={d.id} className="mt-2 flex gap-2 text-sm"><input type="checkbox" name="fechas" value={d.id}/>{d.label}</label>)}</fieldset>
    <Evidence/><Feedback state={state}/><button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Registrar reglas y padrón"}</button>
  </form></details>;
}
export function RankingResolutionForm({ competition, player, round, current }: { competition: number; player: number; round: number; current: number | null }) {
  const [state, action, pending] = useActionState(resolveRankingPlace, {});
  const choices = round === 4 ? [3, 4] : [5, 6, 7, 8];
  return <details className="mt-2"><summary className="cursor-pointer text-sm font-semibold">{current ? "Revisar / revocar resolución" : "Registrar resolución autorizada"}</summary><form action={action} className="mt-3 grid max-w-xl gap-3">
    <input type="hidden" name="competencia" value={competition}/><input type="hidden" name="jugador" value={player}/>
    <label className="form-label">Puesto autorizado<select className="input" name="puesto" defaultValue={current ?? ""} required><option value="" disabled>Seleccionar</option>{choices.map(p => <option key={p} value={p}>{p}.º</option>)}{current && <option value="revocar">Revocar sin adjudicar puntos</option>}</select></label>
    <Evidence resolution/><Feedback state={state}/><button className="btn-primary" disabled={pending}>{pending ? "Guardando…" : "Registrar decisión"}</button>
  </form></details>;
}
