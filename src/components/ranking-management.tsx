import { createClient } from "@/lib/supabase/server";
import { RankingConfigurationForm, RankingResolutionForm } from "@/components/ranking-forms";
import { RankingPendingRules } from "@/components/ranking-pending-rules";
type Source = { configuracion_id: number; competencia_id: number; fecha_numero: number; jugador_id: number; nombre_completo: string; terminado: boolean; ronda_perdida: number | null; puesto: number | null; puntos: number | null; estado: string };
type Configuration = { id: number; categoria_temporada_id: number; reglamento_id: number; fecha_ids: number[]; referencia: string; registrado_por: string; registrado_en: string };
type History = { id: number; competencia_id: number; jugador_id: number; puesto: number | null; autoridad: string; referencia: string; motivo: string; registrado_por: string; registrado_en: string };
export async function RankingManagement({ judge = false }: { judge?: boolean }) {
  const db = await createClient();
  const result = await db.rpc("consultar_gestion_ranking_026");
  if (result.error || !result.data) return <div className="space-y-5"><section className="panel-card"><h2 className="text-xl font-bold">Ranking oficial 2026</h2><p role="alert" className="mt-3">No se pudo consultar la gestión. Comprueba la conexión y la aplicación manual de la migración 026.</p></section><RankingPendingRules/></div>;
  const data = result.data as { configuraciones: Configuration[]; fuentes: Source[]; historial: History[] };
  let form = null;
  if (!judge) {
    const [seasons, categories, rules, dates] = await Promise.all([
      db.from("temporadas").select("id,nombre").eq("anio", 2026),
      db.from("categorias_temporada").select("id,temporada_id,codigo,rama").eq("activo", true),
      db.from("reglamentos_temporada").select("id,temporada_id,titulo").eq("estado_revision", "validado"),
      db.from("fechas").select("id,temporada_id,numero,fecha").gte("numero", 1).lte("numero", 7).order("numero"),
    ]);
    const label = (id: number) => seasons.data?.find(s => s.id === id)?.nombre;
    form = [seasons, categories, rules, dates].some(r => r.error) ? <p role="alert">No se pudieron cargar las opciones de configuración.</p> : <RankingConfigurationForm
      categories={(categories.data ?? []).filter(c => label(c.temporada_id) && !data.configuraciones.some(cfg => cfg.categoria_temporada_id === c.id)).map(c => ({ id: c.id, label: `${label(c.temporada_id)} · ${c.codigo} · ${c.rama ?? "sin rama"}` }))}
      rules={(rules.data ?? []).filter(r => label(r.temporada_id)).map(r => ({ id: r.id, label: `${label(r.temporada_id)} · ${r.titulo}` }))}
      dates={(dates.data ?? []).filter(d => label(d.temporada_id)).map(d => ({ id: d.id, label: `${label(d.temporada_id)} · Fecha ${d.numero} · ${d.fecha}` }))}/>;
  }
  return <div className="space-y-5"><RankingPendingRules/><section className="panel-card"><h2 className="text-xl font-bold">Ranking oficial 2026</h2><p className="mt-2 text-sm text-slate-600">Siete fechas oficiales; seis mejores puntuaciones. Totales calculados, sin edición manual. La jornada 8 queda excluida.</p>{form}
    {!data.configuraciones.length && <p className="mt-4 text-sm">Sin configuración autorizada.</p>}
    {data.configuraciones.map(c => <details key={c.id} className="mt-4 border-t pt-3"><summary className="cursor-pointer">Configuración #{c.id} · categoría #{c.categoria_temporada_id}</summary><p className="mt-2 whitespace-pre-wrap text-sm">Reglamento #{c.reglamento_id} · Fechas: {c.fecha_ids.join(", ")}<br/>{c.referencia}<br/>Registró: {c.registrado_por} · {c.registrado_en}</p></details>)}
  </section><section className="panel-card"><h2 className="font-bold">Puestos y decisiones deportivas</h2><p className="mt-2 text-sm text-slate-600">Semifinal: 3.º/4.º. Cuartos: 5.º–8.º. Otros casos ambiguos requieren una interpretación formal adicional de Liga. No se crean partidos.</p>
    {data.fuentes.filter(s => s.estado !== "confirmado" || (s.puesto !== null && s.puesto >= 3)).map(s => <article className="mt-4 border-t pt-3" key={`${s.competencia_id}:${s.jugador_id}`}><h3 className="font-semibold">{s.nombre_completo} · jugador #{s.jugador_id}</h3><p className="text-sm">Configuración #{s.configuracion_id} · Fecha {s.fecha_numero} · competencia #{s.competencia_id} · {s.estado} {s.puesto ? `· puesto ${s.puesto}` : ""}</p>
      {judge && s.terminado && [4, 8].includes(s.ronda_perdida ?? 0) && <RankingResolutionForm competition={s.competencia_id} player={s.jugador_id} round={s.ronda_perdida!} current={s.puesto}/>}
    </article>)}
  </section><details className="panel-card"><summary className="cursor-pointer font-bold">Historial de resoluciones ({data.historial.length})</summary>{data.historial.map(h => <article key={h.id} className="mt-3 border-t pt-3 text-sm"><p>#{h.id} · competencia #{h.competencia_id} · jugador #{h.jugador_id} · {h.puesto ? `puesto ${h.puesto}` : "revocada"}</p><p className="whitespace-pre-wrap">Autoridad: {h.autoridad}<br/>{h.referencia}<br/>{h.motivo}<br/>Registró: {h.registrado_por} · {h.registrado_en}</p></article>)}</details></div>;
}
