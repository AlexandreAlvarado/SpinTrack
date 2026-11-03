import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return <section className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
    <WifiOff size={48} className="mb-5 text-brand"/>
    <h1 className="text-3xl font-extrabold">No tienes conexión</h1>
    <p className="mt-4 max-w-md text-slate-600">Vuelve a conectarte para consultar información actualizada de la liga. El registro de marcadores sin conexión aún no está implementado.</p>
    <Link className="btn-primary mt-6" href="/">Reintentar</Link>
  </section>;
}
