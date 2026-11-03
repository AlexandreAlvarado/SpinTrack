import type { Metadata } from "next";
import { DateList } from "@/components/date-list";
import { getPublishedDates } from "@/lib/fechas";

export const metadata: Metadata = { title: "Calendario" };
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const fechas = await getPublishedDates();
  return <section className="container-page py-14"><span className="tag">Información pública</span><h1 className="mt-3 text-4xl font-extrabold">Calendario de competencias</h1><p className="mt-3 mb-8 text-slate-600">Fechas publicadas por la organización. No necesitas iniciar sesión para consultarlas.</p><DateList fechas={fechas}/></section>;
}
