import Link from "next/link";
import Image from "next/image";
import { getCurrentIdentity } from "@/lib/auth";
import { logout } from "@/app/actions";
import { ROLE_LABELS, ROLE_PATHS } from "@/lib/roles";
import { AuthRefresh } from "@/components/auth-refresh";

export async function Header() {
  const { authenticated, profile } = await getCurrentIdentity();
  return <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
    <AuthRefresh />
    <nav className="container-page flex flex-wrap items-center justify-between gap-3 py-3" aria-label="Navegación principal">
      <Link href="/" aria-label="Liga Los Ríos · Inicio" className="flex min-w-0 items-center gap-3"><Image src="/logo-liga-los-rios.png" alt="" width={761} height={725} className="h-16 w-auto shrink-0 object-contain" priority /><span className="text-sm font-bold leading-tight sm:text-base">Liga Regional<span className="mt-1 block text-xs font-medium text-slate-600">Tenis de Mesa · Los Ríos</span></span></Link>
      <div className="grid w-full grid-cols-4 items-center gap-1 text-center text-xs font-semibold sm:flex sm:w-auto sm:gap-2 sm:text-sm [&>.nav-link]:px-1 sm:[&>.nav-link]:px-3">
        <Link href="/" className="nav-link">Inicio</Link>
        <Link href="/calendario" className="nav-link">Calendario</Link>
        <Link href="/ranking" className="nav-link">Ranking</Link>
        {authenticated ? <details className="relative">
          <summary className="btn-secondary w-full min-w-0 max-w-56 cursor-pointer list-none px-2 sm:px-4" aria-label="Menú de usuario"><span className="truncate">{profile?.nombre ?? "Mi cuenta"}</span><span aria-hidden="true">⌄</span></summary>
          <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            <p className="break-words px-3 pb-2 text-left font-semibold">{profile?.nombre ?? "Mi cuenta"}</p>
            <p className="mb-2 border-b border-slate-100 px-3 pb-3 text-xs text-slate-600">{profile ? ROLE_LABELS[profile.rol] : "No se pudo verificar tu perfil"}</p>
            <Link href={profile ? ROLE_PATHS[profile.rol] : "/panel"} className="nav-link block">Mi panel</Link>
            <form action={logout}><button type="submit" className="nav-link w-full text-left">Cerrar sesión</button></form>
          </div>
        </details> : <Link href="/login" className="btn-primary px-2">Ingresar</Link>}
      </div>
    </nav>
  </header>;
}
