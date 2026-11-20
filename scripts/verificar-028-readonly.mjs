// Solo GET, sin sesión de usuario, sin escrituras ni datos personales.
import { createClient } from '@supabase/supabase-js';
if (process.env.LOAD_LOCAL_ENV !== 'false') process.loadEnvFile('.env.local');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw Error('Falta configuración pública de Supabase');
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) },
});
const version = await db.from('version_legal_028').select('version').eq('id', true).limit(1);
const status = await db.rpc('estado_legal_028', undefined, { get: true });
const denied = {};
for (const table of ['perfiles', 'jugadores', 'aceptaciones_legales_028', 'jornadas_operaciones_028']) {
  const result = await db.from(table).select('*', { head: true, count: 'exact' }).limit(0);
  denied[table] = [401,403].includes(result.status) || result.error?.code === '42501' ? 'denegado'
    : result.error ? `error:${result.error.code || 'red'}`
    : result.count === 0 ? 'sin filas visibles (SELECT permitido con RLS)'
    : 'visibilidad de filas: revisar ACL/RLS';
}
const calendar = await db.from('fechas').select('id', { head: true }).limit(0);
// HEAD comprueba acceso directo a las proyecciones, sin descargar nombres ni resultados.
const publicRpcAccess = {};
for (const name of ['consultar_torneos_publicos_025', 'consultar_ranking_publico_026']) {
  const response = await db.rpc(name, undefined, { head: true, get: true });
  publicRpcAccess[name] = { status: response.status, permitido: !response.error };
}
const result = {
  version: version.error ? { error: version.error.code || 'red' } : version.data?.[0]?.version ?? null,
  consultaLegal: status.error ? { error: status.error.code || 'red' } : status.data,
  accesoAnonimo: denied,
  rpcPublicasAnonimas: publicRpcAccess,
  calendarioPublico: calendar.error ? { error: calendar.error.code || 'red' } : 'consulta permitida sin leer filas',
  limite: 'No prueba escrituras, triggers, permisos administrativos ni RLS autenticado. Usar el SQL de catálogo de solo lectura para completar la auditoría.',
};
console.log(JSON.stringify(result, null, 2));
if (result.version !== '2026-11-19.1' || status.error || status.data?.aceptada !== false || Object.values(denied).some(value => !['denegado','sin filas visibles (SELECT permitido con RLS)'].includes(value))) process.exitCode = 1;
