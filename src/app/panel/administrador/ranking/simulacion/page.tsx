import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { RankingSimulation } from "@/components/ranking-simulation";
import { loadRankingSimulation } from "@/lib/ranking-simulation-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Simulación de ranking" };

export default async function RankingSimulationPage({ searchParams }: { searchParams: Promise<{ competencia?: string }> }) {
  const profile = await requireRole("administrador");
  const enabled = process.env.NODE_ENV !== "production";
  if (!enabled) notFound();
  const query = await searchParams;
  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    <SimulationContent selected={query.competencia}/>
  </DashboardShell>;
}

async function SimulationContent({ selected }: { selected?: string }) {
  const selectedId = selected && /^[1-9]\d*$/.test(selected) ? Number(selected) : null;
  const result = await loadRankingSimulation(selectedId).catch(() => null);
  if (!result) {
    return <section className="panel-card"><h2 className="text-xl font-bold">Simulación de ranking</h2><p role="alert" className="mt-2 text-sm">No se pudieron leer los resultados deportivos confirmados. No se muestra una simulación parcial.</p><Link className="btn-secondary mt-4" href="/panel/administrador/ranking">Volver al ranking oficial</Link></section>;
  }
  if (!("candidate" in result)) return <section className="panel-card"><h2 className="text-xl font-bold">Simulación de ranking</h2><p className="mt-2 text-sm">{result.warning}</p><Link className="btn-secondary mt-4" href="/panel/administrador/ranking">Volver al ranking oficial</Link></section>;
  return <RankingSimulation data={result}/>;
}
