// Escenario HISTÓRICO retirado; no es la secuencia vigente y no se ejecuta en esta revisión.
// Hereda pruebas 028 y 023 en PostgreSQL temporal. No lee .env ni toca Supabase.
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const url = new URL('./028_jornadas_legal.test.mjs', import.meta.url);
let source = fs.readFileSync(url, 'utf8').replaceAll('pg028-runner', 'pg030-runner');
source = source.replace("  console.log('028 PostgreSQL:", String.raw`
  sql(file('supabase/migrations/029_editar_perfil_deportivo.sql'));
  const accepted030=sql('select jsonb_agg(to_jsonb(a) order by usuario_id,version) from public.aceptaciones_legales_028 a');
  const people030=sql('select jsonb_agg(to_jsonb(j) order by id) from public.jugadores j');
  const accounts030=sql('select count(*) from auth.users');
  sql(file('supabase/referencias-retiradas/030_resguardo_revision_institucional.sql'));
  for(const session030 of ['set role anon;',player,judge,admin]) {
    const visible030=json028(sql(session030+'select public.consultar_torneos_publicos_025(4004);'));
    assert.deepEqual(visible030.competencias,[]);
    assert.equal(visible030.detalle,null);
    assert.ok(Array.isArray(visible030.jornadas));
    assert.deepEqual(json028(sql(session030+'select public.consultar_ranking_publico_026();')),[]);
    sql(session030+reject('select public.torneos_internos_revision_030(4004);')+reject('select public.ranking_interno_revision_030();'));
  }
  sql(player+reject("select public.editar_mi_perfil_deportivo_029(4004,null,null,null,'{}');"));
  sql(player+reject("select public.aceptar_terminos_028('2026-11-19.1',true);",'55000'));
  sql("select public.reject004($q$insert into auth.users(id,email,raw_user_meta_data) values('e0300000-0000-0000-0000-000000000001','local@example.test','{\"full_name\":\"Prueba\",\"terminos_version\":\"2026-11-19.1\",\"terminos_aceptados\":true,\"adulto\":true,\"autorizado\":true}')$q$,'55000');");
  assert.equal(sql('select count(*) from auth.users'),accounts030);
  assert.equal(sql('select jsonb_agg(to_jsonb(a) order by usuario_id,version) from public.aceptaciones_legales_028 a'),accepted030);
  assert.equal(sql('select jsonb_agg(to_jsonb(j) order by id) from public.jugadores j'),people030);
  assert.equal(sql(sports028),historical028);
  console.log('030 PostgreSQL: cierre directo de RPC, alta y aceptación; calendario sin participantes; datos e historial intactos.');
  console.log('028 PostgreSQL:`);
const runner = fileURLToPath(new URL('./.legal030-driver.mjs', import.meta.url));
fs.writeFileSync(runner, source);
try { await import(pathToFileURL(runner).href); } finally { fs.unlinkSync(runner); }
