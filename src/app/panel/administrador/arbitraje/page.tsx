import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { RefereePermission } from "@/components/referee-permission";

export const dynamic = "force-dynamic";
export const metadata = { title: "Arbitraje por cuenta" };

export default async function RefereePermissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireRole("administrador");
  const query = await searchParams;
  const rawPage = Number(query.pagina ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage < 1000000 ? rawPage : 1;
  const db = await createClient();
  const { data, error } = await db.from("perfiles").select("id,nombre_completo,rol,arbitraje_habilitado").order("nombre_completo").order("id").range((page - 1) * 25, page * 25);
  const records = (data ?? []).slice(0, 25);
  return <DashboardShell role={profile.rol} nombre={profile.nombre}>
    <section className="panel-card"><h2 className="text-xl font-bold">Arbitraje por cuenta</h2>
      <p className="mt-2 text-sm text-slate-600">Habilita el registro de partidos asignados. La persona conserva su ficha deportiva y su rol principal. Solo el Juez General confirma resultados.</p>
      {error ? <p role="alert" className="mt-4">No se pudieron consultar las habilitaciones. Verifica la aplicación manual de 023.</p> : records.map(person => <article key={person.id} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div><h3 className="font-semibold">{person.nombre_completo}</h3><p className="text-sm text-slate-600">{person.id} · {person.rol} · Arbitraje {person.arbitraje_habilitado ? "habilitado" : "deshabilitado"}</p></div>
        <RefereePermission id={person.id} enabled={person.arbitraje_habilitado}/>
      </article>)}
      <nav className="mt-5 flex gap-4" aria-label="Páginas de cuentas">{page > 1 && <Link href={`?pagina=${page - 1}`}>Anterior</Link>}{!error && (data?.length ?? 0) > 25 && <Link href={`?pagina=${page + 1}`}>Siguiente</Link>}</nav>
    </section>
  </DashboardShell>;
}
