import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { validId } from "@/lib/catalogos";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { DateManagement } from "@/components/date-management";
export const dynamic = "force-dynamic";
export const metadata = { title: "Gestión de jornada" };
export default async function ManageDatePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("administrador");
  const { id } = await params;
  if (!validId(id)) notFound();
  return <DashboardShell role={profile.rol} nombre={profile.nombre}><Link className="underline" href="/panel/administrador">Volver a jornadas</Link><DateManagement id={Number(id)}/></DashboardShell>;
}
