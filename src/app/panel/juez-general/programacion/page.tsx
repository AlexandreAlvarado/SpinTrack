import { DashboardShell } from "@/components/dashboard-shell";
import { Scheduling } from "@/components/scheduling";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ScheduleData } from "@/lib/programacion";
export const dynamic = "force-dynamic";
export const metadata = { title: "Mesas y programación · Juez General" };
export default async function SchedulingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireRole("juez_general");
  const query = await searchParams;
  const db = await createClient();
  const dates: { id: number; numero: number; fecha: string; temporada_id: number }[] = [];
  let error = "";
  for (let offset = 0;; offset += 500) {
    const response = await db.from("fechas").select("id,numero,fecha,temporada_id").order("fecha", { ascending: false }).order("id").range(offset, offset + 499);
    if (response.error) { error = "No se pudieron consultar las jornadas."; break; }
    dates.push(...response.data);
    if (response.data.length < 500) break;
  }
  const date = dates.find(d => String(d.id) === (query.fecha ?? query.jornada));
  let data: ScheduleData | null = null;
  if (date) {
    const response = await db.rpc("consultar_programacion_027", { p_fecha_id: date.id });
    if (response.error) error = ["42883", "42P01", "PGRST202", "PGRST205"].includes(response.error.code) ? "Para habilitar esta vista falta aplicar manualmente la migración 027 y sus dependencias." : "No se pudo consultar la programación. Recarga antes de continuar.";
    else data = response.data as ScheduleData;
  }
  return <DashboardShell role={profile.rol} nombre={profile.nombre}><h2 className="text-2xl font-bold">Mesas y programación</h2><p className="my-3 text-sm text-slate-600">Recursos compartidos por todas las categorías de la jornada. La propuesta requiere confirmación del Juez General.</p>
    <form className="panel-card mb-4 flex flex-wrap items-end gap-3"><label className="form-label">Jornada<select className="input" name="fecha" defaultValue={date?.id ?? ""} required><option value="">Selecciona una jornada</option>{dates.map(d => <option key={d.id} value={d.id}>{d.fecha} · Jornada {d.numero} · Temporada #{d.temporada_id}</option>)}</select></label><button className="btn-secondary">Consultar</button></form>
    {error && <p className="panel-card" role="alert">{error}</p>}{date && data && !error && <Scheduling key={date.id} dateId={date.id} data={data} asOf={new Date().toISOString()} />}
  </DashboardShell>;
}
