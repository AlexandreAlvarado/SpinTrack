// Runner PostgreSQL temporal para 021 + 022. Nunca conecta a Supabase remoto.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bin = 'C:/Program Files/PostgreSQL/18/bin';
const scratch = fs.mkdtempSync(path.join(process.env.TEMP || root, 'spintrack-pg022-'));
const data = path.join(scratch, 'data');
const port = await new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(String(p))); }); });
const env = { ...process.env, PGHOST: '127.0.0.1', PGPORT: port, PGUSER: 'postgres', PGPASSWORD: '', PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '5', PGOPTIONS: '-c statement_timeout=10000 -c lock_timeout=5000' };
const run = (name, args, input = '') => spawnSync(path.join(bin, `${name}.exe`), args, { env, input, encoding: 'utf8', timeout: 30000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
const psql = (db, input, ok = true) => { const r = run('psql', ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-Atq'], input); if (ok) assert.equal(r.status, 0, `${r.stderr}\n${r.stdout}`); return r; };
const migration = n => fs.readFileSync(path.join(root, 'supabase/migrations', n), 'utf8');
let started = false;
try {
  assert.equal(run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--locale=C']).status, 0);
  assert.equal(run('pg_ctl', ['-D', data, '-l', path.join(scratch, 'server.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']).status, 0);
  started = true;
  psql('postgres', 'create role authenticated; create role anon; create role service_role; create database liga_022_test; create database liga_022_dependency_test;');

  const base = `
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
    create type public.rol_usuario as enum ('administrador','juez_general','arbitro','jugador');
    create table public.perfiles(id uuid primary key, rol public.rol_usuario not null);
    create table public.competencias(id bigint primary key);
    create table public.competencia_control_deportivo(
      competencia_id bigint primary key references public.competencias(id), inicio_programado timestamptz,
      estado_deportivo text not null default 'pendiente', minimo_participantes integer, grupo_minimo integer,
      grupo_maximo integer, formato_competencia text, reglamento_id bigint, temporada_id bigint default 1,
      configuracion_aprobada boolean not null default false, motivo_resolucion text, referencia_resolucion text,
      actualizado_por uuid not null, actualizado_en timestamptz not null default now(), aprobado_por uuid, aprobado_en timestamptz);
    create table public.competencia_formatos_sets(
      competencia_id bigint not null references public.competencia_control_deportivo(competencia_id) on delete restrict,
      etapa text not null, mejor_de integer not null check(mejor_de in (3,5)), referencia_resolucion text,
      actualizado_por uuid not null, actualizado_en timestamptz not null default now(), primary key(competencia_id,etapa));
    create table public.lotes_partidos_grupos(id bigint primary key, competencia_id bigint not null, estado text not null);
    create function public.es_administrador() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.perfiles where id=auth.uid() and rol='administrador'::public.rol_usuario)$$;
    create function public.es_juez_general() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.perfiles where id=auth.uid() and rol='juez_general'::public.rol_usuario)$$;
    insert into public.perfiles values ('00000000-0000-0000-0000-000000000001','administrador'),('00000000-0000-0000-0000-000000000002','juez_general'),('00000000-0000-0000-0000-000000000003','arbitro');
    insert into public.competencias values (1),(2);
    insert into public.competencia_control_deportivo(competencia_id,actualizado_por) values (1,'00000000-0000-0000-0000-000000000001'),(2,'00000000-0000-0000-0000-000000000001');
    alter table public.competencia_control_deportivo enable row level security;
    alter table public.competencia_formatos_sets enable row level security;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid(),public.es_administrador(),public.es_juez_general() to authenticated;
    grant select on public.competencia_control_deportivo,public.competencia_formatos_sets to authenticated;
    grant insert,update,delete on public.competencia_control_deportivo,public.competencia_formatos_sets to authenticated;
    create policy control_lectura on public.competencia_control_deportivo for select to authenticated using (true);
    create policy formatos_lectura on public.competencia_formatos_sets for select to authenticated using (true);
  `;
  psql('liga_022_test', base);
  const dependency = psql('liga_022_dependency_test', migration('022_separar_preparacion_administrador.sql'), false);
  assert.notEqual(dependency.status, 0);
  assert.match(`${dependency.stderr}${dependency.stdout}`, /021 requiere|migraci.n 021/i);
  // El contrato de 021 se instala completo en producción; aquí aislamos su
  // tabla, política y firma para que el runner de seguridad no dependa de
  // las tablas de eliminatorias del runner 018.
  const m021 = migration('021_formato_final_mejor_de_5.sql');
  const m021Contract = m021.slice(0, m021.indexOf('create or replace function public.configurar_formato_final_021'))
    + `create function public.configurar_formato_final_021(bigint,text) returns boolean language sql as $$select true$$; commit;`;
  psql('liga_022_test', m021Contract);
  psql('liga_022_test', migration('022_separar_preparacion_administrador.sql'));
  const admin = `set role authenticated; select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001"}',false);`;
  const judge = admin.replaceAll('000000000001', '000000000002');
  const referee = admin.replaceAll('000000000001', '000000000003');
  psql('liga_022_test', admin + `select public.configurar_formato_final_021(1,'Referencia autentica final al mejor de 5');`);
  assert.equal(psql('liga_022_test', `select mejor_de||':'||referencia_resolucion from public.competencia_formato_final_021 where competencia_id=1;`).stdout.trim(), '5:Referencia autentica final al mejor de 5');
  assert.equal(psql('liga_022_test', judge + `select count(*) from public.competencia_formatos_sets where competencia_id=1;`).stdout.trim().split(/\r?\n/).at(-1), '1');
  let denied = psql('liga_022_test', judge + `update public.competencia_formatos_sets set mejor_de=3 where competencia_id=1 and etapa='final';`, false);
  assert.equal(psql('liga_022_test', `select mejor_de from public.competencia_formatos_sets where competencia_id=1 and etapa='final';`).stdout.trim(), '5', `${denied.stderr}${denied.stdout}`);
  denied = psql('liga_022_test', judge + `select public.configurar_formato_final_021(1,'Intento juez');`, false);
  assert.notEqual(denied.status, 0);
  psql('liga_022_test', admin + `update public.competencia_control_deportivo set configuracion_aprobada=true, estado_deportivo='preparada' where competencia_id=1;`);
  denied = psql('liga_022_test', admin + `select public.configurar_formato_final_021(1,'Cambio posterior');`, false);
  assert.notEqual(denied.status, 0);
  denied = psql('liga_022_test', admin + `delete from public.competencia_formatos_sets where competencia_id=1;`, false);
  assert.notEqual(denied.status, 0);
  denied = psql('liga_022_test', admin + `delete from public.competencia_control_deportivo where competencia_id=1;`, false);
  assert.notEqual(denied.status, 0);
  psql('liga_022_test', admin + `update public.competencia_control_deportivo set configuracion_aprobada=false, estado_deportivo='pendiente' where competencia_id=2;`);
  psql('liga_022_test', admin + `select public.configurar_formato_final_021(2,'Referencia final competencia 2');`);
  psql('liga_022_test', admin + `update public.competencia_control_deportivo set estado_deportivo='en_curso' where competencia_id=2;`);
  denied = psql('liga_022_test', admin + `update public.competencia_formatos_sets set referencia_resolucion='Cambio con estado desactualizado' where competencia_id=2 and etapa='final';`, false);
  assert.equal(psql('liga_022_test', `select referencia_resolucion from public.competencia_formatos_sets where competencia_id=2 and etapa='final';`).stdout.trim(), 'Referencia final competencia 2', `${denied.stderr}${denied.stdout}`);
  psql('liga_022_test', referee + `select count(*) from public.competencia_formatos_sets where competencia_id=2;`);
  console.log('022 PostgreSQL temporal: dependencia 021, bloqueo de preparación, RLS, DELETE e inmutabilidad aprobada.');
} finally {
  if (started) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
  fs.rmSync(scratch, { recursive: true, force: true });
}
