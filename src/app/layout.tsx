import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";
import { ServiceWorkerRegister } from "@/components/sw-register";
import Link from "next/link";

export const metadata: Metadata = {
  title: { default: "Liga Tenis de Mesa Los Ríos", template: "%s | Liga Los Ríos" },
  description: "Calendario, inscripciones, partidos y resultados de la Liga Regional de Tenis de Mesa Los Ríos.",
  applicationName: "Liga Tenis de Mesa Los Ríos",
  appleWebApp: { capable: true, title: "Liga Los Ríos", statusBarStyle: "default" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-ink antialiased">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:p-4">Saltar al contenido</a>
        <ServiceWorkerRegister />
        <Header />
        <main id="contenido">{children}</main>
        <footer className="mt-16 border-t border-slate-200 bg-white px-6 py-7 text-center text-xs text-slate-500">
          <nav aria-label="Información legal" className="mb-3 flex justify-center gap-5"><Link className="underline" href="/terminos">Términos y condiciones</Link><Link className="underline" href="/privacidad">Privacidad</Link></nav>
          Proyecto de Título · Liga Regional de Tenis de Mesa Los Ríos · Versión inicial de desarrollo
        </footer>
      </body>
    </html>
  );
}
