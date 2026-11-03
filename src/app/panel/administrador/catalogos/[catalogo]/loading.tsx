export default function CatalogLoading() {
  return <section className="container-page py-10" role="status" aria-live="polite" aria-busy="true">
    <div className="panel-card animate-pulse"><h2 className="text-xl font-bold">Cargando catálogo…</h2><p className="mt-3 text-slate-600">Consultando los registros y sus relaciones.</p></div>
  </section>;
}
