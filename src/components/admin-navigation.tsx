import Link from "next/link";

const sections = [
  ["/panel/administrador/competencias", "Competencias por fecha"],
  ["/panel/administrador/temporadas-deportivas", "Reglamentos y categorías por temporada"],
  ["/panel/administrador", "Temporadas y fechas"],
  ["/panel/administrador/catalogos/localidades", "Localidades"],
  ["/panel/administrador/catalogos/asociaciones", "Asociaciones"],
  ["/panel/administrador/catalogos/clubes", "Clubes"],
  ["/panel/administrador/jugadores", "Jugadores"],
  ["/panel/administrador/categorias-niveles", "Categorías y niveles"],
] as const;

export function AdminNavigation({ current }: { current: string }) {
  return <nav aria-label="Gestión administrativa" className="mb-6 flex flex-wrap gap-3">
    {sections.map(([href, label]) => <Link key={href} href={href} className="btn-secondary" aria-current={current === href ? "page" : undefined}>{label}</Link>)}
  </nav>;
}
