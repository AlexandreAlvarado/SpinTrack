// PostgreSQL temporal exclusivo: aplica 016 sin cambios, luego 017. No conecta a Supabase.
import fs from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bin = 'C:/Program Files/PostgreSQL/18/bin';
const scratch = fs.mkdtempSync(path.join(process.env.TEMP || root, 'spintrack-pg017-'));
const data = path.join(scratch, 'data');
const port = '55420';
const env = { ...process.env, PGHOST: '127.0.0.1', PGPORT: port, PGUSER: 'postgres', PGPASSWORD: '', PGDATABASE: 'liga_017_test', PGSSLMODE: 'disable' };
const run = (name, args, input = '') => spawnSync(path.join(bin, `${name}.exe`), args, { env, input, encoding: 'utf8', timeout: 30000, windowsHide: true, stdio: name === 'pg_ctl' ? 'ignore' : 'pipe', maxBuffer: 12 * 1024 * 1024 });
const sql = input => { const result = run('psql', ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', 'liga_017_test', '-v', 'ON_ERROR_STOP=1', '-Atq'], input); assert.equal(result.status, 0, result.stderr + result.stdout); return result.stdout.trim(); };
const runConcurrent = input => new Promise((resolve, reject) => {
  const child = spawn(path.join(bin, 'psql.exe'), ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', 'liga_017_test', '-v', 'ON_ERROR_STOP=1', '-Atq'], { env, windowsHide: true });
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
  assert.equal(run('psql', ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], 'create role authenticated; create role anon; create role service_role; create database liga_017_test;').status, 0);
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
    create function public.es_juez_general() returns boolean language sql stable as $$select auth.uid()='00000000-0000-0000-0000-000000000001'::uuid$$;
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
  const judge = `set role authenticated; select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001"}',false);`;
  const legacy = { posiciones:2,clasificados:2,pases_automaticos:0,metodo_distribucion:'determinista_por_grupo',clasificaciones:[1,2].map(grupo_id=>({grupo_id,jugador_id:grupo_id+100,snapshot:{grupo_id}})),rondas:[{posiciones:2,enfrentamientos:[{numero:1,tipo:'encuentro',jugador_a_id:101,jugador_b_id:102,origen_a:{tipo:'jugador',jugador_id:101},origen_b:{tipo:'jugador',jugador_id:102}}]}] };
  const quote = value => "'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
  const last = value => value.split(/\r?\n/).at(-1);
  const oldId=Number(last(sql(judge+`select public.guardar_propuesta_eliminatoria_016(1,${quote(legacy)},'Histórico');`)));
  const historical=sql(`select row_to_json(k)::text from public.eliminatorias_llaves k where id=${oldId}`);
  sql(`insert into public.competencias values(2);
    insert into public.jugadores values(103,'Histórico'),(104,'Histórico');
    insert into public.grupos_competencia values(3,2,1,'confirmado'),(4,2,2,'confirmado');
    insert into public.grupo_participantes values(3,103),(4,104);`);
  const confirmedLegacy=structuredClone(legacy);
  confirmedLegacy.clasificaciones=[3,4].map(grupo_id=>({grupo_id,jugador_id:grupo_id+100,snapshot:{grupo_id}}));
  const match=confirmedLegacy.rondas[0].enfrentamientos[0];
  match.jugador_a_id=103;match.jugador_b_id=104;match.origen_a.jugador_id=103;match.origen_b.jugador_id=104;
  const confirmedId=Number(last(sql(judge+`select public.guardar_propuesta_eliminatoria_016(2,${quote(confirmedLegacy)},'Histórico confirmado');`)));
  sql(judge+`select public.confirmar_llave_eliminatoria_016(${confirmedId},'Fixture',true,true,'Fixture local');`);
  const confirmedBefore=sql(`select jsonb_build_array(
    (select to_jsonb(k) from public.eliminatorias_llaves k where id=${confirmedId}),
    (select jsonb_agg(to_jsonb(r)) from public.eliminatorias_rondas r where llave_id=${confirmedId}),
    (select jsonb_agg(to_jsonb(e)) from public.eliminatorias_enfrentamientos e where llave_id=${confirmedId}),
    (select jsonb_agg(to_jsonb(h) order by id) from public.eliminatorias_historial h where llave_id=${confirmedId}))::text`);
  sql(fs.readFileSync(path.join(root,'supabase/migrations/017_dos_clasificados_por_grupo.sql'),'utf8'));
  assert.equal(sql(`select row_to_json(k)::text from public.eliminatorias_llaves k where id=${oldId}`),historical);
  assert.equal(sql(`select jsonb_build_array(
    (select to_jsonb(k) from public.eliminatorias_llaves k where id=${confirmedId}),
    (select jsonb_agg(to_jsonb(r)) from public.eliminatorias_rondas r where llave_id=${confirmedId}),
    (select jsonb_agg(to_jsonb(e)) from public.eliminatorias_enfrentamientos e where llave_id=${confirmedId}),
    (select jsonb_agg(to_jsonb(h) order by id) from public.eliminatorias_historial h where llave_id=${confirmedId}))::text`),confirmedBefore);
  const reject = statement => {
    const result=run('psql',['-X','-h','127.0.0.1','-p',port,'-U','postgres','-d','liga_017_test','-v','ON_ERROR_STOP=1','-Atq'],statement);
    assert.notEqual(result.status,0,'Debió rechazar: '+statement.slice(0,120));
  };
  reject(judge+`select public.confirmar_llave_eliminatoria_016(${oldId},'No',true,true,'No');`);
  sql(`create table public.fixture_standings(id bigint primary key, value jsonb);
    create or replace function public.consultar_clasificacion_grupo(p_id bigint) returns jsonb language sql stable security definer set search_path='' as $$select value from public.fixture_standings where id=p_id$$;`);
  const mod=new Module(path.join(root,'src/lib/eliminatorias.ts'));
  mod._compile(ts.transpileModule(fs.readFileSync(path.join(root,'src/lib/eliminatorias.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,path.join(root,'src/lib/eliminatorias.ts'));
  const lib=mod.exports;
  const {standings}=await import('../../tests/fixtures/dos-clasificados.mjs');
  for(const count of [1,2,3,4,5,8,12,16,30,31,32,33,40,50,64,100]) {
    const cid=count+1000;
    const groups=standings(count,cid*1000);
    sql(`insert into public.competencias values(${cid});`+groups.map(g=>`
      insert into public.grupos_competencia values(${g.grupo_id},${cid},${g.numero},'confirmado');
      insert into public.jugadores values ${g.filas.map(r=>`(${r.jugador_id},'Local')`).join(',')};
      insert into public.grupo_participantes values ${g.filas.map(r=>`(${g.grupo_id},${r.jugador_id})`).join(',')};
      insert into public.fixture_standings values(${g.grupo_id},${quote(g)});`).join('\n'));
    const input=lib.competitionInput(String(cid),groups), preview=lib.proposeBracket(input), proposal=lib.persistableProposal(input,preview);
    const save=p=>judge+`select public.guardar_propuesta_eliminatoria_017(${cid},${quote(p)},'Local ${count}');`;
    if(count===1) {reject(save(proposal));continue;}
    const id=Number(last(sql(save(proposal))));
    assert.ok(id>0);
    assert.equal(last(sql(`select count(*) from public.eliminatorias_enfrentamientos where llave_id=${id}`)),String(count*2-1));
    assert.equal(last(sql(`select clasificados||','||posiciones||','||pases_automaticos from public.eliminatorias_llaves where id=${id}`)),`${count*2},${preview.posiciones},${preview.posiciones-count*2}`);
    assert.equal(last(sql(`select count(*) from public.eliminatorias_rondas where llave_id=${id}`)),String(Math.log2(preview.posiciones)));
    const saved=JSON.parse(last(sql(`select propuesta::text from public.eliminatorias_llaves where id=${id}`)));
    assert.equal(saved.version_regla,17); assert.ok(saved.clasificaciones.every(e=>[1,2].includes(e.posicion)));
    for(const mutate of [
      p=>p.clasificaciones[0].jugador_id=p.clasificaciones[1].jugador_id,
      p=>p.clasificaciones[0].posicion=2,
      p=>p.clasificaciones[0].snapshot={viejo:true},
      p=>p.clasificaciones[0].grupo_id=999999999,
      p=>p.clasificaciones[0].jugador_id=groups[0].filas[2].jugador_id,
      p=>p.pases_automaticos++,
      p=>p.rondas[0].enfrentamientos.push({numero:999,tipo:'pase'}),
      p=>p.rondas.at(-1).enfrentamientos[0].origen_a={tipo:'ganador',cruce:'R999-C1'},
      p=>delete p.rondas,
      p=>p.clasificaciones.pop(),
    ]) {const tampered=structuredClone(proposal);mutate(tampered);reject(save(tampered));}
    const g=groups[0];
    for(const patch of [{aprobable:false,pendientes:1},{empate:true,aprobable:false},{aprobacion:{vigente:false}},{snapshot:{version:'nueva'}}]) {
      sql(`update public.fixture_standings set value=${quote({...g,...patch})} where id=${g.grupo_id}`);reject(save(proposal));
    }
    sql(`update public.fixture_standings set value=${quote(g)} where id=${g.grupo_id}`);
    const second=Number(last(sql(save(proposal))));
    assert.equal(last(sql(`select estado from public.eliminatorias_llaves where id=${id}`)),'reemplazada');
    assert.equal(last(sql(`select count(*) from public.eliminatorias_historial where llave_id=${id}`)),'2');
    reject(judge+`update public.eliminatorias_llaves set clasificados=1 where id=${second};`);
    reject(`set role service_role; select public.guardar_propuesta_eliminatoria_017(${cid},${quote(proposal)},'No');`);
    if(count===3) {
      sql(`insert into public.partidos values(${cid},${g.grupo_id});`);
      const correction=runConcurrent(`begin;select 1 from public.partidos where id=${cid} for update;
        select pg_sleep(2);update public.fixture_standings set value=jsonb_set(value,'{snapshot}','{"revision":2}') where id=${g.grupo_id};commit;`);
      await new Promise(resolve=>setTimeout(resolve,300));
      const confirmation=runConcurrent(judge+`select public.confirmar_llave_eliminatoria_016(${second},'Carrera',true,true,'Fixture');`);
      assert.equal((await correction).status,0);
      const result=await confirmation;assert.notEqual(result.status,0);assert.match(result.stderr,/snapshot desactualizado/);
      assert.equal(last(sql(`select estado from public.eliminatorias_llaves where id=${second}`)),'borrador');
      sql(`update public.fixture_standings set value=${quote(g)} where id=${g.grupo_id}`);
    }
    sql(judge+`select public.confirmar_llave_eliminatoria_016(${second},'Fixture aislado',true,true,'Reglas fixture local');`);
    for(const statement of [
      `update public.eliminatorias_llaves set referencia_guardado='No' where id=${second}`,
      `delete from public.eliminatorias_enfrentamientos where llave_id=${second}`,
      `update public.eliminatorias_rondas set nombre='No' where llave_id=${second}`,
      `delete from public.eliminatorias_historial where llave_id=${second}`,
    ]) reject(statement);
    reject(save(proposal));
    console.log(`${count} grupos: ${count*2} clasificados, ${preview.posiciones} posiciones, integridad y seguridad OK`);
  }
  // Regeneración explícita del borrador histórico, conservando el historial original.
  const groups=standings(2);sql(groups.map(g=>`
    insert into public.jugadores values ${g.filas.map(r=>`(${r.jugador_id},'Local')`).join(',')};
    insert into public.grupo_participantes values ${g.filas.map(r=>`(${g.grupo_id},${r.jugador_id})`).join(',')};
    insert into public.fixture_standings values(${g.grupo_id},${quote(g)});`).join('\n'));
  const input=lib.competitionInput('1',groups);
  sql(judge+`select public.guardar_propuesta_eliminatoria_017(1,${quote(lib.persistableProposal(input,lib.proposeBracket(input)))},'Regeneración explícita');`);
  assert.equal(last(sql(`select estado from public.eliminatorias_llaves where id=${oldId}`)),'reemplazada');
  assert.equal(last(sql(`select count(*) from public.eliminatorias_historial where llave_id=${oldId}`)),'2');
  console.log('017 PostgreSQL temporal: aprobado; sin conexiones remotas.');
} finally {
  if(started) run('pg_ctl',['-D',data,'-m','immediate','-w','stop']);
  // Directorio único creado por este runner dentro de TEMP.
  fs.rmSync(scratch,{recursive:true,force:true});
}
