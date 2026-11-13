import Link from "next/link";
import { ROLE_LABELS, ROLE_PATHS, type Role } from "@/lib/roles";
import { AdminNavigation } from "@/components/admin-navigation";
import { JudgeNavigation } from "@/components/judge-navigation";

export function DashboardShell({ role, nombre, children }: { role: Role; nombre: string; children: React.ReactNode }) {
  const navigation = <>{role !== "administrador" && <Link href={ROLE_PATHS[role]} className="sidebar-link">Mi panel</Link>}{role === "administrador" && <AdminNavigation current="" />}{role === "juez_general" && <JudgeNavigation current="" />}<Link href="/calendario" className="sidebar-link">Calendario de jornadas</Link><Link href="/" className="sidebar-link">Inicio público</Link></>;
  return <div className="container-page py-6 sm:py-10">
    <div className="mb-7"><span className="tag">Área privada · Liga Los Ríos</span><h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{role === "administrador" ? "Panel de administración" : ROLE_LABELS[role]}</h1><p className="mt-2 text-slate-600">Bienvenido/a, {nombre}.</p></div>
    <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="panel-card dashboard-sidebar lg:sticky lg:top-44" aria-label="Navegación del panel">
        <details className="lg:hidden"><summary className="font-bold">Menú del panel</summary><div className="mt-4">{navigation}</div></details>
        <div className="hidden lg:block"><p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">{ROLE_LABELS[role]}</p>{navigation}</div>
      </aside>
      <div className="dashboard-content">{children}</div>
    </div>
  </div>;
}
