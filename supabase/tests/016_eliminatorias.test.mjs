// PostgreSQL temporal exclusivo para la migración 016. No conecta a Supabase.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bin = 'C:/Program Files/PostgreSQL/18/bin';
const scratch = fs.mkdtempSync(path.join(process.env.TEMP || root, 'spintrack-pg016-'));
const data = path.join(scratch, 'data');
const port = '55419';
const env = { ...process.env, PGHOST: '127.0.0.1', PGPORT: port, PGUSER: 'postgres', PGPASSWORD: '', PGDATABASE: 'liga_016_test', PGSSLMODE: 'disable' };
const run = (name, args, input = '') => spawnSync(path.join(bin, `${name}.exe`), args, { env, input, encoding: 'utf8', timeout: 30000, windowsHide: true, stdio: name === 'pg_ctl' ? 'ignore' : 'pipe', maxBuffer: 12 * 1024 * 1024 });
const sql = input => { const result = run('psql', ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', 'liga_016_test', '-v', 'ON_ERROR_STOP=1', '-Atq'], input); assert.equal(result.status, 0, result.stderr + result.stdout); return result.stdout.trim(); };
const runConcurrent = input => new Promise((resolve, reject) => {
  const child = spawn(path.join(bin, 'psql.exe'), ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', 'liga_016_test', '-v', 'ON_ERROR_STOP=1', '-Atq'], { env, windowsHide: true });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
  const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error(`psql concurrente excedió timeout: ${stderr}`)); }, 10000);
  child.on('error', reject); child.on('close', status => { clearTimeout(timer); resolve({ status, stdout: stdout.trim(), stderr }); }); child.stdin.end(input);
});
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/016_eliminatorias.sql'), 'utf8');
let started = false;
try {
  assert.match(migration, /confirmar_llave_eliminatoria_016/);
  assert.match(migration, /clasificaciones_fuente/);
  assert.match(migration, /p_reglas_confirmadas/);
  assert.doesNotMatch(migration, /```|\\`/);
  assert.equal(run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--locale=C']).status, 0);
  const pgStart = run('pg_ctl', ['-D', data, '-l', path.join(scratch, 'server.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  assert.equal(pgStart.status, 0, pgStart.stderr + pgStart.stdout); started = true;
  assert.equal(run('psql', ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], 'create role authenticated; create role anon; create role service_role; create database liga_016_test;').status, 0);
  sql(`create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
    create table public.perfiles(id uuid primary key);
    create table public.competencias(id bigint primary key);
    create table public.jugadores(id bigint primary key, nombre_completo text not null);
    create table public.grupos_competencia(id bigint primary key, competencia_id bigint not null references public.competencias(id), numero integer, estado text);
    create table public.grupo_participantes(grupo_id bigint references public.grupos_competencia(id), jugador_id bigint references public.jugadores(id), primary key(grupo_id,jugador_id));
    create table public.partidos(id bigint primary key, grupo_id bigint references public.grupos_competencia(id));
    create table public.resultados_partidos(id bigint generated always as identity primary key, partido_id bigint references public.partidos(id), revision integer not null default 1);
    create function public.es_juez_general() returns boolean language sql stable as $$select auth.uid() is not null$$;
    create function public.es_administrador() returns boolean language sql stable as $$select false$$;
    create function public.consultar_clasificacion_grupo(p_id bigint) returns jsonb language sql stable security definer set search_path='' as $$
      select jsonb_build_object('grupo_id',p_id,'aprobable',true,'empate',false,'aprobacion',jsonb_build_object('vigente',true),
        'filas',jsonb_build_array(jsonb_build_object('jugador_id',p_id+100,'nombre_completo','Fixture '||p_id,'empate',false)),
        'snapshot',jsonb_build_object('grupo_id',p_id))$$;
    insert into public.perfiles values ('00000000-0000-0000-0000-000000000001');
    insert into public.competencias values (1);
    insert into public.jugadores values (101,'Fixture 1'),(102,'Fixture 2');
    insert into public.grupos_competencia values (1,1,1,'confirmado'),(2,1,2,'confirmado');
    insert into public.grupo_participantes values (1,101),(2,102);
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid(),public.es_juez_general(),public.es_administrador(),public.consultar_clasificacion_grupo(bigint) to authenticated;` + migration);
  const proposal = JSON.stringify({ posiciones: 2, clasificados: 2, pases_automaticos: 0, metodo_distribucion: 'determinista_por_grupo', clasificaciones: [{ grupo_id: 1, jugador_id: 101, snapshot: { grupo_id: 1 } }, { grupo_id: 2, jugador_id: 102, snapshot: { grupo_id: 2 } }], rondas: [{ posiciones: 2, nombre: 'Final', enfrentamientos: [{ numero: 1, tipo: 'encuentro', jugador_a_id: 101, jugador_b_id: 102, origen_a: { tipo: 'jugador', jugador_id: 101 }, origen_b: { tipo: 'jugador', jugador_id: 102 } }] }], decisiones: ['fixture'] });
  const buildProposal = (groupIds) => {
    const count = groupIds.length; let slots = 1; while (slots < count) slots *= 2; const bits = Math.log2(slots); const sources = Array(slots).fill(null);
    const reverse = value => { let result = 0; for (let bit = 0; bit < bits; bit++) result = (result << 1) | ((value >> bit) & 1); return result; };
    groupIds.forEach((groupId, index) => { sources[reverse(index)] = { tipo: 'jugador', jugador_id: groupId + 100 }; });
    const rounds = []; let current = sources; let round = 1;
    while (current.length > 1) { const matches = []; const next = []; for (let i = 0; i < current.length; i += 2) { const entries = [current[i], current[i + 1]].filter(Boolean); if (entries.length === 2) { const cruce = `R${round}-C${i / 2 + 1}`; matches.push({ numero: i / 2 + 1, tipo: 'encuentro', jugador_a_id: entries[0].tipo === 'jugador' ? entries[0].jugador_id : null, jugador_b_id: entries[1].tipo === 'jugador' ? entries[1].jugador_id : null, origen_a: entries[0], origen_b: entries[1] }); next.push({ tipo: 'ganador', cruce }); } else next.push(entries[0]); } rounds.push({ posiciones: current.length, nombre: `Ronda ${round}`, enfrentamientos: matches }); current = next; round += 1; }
    return { posiciones: slots, clasificados: count, pases_automaticos: slots - count, metodo_distribucion: 'determinista_por_grupo', clasificaciones: groupIds.map(grupo_id => ({ grupo_id, jugador_id: grupo_id + 100, snapshot: { grupo_id } })), rondas: rounds, decisiones: ['fixture temporal'] };
  };
  const judge = `set role authenticated; select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001"}',false);`;
  const last = value => value.split(/\r?\n/).at(-1);
  const decorated = JSON.parse(proposal);
  decorated.rondas[0].enfrentamientos[0].origen_a.extra = 'no debe persistir';
  decorated.rondas[0].enfrentamientos[0].origen_b.jugador = { id: 102, nombre: 'dato no autorizado' };
  decorated.rondas[0].enfrentamientos[0].campo_adicional = 'no debe persistir';
  decorated.clasificaciones[0].campo_adicional = 'no debe persistir';
  const decoratedJson = JSON.stringify(decorated);
  sql(judge + `set role postgres; insert into public.jugadores values (103,'Fixture 3'); insert into public.grupos_competencia values (3,1,3,'pendiente'); insert into public.grupo_participantes values (3,103); set role authenticated;`);
  const pending = run('psql', ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', 'liga_016_test', '-v', 'ON_ERROR_STOP=1', '-Atq'], judge + `select public.guardar_propuesta_eliminatoria_016(1,'${proposal.replaceAll("'", "''")}','Grupo pendiente');`);
  assert.notEqual(pending.status, 0);
  sql(`delete from public.grupo_participantes where grupo_id=3; delete from public.grupos_competencia where id=3; delete from public.jugadores where id=103;`);
  const llave = Number(last(sql(judge + `select public.guardar_propuesta_eliminatoria_016(1,'${decoratedJson.replaceAll("'", "''")}','Fixture v1');`)));
  assert.ok(llave > 0);
  assert.equal(last(sql(judge + `select estado from public.eliminatorias_llaves where id=${llave}`)), 'borrador');
  assert.equal(last(sql(judge + `select (propuesta::text like '%no debe persistir%')::text from public.eliminatorias_llaves where id=${llave}`)), 'false');
  assert.equal(last(sql(judge + `select (coalesce(string_agg(origen_a::text || origen_b::text, ''),'') like '%no debe persistir%')::text from public.eliminatorias_enfrentamientos where llave_id=${llave}`)), 'false');
  const second = Number(last(sql(judge + `select public.guardar_propuesta_eliminatoria_016(1,'${proposal.replaceAll("'", "''")}','Fixture v2');`)));
  assert.ok(second > llave);
  assert.equal(last(sql(judge + `select estado from public.eliminatorias_llaves where id=${llave}`)), 'reemplazada');
  assert.equal(last(sql(judge + `select count(*) from public.eliminatorias_historial where competencia_id=1`)), '3');
  const tampered = proposal.replace('\"jugador_b_id\":102', '\"jugador_b_id\":101');
  const rejected = run('psql', ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', 'liga_016_test', '-v', 'ON_ERROR_STOP=1', '-Atq'], judge + `select public.guardar_propuesta_eliminatoria_016(1,'${tampered.replaceAll("'", "''")}','Manipulada');`);
  assert.notEqual(rejected.status, 0);
  assert.equal(Number(last(sql(judge + `select public.confirmar_llave_eliminatoria_016(${second},'Confirmacion fixture',true,true,'Resolucion fixture');`))), second);
  assert.equal(last(sql(judge + `select estado from public.eliminatorias_llaves where id=${second}`)), 'confirmada');
  assert.equal(last(sql(judge + `select count(*) from public.eliminatorias_enfrentamientos where llave_id=${second}`)), '1');
  assert.equal(last(sql(judge + `select count(*) from public.eliminatorias_historial where competencia_id=1`)), '4');
  const denied = run('psql', ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', 'liga_016_test', '-v', 'ON_ERROR_STOP=1', '-Atq'], judge + `update public.eliminatorias_llaves set referencia_guardado='x' where id=${llave};`);
  assert.notEqual(denied.status, 0);
  for (const count of [3, 5, 6, 12]) {
    const cid = 100 + count; const firstGroup = cid * 100; const groups = Array.from({ length: count }, (_, index) => firstGroup + index + 1);
    sql(`insert into public.competencias values (${cid}); insert into public.jugadores select g+100, 'Fixture '||g from generate_series(${groups[0]},${groups.at(-1)}) g; insert into public.grupos_competencia select g,${cid},g-${firstGroup},'confirmado' from generate_series(${groups[0]},${groups.at(-1)}) g; insert into public.grupo_participantes select g,g+100 from generate_series(${groups[0]},${groups.at(-1)}) g;`);
    const generated = JSON.stringify(buildProposal(groups)); const generatedId = Number(last(sql(judge + `select public.guardar_propuesta_eliminatoria_016(${cid},'${generated.replaceAll("'", "''")}','Cuadro ${count}');`)));
    assert.ok(generatedId > 0); assert.equal(last(sql(judge + `select count(*) from public.eliminatorias_enfrentamientos where llave_id=${generatedId}`)), String(count - 1));
    assert.equal(Number(last(sql(judge + `select public.confirmar_llave_eliminatoria_016(${generatedId},'Confirmacion ${count}',true,true,'Resolucion fixture');`))), generatedId);
  }
  const staleCid = 999; const staleGroups = [99901, 99902];
  sql(`insert into public.competencias values (${staleCid}); insert into public.jugadores values (100001,'Fixture stale 1'),(100002,'Fixture stale 2'); insert into public.grupos_competencia values (99901,${staleCid},1,'confirmado'),(99902,${staleCid},2,'confirmado'); insert into public.grupo_participantes values (99901,100001),(99902,100002);`);
  const staleProposal = JSON.stringify(buildProposal(staleGroups));
  const staleId = Number(last(sql(judge + `select public.guardar_propuesta_eliminatoria_016(${staleCid},'${staleProposal.replaceAll("'", "''")}','Cuadro concurrente');`)));
  sql(`create or replace function public.consultar_clasificacion_grupo(p_id bigint) returns jsonb language sql stable security definer set search_path='' as $$
    select jsonb_build_object('grupo_id',p_id,'aprobable',true,'empate',false,'aprobacion',jsonb_build_object('vigente',true),
      'filas',jsonb_build_array(jsonb_build_object('jugador_id',p_id+100,'nombre_completo','Fixture '||p_id,'empate',false)),
      'snapshot',jsonb_build_object('grupo_id',p_id,'revision','concurrente'))$$;`);
  const staleConfirm = run('psql', ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', 'liga_016_test', '-v', 'ON_ERROR_STOP=1', '-Atq'], judge + `select public.confirmar_llave_eliminatoria_016(${staleId},'No debe confirmar',true,true,'Resolucion fixture');`);
  assert.notEqual(staleConfirm.status, 0);
  assert.equal(last(sql(judge + `select estado from public.eliminatorias_llaves where id=${staleId}`)), 'borrador');
  sql(`create or replace function public.consultar_clasificacion_grupo(p_id bigint) returns jsonb language sql stable security definer set search_path='' as $$
    select jsonb_build_object('grupo_id',p_id,'aprobable',true,'empate',false,'aprobacion',jsonb_build_object('vigente',true),
      'filas',jsonb_build_array(jsonb_build_object('jugador_id',p_id+100,'nombre_completo','Fixture '||p_id,'empate',false)),
      'snapshot',jsonb_build_object('grupo_id',p_id,'revision',coalesce((select max(r.revision) from public.resultados_partidos r join public.partidos p on p.id=r.partido_id where p.grupo_id=p_id),0)))$$;`);
  const raceCid = 1000; const raceGroups = [100001, 100002];
  sql(`insert into public.competencias values (${raceCid}); insert into public.jugadores values (100101,'Fixture race 1'),(100102,'Fixture race 2'); insert into public.grupos_competencia values (100001,${raceCid},1,'confirmado'),(100002,${raceCid},2,'confirmado'); insert into public.grupo_participantes values (100001,100101),(100002,100102); insert into public.partidos values (700001,100001);`);
  const raceProposal = JSON.stringify({ ...buildProposal(raceGroups), clasificaciones: raceGroups.map(grupo_id => ({ grupo_id, jugador_id: grupo_id + 100, snapshot: { grupo_id, revision: 0 } })) });
  const raceId = Number(last(sql(judge + `select public.guardar_propuesta_eliminatoria_016(${raceCid},'${raceProposal.replaceAll("'", "''")}','Cuadro carrera real');`)));
  const correctionSql = `set role postgres; begin; select id from public.partidos where id=700001 for update; select pg_sleep(2); insert into public.resultados_partidos(partido_id,revision) values (700001,1); commit;`;
  const confirmSql = judge + `select public.confirmar_llave_eliminatoria_016(${raceId},'Confirmacion concurrente',true,true,'Resolucion fixture');`;
  const correctionPromise = runConcurrent(correctionSql);
  await new Promise(resolve => setTimeout(resolve, 250));
  const confirmStarted = Date.now(); const concurrentConfirmPromise = runConcurrent(confirmSql);
  const [correctionResult, concurrentConfirm] = await Promise.all([correctionPromise, concurrentConfirmPromise]);
  assert.equal(correctionResult.status, 0, correctionResult.stderr);
  assert.notEqual(concurrentConfirm.status, 0);
  assert.ok(Date.now() - confirmStarted >= 1200, 'la confirmación no esperó el bloqueo del partido');
  assert.equal(last(sql(judge + `select estado from public.eliminatorias_llaves where id=${raceId}`)), 'borrador');
  console.log('016: persistencia canónica, pases, historial, confirmación atómica, RLS e invalidación por snapshot aprobados.');
} finally {
  if (started) assert.equal(run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']).status, 0);
  fs.rmSync(scratch, { recursive: true, force: true });
}
