"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

const base = "/panel/administrador";
const groups = [
  { label: "Gestión de la Liga", items: [
    { label: "Temporadas y jornadas", href: base },
    { label: "Competencias", href: base + "/competencias" },
    { label: "Jugadores", href: base + "/jugadores" },
  ] },
  { label: "Organización", items: [
    { label: "Clubes y asociaciones", children: [
      { label: "Clubes", href: base + "/catalogos/clubes" },
      { label: "Asociaciones", href: base + "/catalogos/asociaciones" },
    ] },
    { label: "Localidades", href: base + "/catalogos/localidades" },
  ] },
  { label: "Configuración", items: [
    { label: "Reglamentos y categorías", children: [
      { label: "Por temporada", href: base + "/temporadas-deportivas" },
      { label: "Categorías y niveles", href: base + "/categorias-niveles" },
    ] },
  ] },
] as const;

export function AdminNavigation({ current = "" }: { current?: string }) {
  const pathname = usePathname();
  const active = current || pathname;
  const link = (item: { href: string; label: string }) => <Link key={item.href} href={item.href} className="sidebar-link !py-2" aria-current={active === item.href ? "page" : undefined}>{item.label}</Link>;
  return <nav aria-label="Gestión administrativa" className="space-y-4">
    {groups.map(group => <section key={group.label} aria-label={group.label}>
      <h2 className="mb-1 px-3 text-xs font-bold uppercase tracking-wide text-slate-500">{group.label}</h2>
      {group.items.map(item => "children" in item ? <details key={item.label + active} open={item.children.some(child => child.href === active)}>
        <summary className={"sidebar-link cursor-pointer !py-2 " + (item.children.some(child => child.href === active) ? "bg-blue-50 text-brand" : "")}>{item.label}</summary>
        <div className="ml-3 border-l border-slate-200 pl-1">{item.children.map(link)}</div>
      </details> : link(item))}
    </section>)}
  </nav>;
}
