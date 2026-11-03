import Link from "next/link";
import { Trophy, LogIn } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <nav className="container-page flex min-h-20 flex-wrap items-center justify-between gap-3 py-3" aria-label="Navegación principal">
        <Link href="/" className="flex items-center gap-3 font-bold tracking-tight text-ink">
          <span className="rounded-xl bg-brand p-2.5 text-white"><Trophy size={23} aria-hidden="true" /></span>
          <span className="leading-tight">Liga Tenis de Mesa <span className="block text-xs font-semibold text-slate-500">Región de Los Ríos</span></span>
        </Link>
        <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-600">
          <Link href="/calendario" className="hover:text-brand">Calendario</Link>
          <Link href="/panel" className="hover:text-brand">Mi panel</Link>
          <Link href="/login" className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-white hover:bg-slate-700"><LogIn size={16} /> Ingresar</Link>
        </div>
      </nav>
    </header>
  );
}
