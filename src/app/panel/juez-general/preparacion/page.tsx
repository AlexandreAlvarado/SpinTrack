import Link from "next/link";
import Form from "next/form";
import { DashboardShell } from "@/components/dashboard-shell";
import { JudgeNavigation } from "@/components/judge-navigation";
import { PreparationForm } from "@/components/preparation-form";
import { QuickPreparationTable } from "@/components/quick-preparation-table";
import { officialStart, type PreparationTemplate } from "@/lib/preparacion-rapida";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validId } from "@/lib/catalogos";
import { COMPETITION_COLUMNS, type Competition, type CompetitionDate } from "@/lib/competencias";
import type { Season, SeasonCategory, Rule, Concept } from "@/lib/temporadas-deportivas";
import { JUDGE_PATH, PREPARATION_COLUMNS, FORMAT_COLUMNS, preparationBlockers, type Preparation, type StageFormat } from "@/lib/preparacion-deportiva";

export const dynamic = "force-dynamic";
export const metadata = { title: "Preparación deportiva · Juez General" };

export default async function PreparationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireRole("juez_general");
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === "string" && validId(value) ? value : ""]));
  let seasons: Season[] = [], dates: CompetitionDate[] = [], competitions: Competition[] = [], controls: Preparation[] = [], formats: StageFormat[] = [], categories: SeasonCategory[] = [], rules: Rule[] = [], concepts: Concept[] = [], levels: Concept[] = [];
  let templates: PreparationTemplate[] = [];
  let failed = false;
  try {
    const db = await createClient();
    async function read<T>(table: string, columns: string, filters: Record<string, number> = {}, ids?: number[]): Promise<T[]> {
      const result: T[] = [];
      for (let offset = 0; ; offset += 500) {
        let request = db.from(table).select(columns).order(table.startsWith("competencia_") ? "competencia_id" : "id");
        if (table === "competencia_formatos_sets") request = request.order("etapa");
        for (const [key, value] of Object.entries(filters)) request = request.eq(key, value);
        if (ids) request = request.in("competencia_id", ids);
        const { data, error } = await request.range(offset, offset + 499);
        if (error || !Array.isArray(data)) throw new Error("Consulta no disponible");
        result.push(...(data ?? []) as T[]);
        if (!data || data.length < 500) return result;
      }
    }
    seasons = await read<Season>("temporadas", "id,nombre,anio");
    const season = seasons.find(s => String(s.id) === query.temporada);
    if (season) {
      dates = await read<CompetitionDate>("fechas", "id,temporada_id,numero,fecha,comuna,recinto,estado", { temporada_id: season.id });
      const date = dates.find(d => String(d.id) === query.fecha);
      if (date) {
        competitions = await read<Competition>("competencias", COMPETITION_COLUMNS, { temporada_id: season.id, fecha_id: date.id });
        [categories, rules, concepts, levels] = await Promise.all([
          read<SeasonCategory>("categorias_temporada", "id,temporada_id,categoria_id,nivel_id,codigo,rama,criterio_nacimiento,anio_nacimiento_desde,anio_nacimiento_hasta,reglamento_id,activo", { temporada_id: season.id }),
          read<Rule>("reglamentos_temporada", "id,temporada_id,version,titulo,referencia_documental,hash_documento,estado_revision,referencia_aprobacion", { temporada_id: season.id }),
          read<Concept>("categorias", "id,codigo,nombre,activo"), read<Concept>("niveles", "id,codigo,nombre,activo"),
        ]);
        if (competitions.length) [controls, formats] = await Promise.all([
          read<Preparation>("competencia_control_deportivo", PREPARATION_COLUMNS, { temporada_id: season.id }, competitions.map(c => c.id)),
          read<StageFormat>("competencia_formatos_sets", FORMAT_COLUMNS, {}, competitions.map(c => c.id)),
        ]);
        const approvedControls = await read<Preparation>("competencia_control_deportivo", PREPARATION_COLUMNS, { temporada_id: season.id });
        const approved = approvedControls.filter(p => p.configuracion_aprobada);
        if (approved.length) {
          const [sourceCompetitions, sourceFormats] = await Promise.all([
            read<Competition>("competencias", COMPETITION_COLUMNS, { temporada_id: season.id }),
            read<StageFormat>("competencia_formatos_sets", FORMAT_COLUMNS, {}, approved.map(p => p.competencia_id)),
          ]);
          templates = approved.flatMap(control => {
            const competition = sourceCompetitions.find(c => c.id === control.competencia_id);
            return competition ? [{ competition, control, formats: sourceFormats.filter(f => f.competencia_id === competition.id), label: `Competencia #${competition.id} · ${control.aprobado_en ?? "Aprobada"}` }] : [];
          });
        }
      }
    }
  } catch { failed = true; }
  const season = seasons.find(s => String(s.id) === query.temporada);
  const date = dates.find(d => String(d.id) === query.fecha);
  const editing = competitions.find(c => String(c.id) === query.competencia);
  const p = controls.find(c => c.competencia_id === editing?.id) ?? null;
  const category = categories.find(c => c.id === editing?.categoria_temporada_id) ?? null;
  const rule = rules.find(r => r.id === category?.reglamento_id) ?? null;
  const href = (id?: number) => `${JUDGE_PATH}?${new URLSearchParams({ temporada: query.temporada ?? "", fecha: query.fecha ?? "", ...(id ? { competencia: String(id) } : {}) })}`;
  const label = (c: Competition) => {
    const ct = categories.find(x => x.id === c.categoria_temporada_id);
    return ct ? `${concepts.find(x => x.id === ct.categoria_id)?.nombre ?? ct.codigo} / ${levels.find(x => x.id === ct.nivel_id)?.nombre ?? "Nivel pendiente"} · ${ct.rama ?? "Rama pendiente"}` : `Categoría #${c.categoria_temporada_id}`;
  };
  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    <JudgeNavigation current={JUDGE_PATH}/><h2 className="text-2xl font-bold">Preparación deportiva</h2>
    <p className="mb-5 mt-2 text-sm text-slate-600">Competencias individuales de una misma jornada. Los inicios pueden coincidir o ser distintos; no se impone una secuencia entre categorías. Toda hora se interpreta en America/Santiago.</p>
    <Form action={JUDGE_PATH} className="panel-card mb-5 flex flex-wrap items-end gap-3"><label className="form-label">Temporada<select className="input" name="temporada" defaultValue={query.temporada ?? ""} required><option value="">Selecciona una temporada</option>{seasons.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.anio})</option>)}</select></label><button className="btn-primary">Consultar temporada</button></Form>
    {failed ? <p role="alert" className="panel-card">No se pudo consultar la preparación deportiva. Los formularios están bloqueados. <Link href={href()} className="underline">Reintentar</Link></p> : !season ? <p className="panel-card">{seasons.length ? "Selecciona una temporada existente." : "No hay temporadas disponibles. Administración debe registrarlas."}</p> : <>
      <Form action={JUDGE_PATH} className="panel-card mb-5 flex flex-wrap items-end gap-3"><input type="hidden" name="temporada" value={season.id}/><label className="form-label">Jornada<select className="input" name="fecha" defaultValue={query.fecha ?? ""} required><option value="">Selecciona una jornada</option>{dates.map(d => <option key={d.id} value={d.id}>Fecha {d.numero} · {d.fecha.split("-").reverse().join("-")} · {d.comuna} ({d.estado})</option>)}</select></label><button className="btn-primary">Consultar jornada</button></Form>
      {!date ? <p className="panel-card">{dates.length ? "Selecciona una jornada válida de esta temporada." : "No hay jornadas registradas en esta temporada."}</p> : <>
        <p className="panel-card mb-5">Jornada {date.numero} · {date.fecha.split("-").reverse().join("-")} · {date.comuna} · {date.recinto} · {date.estado}. Su registro administrativo no acredita confirmación oficial de la Liga.</p>
        {!competitions.length ? <p className="panel-card">No hay competencias asociadas a esta jornada. Administración debe configurarlas.</p> : <QuickPreparationTable seasonId={season.id} dateId={date.id} day={date.fecha} templates={templates} rows={competitions.map(c => {
          const record = controls.find(p => p.competencia_id === c.id) ?? null;
          const ct = categories.find(ct => ct.id === c.categoria_temporada_id) ?? null;
          const regulation = rules.find(r => r.id === ct?.reglamento_id) ?? null;
          const sets = formats.filter(f => f.competencia_id === c.id);
          return { competition: c, label: label(c), record, formats: sets,
            blockers: preparationBlockers(c,date,record,ct ? { ...ct, catalogos_activos: !!concepts.find(x => x.id === ct.categoria_id)?.activo && !!levels.find(x => x.id === ct.nivel_id)?.activo } : null,regulation,sets),
            ruleId: ct?.reglamento_id ?? null,
            ruleLabel: regulation ? `${regulation.titulo} (${regulation.version}) · ${regulation.estado_revision} · ${regulation.referencia_aprobacion ?? "Sin referencia de aprobación"}` : "Reglamento pendiente",
            proposedStart: officialStart(date.fecha,concepts.find(x => x.id === ct?.categoria_id)?.codigo ?? "",levels.find(x => x.id === ct?.nivel_id)?.codigo ?? "",ct?.rama ?? null),
            advancedHref: `${href(c.id)}#preparation-form`,
          };
        })}/>}
        {query.competencia && !editing && <p role="alert" className="panel-card">La competencia no pertenece a esta jornada.</p>}
        {editing && <><h3 className="mb-3 text-xl font-bold">{label(editing)}</h3><p className="mb-3 text-sm">Reglamento: {rule ? `${rule.titulo} (${rule.version}) · ${rule.estado_revision}` : "Pendiente de asociar por Administración"}. No se valida el reglamento desde este panel.</p><PreparationForm key={editing.id} seasonId={season.id} dateId={date.id} day={date.fecha} competition={editing} record={p} formats={formats.filter(f => f.competencia_id === editing.id)} blockers={preparationBlockers(editing, date, p, category ? { ...category, catalogos_activos: !!concepts.find(c => c.id === category.categoria_id)?.activo && !!levels.find(n => n.id === category.nivel_id)?.activo } : null, rule, formats.filter(f => f.competencia_id === editing.id))} refreshHref={href(editing.id)}/></>}
      </>}
    </>}
  </DashboardShell>;
}
