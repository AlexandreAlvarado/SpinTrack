// PostgreSQL 18 temporal propio, solo loopback: nunca usa URLs ni claves Supabase.
// Desde la raiz: node supabase/tests/006_retirar_dependencia_tarifa.test.mjs
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const bin = "C:/Program Files/PostgreSQL/18/bin";
const scratchRoot = path.resolve(root, "test-results");
fs.mkdirSync(scratchRoot, { recursive: true });
const scratch = fs.mkdtempSync(path.join(scratchRoot, "pg006-"));
const data = path.join(scratch, "data");
const port = "55406";
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("PG"))), PGHOST: "127.0.0.1", PGPORT: port, PGUSER: "postgres", PGPASSWORD: "", PGDATABASE: "liga_006_test", PGSSLMODE: "disable", PGCONNECT_TIMEOUT: "5" };
const file = name => fs.readFileSync(path.join(root, name), "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
function run(program, args, input) {
  return spawnSync(path.join(bin, program + ".exe"), args, { env, input, encoding: "utf8", timeout: 120000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
}
function sql(input, succeeds = true) {
  const result = run("psql", ["-X", "-h", "127.0.0.1", "-p", port, "-U", "postgres", "-d", env.PGDATABASE, "-v", "ON_ERROR_STOP=1", "-Atq"], input);
  if (succeeds) assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  else { assert.notEqual(result.status, 0); assert.match(result.stderr, /006:/); }
  return result.stdout.trim();
}
const initial = ["001_base_segura.sql", "002_identidad_deportiva.sql", "003_categorias_competencias.sql"].map(name => file("supabase/migrations/" + name)).join("\n");
const historical = file("supabase/tests/004_historica.fixture.sql");
const fifth = file("supabase/migrations/005_eliminar_cupo_maximo.sql");
const bootstrap = `create schema auth;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
grant usage on schema auth to anon,authenticated,service_role;`;
const sourceSuite = file("supabase/tests/004_inscripciones.test.sql").replaceAll("55404", port).replaceAll("liga_004_test", "liga_006_test");
const setup = sourceSuite.slice(0, sourceSuite.indexOf("\nbegin;\nset local role authenticated;"));
const before004 = `create temp table permisos_previos004 as
select 'tabla'::text tipo,oid,relacl::text acl from pg_class where relnamespace in ('public'::regnamespace,'auth'::regnamespace)
union all select 'funcion',oid,proacl::text from pg_proc where pronamespace in ('public'::regnamespace,'auth'::regnamespace)
union all select 'esquema',oid,nspacl::text from pg_namespace where nspname in ('public','auth');`;

let started = false;
try {
  const init = run("initdb", ["-D", data, "-U", "postgres", "-A", "trust", "--encoding=UTF8", "--locale=C"]);
  assert.equal(init.status, 0, init.error?.message ?? init.stderr);
  const start = run("pg_ctl", ["-D", data, "-l", path.join(scratch, "server.log"), "-o", "-h 127.0.0.1 -p " + port, "-w", "start"]);
  assert.equal(start.status, 0, start.error?.message ?? start.stderr);
  started = true;
  console.log("006: cluster temporal propio iniciado en loopback:55406.");
  env.PGDATABASE = "postgres";
  sql("create role anon; create role authenticated; create role service_role; create database liga_006_test;");
  env.PGDATABASE = "liga_006_test";
  assert.equal(sql("select current_setting('data_directory');").replaceAll("\\", "/").toLowerCase(), data.replaceAll("\\", "/").toLowerCase());
  sql(bootstrap + initial + historical);
  if (process.argv.includes("--inspect-base")) {
    sql(fifth);
    console.log(sql("select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.competencias'::regclass and pg_get_constraintdef(oid) like '%tarifa_clp%';"));
  } else {
    const migration = file("supabase/migrations/006_retirar_dependencia_tarifa.sql");
    sql(migration, false); // 004 historica sin 005 no es compatible.
    sql(fifth + setup);
    console.log("006: base historica + 005 preparada; comprobando precondiciones y deriva.");
    // Variante de permisos 003 observada en Supabase: debe conservarse, no revocarse.
    sql("grant execute on function public.validar_competencia_003() to service_role;");
    const validator = sql("select pg_get_functiondef('privado_inscripciones.validar_inscripcion_004()'::regprocedure);");
    sql(validator.replace("clock_timestamp()", "statement_timestamp()"));
    sql(migration, false);
    sql(validator);
    sql("alter function privado_inscripciones.validar_inscripcion_004() security invoker;");
    sql(migration, false);
    sql(validator);
    sql("alter table public.inscripciones disable trigger validar_inscripcion;");
    sql(migration, false);
    sql("alter table public.inscripciones enable trigger validar_inscripcion;");
    sql("grant execute on function privado_inscripciones.validar_inscripcion_004() to authenticated;");
    sql(migration, false);
    sql("revoke execute on function privado_inscripciones.validar_inscripcion_004() from authenticated;");
    sql("alter table public.inscripciones disable row level security;");
    sql(migration, false);
    sql("alter table public.inscripciones enable row level security;");
    sql("alter table public.competencias add constraint fee_drift check (tarifa_clp is not null);");
    sql(migration, false);
    sql("alter table public.competencias drop constraint fee_drift;");
    const oldConstraint = sql("select conname from pg_constraint where conrelid='public.competencias'::regclass and pg_get_constraintdef(oid) like '%inscripciones_habilitadas%' and pg_get_constraintdef(oid) like '%tarifa_clp%';");
    assert.match(oldConstraint, /^[a-z0-9_]+$/);
    sql(`alter table public.competencias drop constraint ${oldConstraint}; alter table public.competencias add constraint ${oldConstraint} check (not inscripciones_habilitadas or (publicada and tarifa_clp is not null and inscripcion_abre_en is not null and inscripcion_cierra_en is not null));`);
    sql(migration, false);
    sql(`alter table public.competencias drop constraint ${oldConstraint}; alter table public.competencias add constraint ${oldConstraint} check (not inscripciones_habilitadas or (activo and publicada and tarifa_clp is not null and inscripcion_abre_en is not null and inscripcion_cierra_en is not null));`);
    // Datos anteriores a 006: valor monetario e historial reales dentro del fixture aislado.
    sql(`select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',false);
      select public.solicitar_inscripcion(4006,4004,'Fixture historico');`);
    const snapshot = `select jsonb_build_object(
      'tables',(select jsonb_agg(to_jsonb(t) order by t.oid) from (select oid,relowner,relacl,relrowsecurity,relforcerowsecurity from pg_class where relnamespace in ('public'::regnamespace,'auth'::regnamespace)) t),
      'functions',(select jsonb_agg(to_jsonb(t) order by t.oid) from (select oid,proowner,proacl,proconfig,prosecdef,provolatile,case when oid='privado_inscripciones.validar_inscripcion_004()'::regprocedure then null else prosrc end as source from pg_proc where pronamespace in ('public'::regnamespace,'auth'::regnamespace,'privado_inscripciones'::regnamespace)) t),
      'schemas',(select jsonb_agg(to_jsonb(t) order by t.oid) from (select oid,nspowner,nspacl from pg_namespace where nspname in ('public','auth','privado_inscripciones')) t),
      'columns',(select jsonb_agg(to_jsonb(t) order by t.attrelid,t.attnum) from (select attrelid,attnum,atttypid,attnotnull,atthasdef,attacl from pg_attribute where attrelid in (select oid from pg_class where relnamespace='public'::regnamespace) and attnum>0) t),
      'constraints',(select jsonb_agg(to_jsonb(t) order by t.oid) from (select oid,conrelid,conname,convalidated,pg_get_constraintdef(oid) def from pg_constraint where connamespace in ('public'::regnamespace,'auth'::regnamespace) and not (conrelid='public.competencias'::regclass and conname='${oldConstraint}')) t),
      'triggers',(select jsonb_agg(to_jsonb(t) order by t.oid) from (select oid,tgenabled,pg_get_triggerdef(oid) def from pg_trigger where tgrelid in (select oid from pg_class where relnamespace='public'::regnamespace)) t),
      'policies',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_policy t),
      'fees',(select jsonb_agg(to_jsonb(c) order by c.id) from public.competencias c),
      'requests',(select jsonb_agg(to_jsonb(i) order by i.id) from public.inscripciones i),
      'history',(select jsonb_agg(to_jsonb(h) order by h.id) from public.inscripciones_historial h));`;
    const before = sql(snapshot);
    const sourceBefore = sql("select prosrc from pg_proc where oid='privado_inscripciones.validar_inscripcion_004()'::regprocedure;");
    sql(migration);
    assert.equal(sql(snapshot), before, "Datos, seguridad y objetos ajenos al cambio permanecen iguales");
    assert.equal(sql("select prosrc from pg_proc where oid='privado_inscripciones.validar_inscripcion_004()'::regprocedure;"), sourceBefore.replace(" or c.tarifa_clp is null", ""));
    sql(migration, false);
    console.log("006: precondiciones, deriva, reaplicacion, atomicidad, ACL/RLS, OID, triggers e historicos: correctos.");
    // Suite integral existente sin tarifa en ninguna de sus competencias.
    env.PGDATABASE = "postgres";
    sql("create database liga_006_flow;");
    env.PGDATABASE = "liga_006_flow";
    const nullSuite = sourceSuite.replaceAll("liga_006_test", "liga_006_flow")
      .replace("4004,4004,4004,4004,5000,2", "4004,4004,4004,4004,null,2")
      .replace("4005,4004,4004,4005,5000,null", "4005,4004,4004,4005,null,null")
      .replace("'tarifa_clp',5000", "'tarifa_clp',null");
    sql(bootstrap + initial + before004 + historical + fifth + migration + nullSuite);
    assert.equal(sql("select bool_and(tarifa_clp is null) from public.competencias;"), "t");
    console.log("006: suite integral sin tarifa aprobada: habilitar, solicitar, aceptar/rechazar/cancelar, elegibilidad, roles, plazos, historial, 103 inscritos y concurrencia real.");
  }
} finally {
  if (started) {
    const stopped = run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
    assert.equal(stopped.status, 0, stopped.stderr);
  }
  // Borrar solo nuestro directorio temporal verificado, nunca un cluster externo.
  const resolved = fs.realpathSync(scratch);
  assert.equal(path.dirname(resolved).toLowerCase(), fs.realpathSync(scratchRoot).toLowerCase());
  assert.ok(path.basename(resolved).startsWith("pg006-"));
  fs.rmSync(resolved, { recursive: true, force: true });
}
