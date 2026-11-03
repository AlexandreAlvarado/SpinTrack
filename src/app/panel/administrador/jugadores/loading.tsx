export default function PlayersLoading() {
  return <section className="container-page py-10" role="status" aria-busy="true" aria-live="polite"><div className="panel-card animate-pulse"><h2 className="text-xl font-bold">Cargando jugadores…</h2><p className="mt-3 text-slate-600">Consultando registros y opciones del formulario.</p></div></section>;
}
