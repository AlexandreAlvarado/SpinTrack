import Link from "next/link";
import { logout } from "@/app/actions";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { LogOut, LayoutDashboard, Home } from "lucide-react";

export function DashboardShell({ role, nombre, children }: { role: Role; nombre: string; children: React.ReactNode }) {
  return <div className="container-page py-10"><div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><span className="tag">Panel privado</span><h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{ROLE_LABELS[role]}</h1><p className="mt-2 text-slate-600">Bienvenido/a, {nombre}. Esta área solo permite las acciones de tu perfil.</p></div><form action={logout}><button className="btn-secondary text-sm" type="submit"><LogOut size={17}/> Cerrar sesión</button></form></div><nav className="mb-7 flex flex-wrap gap-3 text-sm font-semibold"><Link href="/" className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-slate-600 shadow-sm"><Home size={15}/> Inicio</Link><Link href="/panel" className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-slate-600 shadow-sm"><LayoutDashboard size={15}/> Mi panel</Link></nav>{children}</div>;
}
