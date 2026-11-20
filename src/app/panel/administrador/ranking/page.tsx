import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { RankingManagement } from "@/components/ranking-management";
export const dynamic = "force-dynamic";
export const metadata = { title: "Configurar ranking oficial" };
export default async function Page() {
  const profile = await requireRole("administrador");
  return <DashboardShell role={profile.rol} nombre={profile.nombre}><RankingManagement/></DashboardShell>;
}
