import Link from "next/link";
export default function NotFound() {return <div className="container-page py-24 text-center"><h1 className="text-4xl font-extrabold">Página no encontrada</h1><p className="my-5 text-slate-600">Revisa la dirección o vuelve al inicio.</p><Link href="/" className="btn-primary">Volver al inicio</Link></div>}
