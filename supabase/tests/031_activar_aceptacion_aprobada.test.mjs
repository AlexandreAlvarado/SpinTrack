// Solo PostgreSQL temporal y usuarios sintéticos. Nunca conecta a Supabase.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
const url=new URL('./023_habilitacion_arbitraje.test.mjs',import.meta.url);
let source=fs.readFileSync(url,'utf8').replaceAll('import.meta.url',JSON.stringify(url.href));
const marker="  console.log('023 PostgreSQL temporal:";
assert.equal(source.split(marker).length,2);
source=source.replace(marker,()=>String.raw`
  for(const name031 of ['025_lectura_torneos_publicos.sql','026_ranking_oficial_2026.sql','027_mesas_programacion.sql','028_jornadas_y_aceptacion_legal.sql','029_editar_perfil_deportivo.sql']) sql(file('supabase/migrations/'+name031));
  sql(file('supabase/referencias-retiradas/030_resguardo_revision_institucional.sql')); // Escenario historico, fuera de la secuencia vigente.
  const people031=sql('select jsonb_agg(to_jsonb(p) order by id) from public.perfiles p');
  const players031=sql('select jsonb_agg(to_jsonb(j) order by id) from public.jugadores j');
  const accounts031=sql('select jsonb_agg(to_jsonb(u) order by id) from auth.users u');
  const sports031=sql('select jsonb_build_array((select jsonb_agg(to_jsonb(p) order by id) from public.partidos p),(select jsonb_agg(to_jsonb(r) order by id) from public.resultados_partidos r))');
  const migration031=file('supabase/referencias-retiradas/031_activar_aceptacion_aprobada.sql');
  sql(migration031);
  assert.equal(sql('select jsonb_agg(to_jsonb(u) order by id) from auth.users u'),accounts031);
  assert.equal(sql('select jsonb_agg(to_jsonb(p) order by id) from public.perfiles p'),people031);
  assert.equal(sql('select jsonb_agg(to_jsonb(j) order by id) from public.jugadores j'),players031);
  sql(player+reject("select public.aceptar_terminos_028('falsa',true);",'22023')+reject("select public.aceptar_terminos_028('2026-11-19.1',false);",'22023'));
  sql("set role anon;"+reject("select public.aceptar_terminos_028('2026-11-19.1',true);"));
  sql(player+"select public.aceptar_terminos_028('2026-11-19.1',true);");
  const accepted031=sql('select jsonb_agg(to_jsonb(a) order by usuario_id,version) from public.aceptaciones_legales_028 a');
  sql(player+"select public.aceptar_terminos_028('2026-11-19.1',true);");
  assert.equal(sql('select jsonb_agg(to_jsonb(a) order by usuario_id,version) from public.aceptaciones_legales_028 a'),accepted031,'Repetir conserva fecha y registro');
  assert.equal(JSON.parse(sql(player+'select public.estado_legal_028();').split('\n').at(-1)).aceptada,true);
  sql(judge+"select public.check004(not (public.estado_legal_028()->>'aceptada')::boolean,'Otra cuenta no hereda aceptación');select public.check004((select count(*)=0 from public.aceptaciones_legales_028),'RLS limita al titular');");
  sql(player+reject("insert into public.aceptaciones_legales_028(usuario_id,version,origen,aceptado_en) values(auth.uid(),'falsa','sesion','2099-01-01');")+reject("update public.aceptaciones_legales_028 set aceptado_en='2099-01-01';"));
  sql("select public.reject004($q$insert into auth.users(id,email,raw_user_meta_data) values('e0310000-0000-0000-0000-000000000001','local@example.test','{}')$q$,'23514');");
  sql("insert into auth.users(id,email,raw_user_meta_data) values('e0310000-0000-0000-0000-000000000001','local@example.test','{\"full_name\":\"Alta sintética\",\"rol\":\"administrador\",\"terminos_version\":\"2026-11-19.1\",\"terminos_aceptados\":true,\"aceptado_en\":\"2099-01-01\"}');");
  sql("select public.check004((select rol='jugador' from public.perfiles where id='e0310000-0000-0000-0000-000000000001'),'Sin escalada de rol');select public.check004((select origen='registro' and aceptado_en<now()+interval '1 minute' from public.aceptaciones_legales_028 where usuario_id='e0310000-0000-0000-0000-000000000001'),'Alta con fecha del servidor');");
  sql("set role authenticated;select set_config('request.jwt.claims','{\"sub\":\"e0310000-0000-0000-0000-000000000001\"}',false);select public.check004((public.estado_legal_028()->>'aceptada')::boolean,'Registro reconocido sin repetición');");
  assert.equal(sql("select public.consultar_ranking_publico_026()"),'[]','Aceptación no reabre publicación personal');
  assert.equal(sql('select jsonb_build_array((select jsonb_agg(to_jsonb(p) order by id) from public.partidos p),(select jsonb_agg(to_jsonb(r) order by id) from public.resultados_partidos r))'),sports031);
  const allAccepted031=sql('select jsonb_agg(to_jsonb(a) order by usuario_id,version) from public.aceptaciones_legales_028 a');
  sql(migration031);
  assert.equal(sql('select jsonb_agg(to_jsonb(a) order by usuario_id,version) from public.aceptaciones_legales_028 a'),allAccepted031,'Aplicación idempotente');
  sql("delete from public.version_legal_028;");sql(migration031);
  assert.equal(sql('select version from public.version_legal_028'),'2026-11-19.1','Repara configuración ausente sin tocar aceptaciones');
  sql("create database liga_031_clean;");
  const cleanArgs031=args.map(value=>value==='liga_023_test'?'liga_031_clean':value);
  const clean031=run('psql',cleanArgs031,"create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;grant usage on schema auth to anon,authenticated;"+migration031);
  assert.equal(clean031.status,0,clean031.stderr);
  console.log('031 PostgreSQL: instalación legal independiente, recuperación, registro, aceptación persistente, RLS, idempotencia y permisos aprobados.');
`+marker);
const runner=fileURLToPath(new URL('../../test-results/pg031-runner.mjs',import.meta.url));
fs.writeFileSync(runner,source);
try {await import(pathToFileURL(runner).href);} finally {fs.unlinkSync(runner);}
