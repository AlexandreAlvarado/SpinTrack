import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { PLAYER_COLUMNS, todayInChile, type PlayerRecord } from "@/lib/jugadores";
import { AuthSubmit } from "@/components/auth-controls";
import { saveSportsProfile } from "./actions";
import { PERSONAL_DATA_REVIEW_PENDING } from "@/lib/legal";

export const metadata = { title: "Mi perfil deportivo" };
export const dynamic = "force-dynamic";
type Option = { id: number; nombre: string; activo: boolean };

export default async function SportsProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const profile = await requireProfile();
  const params = await searchParams;
  const db = await createClient();
  const result = await db.from("jugadores").select(PLAYER_COLUMNS).eq("perfil_id", profile.id).maybeSingle();
  const player = result.data as PlayerRecord | null;
  let failed = !!result.error || (!!player && player.perfil_id !== profile.id);
  async function catalog(table: "clubes" | "localidades") {
    const rows: Option[] = [];
    for (let start = 0; ; start += 500) {
      const res = await db.from(table).select("id,nombre,activo").order("id").range(start, start + 499);
      if (res.error || !Array.isArray(res.data)) { failed = true; return []; }
      rows.push(...res.data as Option[]);
      if (res.data.length < 500) return rows;
    }
  }
  const [clubs, localities] = !failed && player ? await Promise.all([catalog("clubes"), catalog("localidades")]) : [[], []];
  const select = (name: string, label: string, options: Option[], current: number | null) => <label className="form-label">{label}<select className="input" name={name} defaultValue={current ?? ""}><option value="">Sin registrar</option>{options.filter(item => item.activo || item.id === current).map(item => <option key={item.id} value={item.id}>{item.nombre}{!item.activo ? " (inactivo)" : ""}</option>)}</select></label>;
  return <DashboardShell role="jugador" nombre={profile.nombre} arbitrajeHabilitado={profile.arbitrajeHabilitado}>
    <section className="panel-card mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Mi perfil deportivo</h1>
      <p>Cuenta: {profile.nombre}</p>
      <p>Habilitación arbitral: <strong>{profile.arbitrajeHabilitado ? "Habilitada" : "No habilitada"}</strong>. Solo el Administrador puede modificarla. Puedes jugar y arbitrar con esta misma cuenta, sin dirigir tus propios partidos.</p>
      {failed ? <p role="alert" className="message-error">No pudimos comprobar tu ficha o sus catálogos. Recarga la página antes de editar.</p> : player ? <>
        <p>Ficha vinculada: #{player.id} · {player.nombre_completo} · {player.activo ? "Activa" : "Inactiva"}.</p>
        <p className="text-sm text-slate-600">Estos datos son opcionales. Completa el nacimiento cuando sea necesario para validar categorías por edad. Guardar no concede habilitación deportiva ni confirma una categoría. El club utiliza el catálogo existente; no implica afiliación oficial. Para corregir el nombre o la vinculación, contacta al Administrador.</p>
        <p className="text-sm text-slate-600">No puedes borrar datos existentes desde este formulario. Si ya hay habilitaciones, inscripciones o antecedentes deportivos, solicita una corrección supervisada al Administrador.</p>
        {params.error && <p role="alert" className="message-error">{params.error === "datos" ? "Revisa la fecha y las opciones. No dejes vacío un dato que ya estaba registrado." : params.error === "antecedentes" ? "Tu ficha tiene antecedentes deportivos y requiere una corrección supervisada por el Administrador." : params.error === "cambio" ? "La ficha cambió mientras editabas. Revisa los datos actuales y vuelve a guardar." : "No se pudo guardar. Comprueba tu sesión y la vinculación; si persiste, contacta al Administrador para revisar la disponibilidad de la edición."}</p>}
        {params.ok === "1" && <p role="status" className="message-success">Perfil deportivo guardado.</p>}
        {PERSONAL_DATA_REVIEW_PENDING ? <p role="status" className="rounded-lg bg-amber-50 p-3">La edición deportiva está temporalmente suspendida durante la revisión institucional y del procedimiento de menores. No envíes datos nuevos; consulta a la Liga en lrtenisdemesalr@gmail.com.</p> : <form action={saveSportsProfile} className="space-y-5">
          <input type="hidden" name="jugador_id" value={player.id}/>
          <input type="hidden" name="esperado" value={JSON.stringify({ fecha_nacimiento: player.fecha_nacimiento, club_id: player.club_id, localidad_procedencia_id: player.localidad_procedencia_id })}/>
          <label className="form-label">Fecha de nacimiento (opcional)<input className="input" type="date" name="fecha_nacimiento" defaultValue={player.fecha_nacimiento ?? ""} max={todayInChile()}/></label>
          {select("club_id", "Club (opcional)", clubs, player.club_id)}
          {select("localidad_procedencia_id", "Localidad de procedencia (opcional)", localities, player.localidad_procedencia_id)}
          <AuthSubmit>Guardar perfil deportivo</AuthSubmit>
        </form>}
      </> : <p role="status">Tu cuenta todavía no tiene una ficha deportiva vinculada. Solicita la vinculación al Administrador, quien verificará tu identidad y si ya existe una ficha. No se crean ni vinculan fichas por coincidencias de nombres o correos.</p>}
      <Link className="inline-block font-bold text-brand underline" href="/panel/jugador">Volver a mi panel</Link>
    </section>
  </DashboardShell>;
}
