// PostgreSQL temporal exclusivo: aplica 016, 017 y 018 sin tocar archivos previos. No conecta a Supabase.
import fs from 'node:fs';
import net from 'node:net';
import Module from 'node:module';
import ts from 'typescript';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bin = 'C:/Program Files/PostgreSQL/18/bin';
const scratchRoot = path.resolve(process.env.TEMP || root);
const scratch = fs.mkdtempSync(path.join(scratchRoot, 'spintrack-pg018-'));
const data = path.join(scratch, 'data');
const port = await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();server.close(()=>resolve(String(address.port)));});});
const env = { ...process.env, PGHOST: '127.0.0.1', PGPORT: port, PGUSER: 'postgres', PGPASSWORD: '', PGDATABASE: 'liga_018_test', PGSSLMODE: 'disable' };
const run = (name, args, input = '') => spawnSync(path.join(bin, `${name}.exe`), args, { env, input, encoding: 'utf8', timeout: 30000, windowsHide: true, stdio: name === 'pg_ctl' ? 'ignore' : 'pipe', maxBuffer: 12 * 1024 * 1024 });
const sql = input => { const result = run('psql', ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', 'liga_018_test', '-v', 'ON_ERROR_STOP=1', '-Atq'], input); if (result.error) throw result.error; if (result.status === null) throw new Error(`psql temporal agotó el tiempo: ${result.signal ?? 'sin señal'}\n${result.stderr ?? ''}`); assert.equal(result.status, 0, result.stderr + result.stdout); return result.stdout.trim(); };
const runConcurrent = input => new Promise((resolve, reject) => {
  const child = spawn(path.join(bin, 'psql.exe'), ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', 'liga_018_test', '-v', 'ON_ERROR_STOP=1', '-Atq'], { env, windowsHide: true });
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
  const init=run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--locale=C']); assert.equal(init.status, 0, init.stderr+init.stdout);
  const pgStart = run('pg_ctl', ['-D', data, '-l', path.join(scratch, 'server.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  assert.equal(pgStart.status, 0, fs.readFileSync(path.join(scratch,'server.log'),'utf8')); started = true;
  assert.equal(run('psql', ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], 'create role authenticated; create role anon; create role service_role; create database liga_018_test;').status, 0);
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
  const oldId=Number(last(sql(judge+`select public.guardar_propuesta_eliminatoria_016(1,${quote(legacy)},'HistÃ³rico');`)));
  const historical=sql(`select row_to_json(k)::text from public.eliminatorias_llaves k where id=${oldId}`);
  sql(`insert into public.competencias values(2);
    insert into public.jugadores values(103,'HistÃ³rico'),(104,'HistÃ³rico');
    insert into public.grupos_competencia values(3,2,1,'confirmado'),(4,2,2,'confirmado');
    insert into public.grupo_participantes values(3,103),(4,104);`);
  const confirmedLegacy=structuredClone(legacy);
  confirmedLegacy.clasificaciones=[3,4].map(grupo_id=>({grupo_id,jugador_id:grupo_id+100,snapshot:{grupo_id}}));
  const match=confirmedLegacy.rondas[0].enfrentamientos[0];
  match.jugador_a_id=103;match.jugador_b_id=104;match.origen_a.jugador_id=103;match.origen_b.jugador_id=104;
  const confirmedId=Number(last(sql(judge+`select public.guardar_propuesta_eliminatoria_016(2,${quote(confirmedLegacy)},'HistÃ³rico confirmado');`)));
  sql(judge+`select public.confirmar_llave_eliminatoria_016(${confirmedId},'Fixture',true,true,'Fixture local');`);
  const confirmedBefore=sql(`select jsonb_build_array(
    (select to_jsonb(k) from public.eliminatorias_llaves k where id=${confirmedId}),
    (select jsonb_agg(to_jsonb(r)) from public.eliminatorias_rondas r where llave_id=${confirmedId}),
    (select jsonb_agg(to_jsonb(e)) from public.eliminatorias_enfrentamientos e where llave_id=${confirmedId}),
    (select jsonb_agg(to_jsonb(h) order by id) from public.eliminatorias_historial h where llave_id=${confirmedId}))::text`);
  // Borrador histórico de 016 para una competencia de un solo grupo y cuatro participantes.
  sql(`insert into public.competencias values(9100);
    insert into public.grupos_competencia values(9100,9100,1,'confirmado');
    insert into public.jugadores values (9200,'Histórico primero'),(9201,'Histórico segundo'),(9202,'Histórico tercero'),(9203,'Histórico cuarto');
    insert into public.grupo_participantes values (9100,9200),(9100,9201),(9100,9202),(9100,9203);`);
  const legacySingle={posiciones:1,clasificados:1,pases_automaticos:0,metodo_distribucion:'determinista_por_grupo',clasificaciones:[{grupo_id:9100,jugador_id:9200,snapshot:{grupo_id:9100}}],rondas:[]};
  const legacySingleId=Number(last(sql(judge+`select public.guardar_propuesta_eliminatoria_016(9100,${quote(legacySingle)},'Borrador histórico 016');`)));  sql(fs.readFileSync(path.join(root,'supabase/migrations/017_dos_clasificados_por_grupo.sql'),'utf8'));
  assert.equal(sql(`select row_to_json(k)::text from public.eliminatorias_llaves k where id=${oldId}`),historical);
  assert.equal(sql(`select jsonb_build_array(
    (select to_jsonb(k) from public.eliminatorias_llaves k where id=${confirmedId}),
    (select jsonb_agg(to_jsonb(r)) from public.eliminatorias_rondas r where llave_id=${confirmedId}),
    (select jsonb_agg(to_jsonb(e)) from public.eliminatorias_enfrentamientos e where llave_id=${confirmedId}),
    (select jsonb_agg(to_jsonb(h) order by id) from public.eliminatorias_historial h where llave_id=${confirmedId}))::text`),confirmedBefore);
  sql(`create type public.rol_usuario as enum ('juez_general','arbitro','jugador');
    alter table public.perfiles add column rol public.rol_usuario default 'juez_general';
    alter table public.jugadores add column perfil_id uuid;
    create function public.es_arbitro_013() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.perfiles where id=auth.uid() and rol='arbitro'::public.rol_usuario)$$;
    create table public.competencia_control_deportivo(competencia_id bigint primary key references public.competencias(id), configuracion_aprobada boolean not null default true);
    create table public.competencia_formatos_sets(
      competencia_id bigint not null references public.competencia_control_deportivo(competencia_id) on delete restrict,
      etapa text not null check(etapa in ('grupos','previa_cuartos','cuartos','semifinal','final')),
      mejor_de integer not null check(mejor_de in (3,5)),
      referencia_resolucion text check(char_length(btrim(referencia_resolucion)) between 1 and 1000),
      actualizado_por uuid not null, actualizado_en timestamptz not null default now(),
      primary key(competencia_id,etapa));
    alter table public.competencia_formatos_sets enable row level security;
    revoke all on public.competencia_formatos_sets from public,anon,authenticated,service_role;
    grant select on public.competencia_formatos_sets to authenticated;
    insert into public.perfiles values ('00000000-0000-0000-0000-000000000002','arbitro'),('00000000-0000-0000-0000-000000000003','jugador'),('00000000-0000-0000-0000-000000000004','arbitro');
    alter table public.jugadores enable row level security;
    grant select on public.jugadores to authenticated;
    create policy local_judge on public.jugadores for select to authenticated using(public.es_juez_general());`);
  const calculator=fs.readFileSync(path.join(root,'supabase/migrations/012_resultados_sets.sql'),'utf8');
  sql(calculator.slice(calculator.indexOf('create function public.calcular_resultado_sets_012'),calculator.indexOf('create table public.resultados_partidos')));
  assert.equal(last(sql(`select to_regprocedure('public.bloquear_fuente_eliminatoria_016(bigint)') is not null`)),'t');
  sql(fs.readFileSync(path.join(root,'supabase/migrations/018_resultados_eliminatorias.sql'),'utf8'));
  assert.equal(last(sql(`select count(*) from information_schema.columns where table_schema='public' and table_name='competencia_formatos_sets' and column_name in ('competencia_id','etapa','mejor_de','referencia_resolucion','actualizado_por','actualizado_en')`)),'6');
  assert.equal(last(sql(`select count(*) >= 5 from pg_constraint c join pg_class t on t.oid=c.conrelid where t.relname='competencia_formatos_sets' and c.contype in ('p','f','c')`)),'t');
  const referee=judge.replaceAll('000000000001','000000000002');
  const outsider=judge.replaceAll('000000000001','000000000003');
  const refereeId='00000000-0000-0000-0000-000000000002';
  const call=(id,op,rev=0,sets=null)=>`select public.operar_eliminatoria_018(${id},'${op}',${rev},'Fixture local','${refereeId}',${sets?quote(sets):'null'});`;
  const score=[{a:11,b:4},{a:12,b:10}];
  const reject = statement => {
    const result=run('psql',['-X','-h','127.0.0.1','-p',port,'-U','postgres','-d','liga_018_test','-v','ON_ERROR_STOP=1','-Atq'],statement);
    assert.notEqual(result.status,0,'DebiÃ³ rechazar: '+statement.slice(0,120));
  };
  reject(judge+`select public.confirmar_llave_eliminatoria_016(${oldId},'No',true,true,'No');`);
  sql(`create table public.fixture_standings(id bigint primary key, value jsonb);
    create or replace function public.consultar_clasificacion_grupo(p_id bigint) returns jsonb language sql stable security definer set search_path='' as $$select value from public.fixture_standings where id=p_id$$;`);
  const mod=new Module(path.join(root,'src/lib/eliminatorias.ts'));
  mod._compile(ts.transpileModule(fs.readFileSync(path.join(root,'src/lib/eliminatorias.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,path.join(root,'src/lib/eliminatorias.ts'));
  const lib=mod.exports;
  const {standings}=await import('../../tests/fixtures/dos-clasificados.mjs');
  const counts = (process.env.SPINTRACK_PG018_COUNTS ?? '1,2,3,4,8,16,32,64').split(',').map(Number).filter(Number.isInteger);
  for(const count of counts) {
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
    // La aplicaci?n de 018 no activa nada por s? sola; el respaldo se carga SOLO aqu?, en fixtures locales.
    reject(judge+`select public.iniciar_eliminatoria_018(${second},'Sin respaldo');`);
    sql(`insert into public.eliminatorias_respaldos(llave_id,referencia_distribucion,referencia_pases_reencuentros,registrado_por) values(${second},'Fixture local','Fixture local','00000000-0000-0000-0000-000000000001');
      insert into public.competencia_control_deportivo(competencia_id) values(${cid});
      insert into public.competencia_formatos_sets(competencia_id,etapa,mejor_de,referencia_resolucion,actualizado_por)
        select ${cid},e,3,'Formato local','00000000-0000-0000-0000-000000000001' from unnest(array['grupos','previa_cuartos','cuartos','semifinal','final'])e;`);
    reject(referee+`select public.iniciar_eliminatoria_018(${second},'No');`);
    const starts=await Promise.all([
      runConcurrent(judge+`select public.iniciar_eliminatoria_018(${second},'Fixture concurrente A');`),
      runConcurrent(judge+`select public.iniciar_eliminatoria_018(${second},'Fixture concurrente B');`),
    ]);
    starts.forEach(result=>assert.equal(result.status,0,result.stderr));
    sql(judge+`select public.iniciar_eliminatoria_018(${second},'Reintento idempotente');`);
    const immutableBefore=sql(`select jsonb_build_array((select to_jsonb(k) from public.eliminatorias_llaves k where id=${second}),(select jsonb_agg(to_jsonb(e) order by id) from public.eliminatorias_enfrentamientos e where llave_id=${second}))::text`);
    assert.equal(sql(`select count(*) from public.eliminatorias_partidos where llave_id=${second}`),String(count*2-1));
    const rows=JSON.parse(sql(`select jsonb_agg(to_jsonb(p) order by ronda_numero,numero) from public.eliminatorias_partidos p where llave_id=${second}`));
    const pending=rows.find(p=>!p.jugador_a_id||!p.jugador_b_id);
    assert.ok(pending);reject(judge+call(pending.id,'asignar'));reject(referee+call(pending.id,'enviar',0,score));
    const first=rows[0];
    reject(referee+call(first.id,'enviar',0,score));
    reject(outsider+call(first.id,'asignar'));
    sql(`update public.jugadores set perfil_id='${refereeId}' where id=${first.jugador_a_id}`);
    reject(judge+call(first.id,'asignar'));
    sql(`update public.jugadores set perfil_id=null where id=${first.jugador_a_id}`);
    sql(judge+call(first.id,'asignar'));
    reject(judge+call(first.id,'enviar',0,score));
    reject(referee+call(first.id,'enviar',0,[{a:11,b:10},{a:11,b:2}]));
    sql(referee+call(first.id,'comenzar')+call(first.id,'enviar',0,score));
    assert.equal(sql(`select count(*) from public.eliminatorias_partidos where llave_id=${second} and ganador_id is not null`),'0');
    reject(referee+call(first.id,'confirmar',1));
    sql(judge+call(first.id,'observar',1));
    reject(judge+call(first.id,'confirmar',1));
    assert.equal(sql(`select count(*) from public.eliminatorias_partidos where llave_id=${second} and perdedor_id is not null`),'0');
    sql(referee+call(first.id,'enviar',1,score));
    // Dos conexiones reales confirman la misma revisi?n; el segundo reintento es idempotente.
    const results=await Promise.all([runConcurrent(judge+call(first.id,'confirmar',2)),runConcurrent(judge+call(first.id,'confirmar',2))]);
    results.forEach(r=>assert.equal(r.status,0,r.stderr));
    assert.equal(sql(`select count(*) from public.eliminatorias_eventos where partido_id=${first.id} and evento='confirmado'`),'1');
    if(count===2) assert.equal(sql(`select count(*) from public.eliminatorias_partidos where llave_id=${second} and ronda_numero=2 and jugador_a_id is not null and jugador_b_id is null`),'1');
    reject(referee+call(first.id,'enviar',2,score));
    reject(`update public.eliminatorias_partidos set ganador_id=jugador_b_id where id=${first.id}`);
    reject(`update public.eliminatorias_actas set sets='[]' where partido_id=${first.id}`);
    reject(referee+`insert into public.eliminatorias_actas(partido_id,revision,sets,sets_a,sets_b,ganador_id,autor_id,referencia) values(${first.id},3,'[]',2,0,${first.jugador_b_id},'${refereeId}','Falso')`);
    reject(referee+`insert into public.eliminatorias_respaldos values(${second},'Falso','Falso','${refereeId}',now())`);
    // RLS no expone encuentros ajenos ni jugadores de encuentros no asignados.
    assert.equal(last(sql(outsider+`select count(*) from public.eliminatorias_partidos`)),'0');
    assert.equal(last(sql(referee+`select count(*) from public.eliminatorias_partidos where llave_id=${second}`)),'1');
    const startedAt=Date.now();
    const paginated=[];
    for(let offset=0;;offset+=16) {
      const slice=JSON.parse(last(sql(judge+`select coalesce(jsonb_agg(id order by id),'[]') from (select id from public.eliminatorias_partidos where llave_id=${second} and ronda_numero=1 order by id offset ${offset} limit 16)x`)));
      paginated.push(...slice);if(slice.length<16)break;
    }
    assert.deepEqual(paginated,rows.filter(p=>p.ronda_numero===1).map(p=>p.id).sort((a,b)=>a-b));
    for(let rn=1;rn<=Math.log2(preview.posiciones);rn++) {
      const available=JSON.parse(sql(`select coalesce(jsonb_agg(id order by numero),'[]') from public.eliminatorias_partidos where llave_id=${second} and ronda_numero=${rn} and estado<>'confirmado'`));
      if(!available.length)continue;
      assert.equal(sql(`select count(*) from public.eliminatorias_partidos where llave_id=${second} and ronda_numero=${rn} and (jugador_a_id is null or jugador_b_id is null)`),'0');
      sql(judge+available.map(id=>call(id,'asignar')).join(''));
      sql(referee+available.map(id=>call(id,'enviar',0,score)).join(''));
      if(rn===Math.log2(preview.posiciones)-1 && available.length===2) {
        const both=await Promise.all(available.map(id=>runConcurrent(judge+call(id,'confirmar',1))));both.forEach(r=>assert.equal(r.status,0,r.stderr));
      } else sql(judge+available.map(id=>call(id,'confirmar',1)).join(''));
    }
    const board=JSON.parse(sql(`select to_jsonb(c) from public.eliminatorias_cuadros c where llave_id=${second}`));
    assert.equal(sql(`select count(*) from public.eliminatorias_partidos p join public.eliminatorias_partidos parent on parent.id=p.fuente_a_id where p.llave_id=${second} and p.jugador_a_id is distinct from parent.ganador_id`),'0');
    assert.equal(sql(`select count(*) from public.eliminatorias_partidos p join public.eliminatorias_partidos parent on parent.id=p.fuente_b_id where p.llave_id=${second} and p.jugador_b_id is distinct from parent.ganador_id`),'0');
    assert.equal(board.estado,'finalizado');assert.ok(board.campeon_id);assert.ok(board.finalista_id);assert.notEqual(board.campeon_id,board.finalista_id);
    assert.equal(sql(`select count(distinct perdedor_id) from public.eliminatorias_partidos where llave_id=${second}`),String(count*2-1));
    assert.equal(sql(`select count(*) from public.eliminatorias_actas a join public.eliminatorias_partidos p on p.id=a.partido_id where p.llave_id=${second}`),String(count*2));
    assert.equal(sql(`select count(*) from public.eliminatorias_eventos where llave_id=${second} and evento='campeon'`),'1');
    const final=rows.at(-1);sql(judge+call(final.id,'confirmar',1));
    reject(`update public.eliminatorias_cuadros set campeon_id=finalista_id,finalista_id=campeon_id where llave_id=${second}`);
    const immutableAfter=sql(`select jsonb_build_array((select to_jsonb(k) from public.eliminatorias_llaves k where id=${second}),(select jsonb_agg(to_jsonb(e) order by id) from public.eliminatorias_enfrentamientos e where llave_id=${second}))::text`);
    assert.equal(immutableAfter,immutableBefore);
    console.log(`018: ${count*2} clasificados, ${preview.posiciones-count*2} pases, campeon y ${count*2-1} eliminados; ${Date.now()-startedAt} ms`);
  }
  // Regresión posterior a 019: las llaves de varias grupos siguen usando 017/018.
  const regression = async (groupCount, competitionId) => {
    const groupsRegression=standings(groupCount,competitionId*1000);
    sql(`insert into public.competencias values(${competitionId});`+groupsRegression.map(g=>`
      insert into public.grupos_competencia values(${g.grupo_id},${competitionId},${g.numero},'confirmado');
      insert into public.jugadores values ${g.filas.map(r=>`(${r.jugador_id},'Regresión ${competitionId}')`).join(',')};
      insert into public.grupo_participantes values ${g.filas.map(r=>`(${g.grupo_id},${r.jugador_id})`).join(',')};
      insert into public.fixture_standings values(${g.grupo_id},${quote(g)});`).join('\n'));
    const inputRegression=lib.competitionInput(String(competitionId),groupsRegression), previewRegression=lib.proposeBracket(inputRegression), proposalRegression=lib.persistableProposal(inputRegression,previewRegression);
    const keyRegression=Number(last(sql(judge+`select public.guardar_propuesta_eliminatoria_017(${competitionId},${quote(proposalRegression)},'Regresión 019 versión 17');`)));
    assert.equal(last(sql(`select propuesta::jsonb->>'version_regla' from public.eliminatorias_llaves where id=${keyRegression}`)),'17');
    sql(judge+`select public.confirmar_llave_eliminatoria_016(${keyRegression},'Respaldo local 019',true,true,'Formato deportivo local 019');`);
    sql(`insert into public.eliminatorias_respaldos(llave_id,referencia_distribucion,referencia_pases_reencuentros,registrado_por) values(${keyRegression},'Distribución de prueba local','Pases de prueba local','00000000-0000-0000-0000-000000000001');
      insert into public.competencia_control_deportivo(competencia_id) values(${competitionId});
      insert into public.competencia_formatos_sets(competencia_id,etapa,mejor_de,referencia_resolucion,actualizado_por)
        select ${competitionId},e,3,'Formato de sets de regresión','00000000-0000-0000-0000-000000000001' from unnest(array['previa_cuartos','cuartos','semifinal','final'])e;`);
    sql(judge+`select public.iniciar_eliminatoria_018(${keyRegression},'Inicio regresión versión 17 después de 019');`);
    assert.equal(last(sql(`select count(*) from public.eliminatorias_partidos where llave_id=${keyRegression}`)),String(groupCount===2?3:5));
    if(groupCount===3) {
      assert.ok(Number(last(sql(`select count(*) from public.eliminatorias_partidos where llave_id=${keyRegression} and (jugador_a_id is null or jugador_b_id is null)`)))>=1);
      assert.equal(last(sql(`select count(*) from public.eliminatorias_enfrentamientos where llave_id=${keyRegression}`)),'5');
      return;
    }
    const scoreRegression=[{a:11,b:4},{a:12,b:10}];
    for(let round=1;round<=2;round++) {
      const ids=JSON.parse(last(sql(`select coalesce(jsonb_agg(id order by numero),'[]') from public.eliminatorias_partidos where llave_id=${keyRegression} and ronda_numero=${round} and estado<>'confirmado'`)));
      assert.ok(ids.length);
      for(const id of ids) {
        const op=(actor,action,revision=0,sets=null)=>`${actor}select public.operar_eliminatoria_018(${id},'${action}',${revision},'Regresión operación local','${refereeId}',${sets?quote(sets):'null'});`;
        sql(judge+`select public.operar_eliminatoria_018(${id},'asignar',0,'Regresión asignación local','${refereeId}',null);`);
        sql(referee+`select public.operar_eliminatoria_018(${id},'comenzar',0,'Regresión comienzo local','${refereeId}',null); select public.operar_eliminatoria_018(${id},'enviar',0,'Regresión sets local','${refereeId}',${quote(scoreRegression)});`);
        sql(judge+`select public.operar_eliminatoria_018(${id},'confirmar',1,'Regresión confirmación local','${refereeId}',null);`);
      }
    }
    assert.equal(last(sql(`select estado||','||campeon_id||','||finalista_id from public.eliminatorias_cuadros where llave_id=${keyRegression}`)).split(',')[0],'finalizado');
    assert.equal(last(sql(`select count(*) from public.eliminatorias_eventos where llave_id=${keyRegression} and evento='campeon'`)),'1');
  };
  await regression(2,9300);
  await regression(3,9301);
  console.log('019 regresión multigrupo: versiones 17/19 aceptadas, semifinal/final, pases y campeón aprobados.');  // 019: final independiente para un único grupo, sobre el esquema real de 016–018.
  sql(fs.readFileSync(path.join(root,'supabase/migrations/019_final_grupo_unico.sql'),'utf8'));
  sql(fs.readFileSync(path.join(root,'supabase/migrations/020_preparar_asignar_final.sql'),'utf8'));
  sql(fs.readFileSync(path.join(root,'supabase/migrations/021_formato_final_mejor_de_5.sql'),'utf8'));
  assert.equal(last(sql(`select to_regprocedure('public.configurar_formato_final_021(bigint,text)') is not null`)),'t');
  assert.equal(last(sql(`select to_regprocedure('public.preparar_asignar_final_eliminatoria_020(bigint,uuid,text)') is not null`)),'t');
  reject(judge+`select public.preparar_asignar_final_eliminatoria_020(${confirmedId},'${refereeId}','No aplica a versión 17');`);
  assert.equal(last(sql(`select to_regprocedure('public.confirmar_llave_eliminatoria_019(bigint,text,boolean,boolean,text,text)') is not null`)),'t');
  sql(`insert into public.competencias values(9001);
    insert into public.grupos_competencia values(9001,9001,1,'confirmado');
    insert into public.jugadores values(9101,'Primero 019'),(9102,'Segundo 019'),(9103,'Tercero 019'),(9104,'Cuarto 019');
    insert into public.grupo_participantes values(9001,9101),(9001,9102),(9001,9103),(9001,9104);
    insert into public.fixture_standings values(9001,${quote({grupo_id:9001,numero:1,total:4,confirmados:4,pendientes:0,empate:false,aprobable:true,aprobacion:{vigente:true,referencia:'Acta real 019'},snapshot:{revision:1},filas:[{jugador_id:9101,nombre_completo:'Primero 019',empate:false},{jugador_id:9102,nombre_completo:'Segundo 019',empate:false},{jugador_id:9103,nombre_completo:'Tercero 019',empate:false},{jugador_id:9104,nombre_completo:'Cuarto 019',empate:false}]})});
    insert into public.competencia_control_deportivo(competencia_id) values(9001);
    insert into public.competencia_formatos_sets(competencia_id,etapa,mejor_de,referencia_resolucion,actualizado_por) values(9001,'final',5,NULL,'00000000-0000-0000-0000-000000000001');`);
  const final019={version_regla:19,posiciones:2,clasificados:2,pases_automaticos:0,metodo_distribucion:'final_grupo_unico',clasificaciones:[{grupo_id:9001,posicion:1,jugador_id:9101,snapshot:{revision:1}},{grupo_id:9001,posicion:2,jugador_id:9102,snapshot:{revision:1}}],rondas:[],decisiones:['Final independiente respaldada por decisión deportiva real.']};
  const finalKey=Number(last(sql(judge+`select public.guardar_propuesta_eliminatoria_019(9001,${quote(final019)},'Acta de decisión 019');`)));
  assert.equal(last(sql(`select estado||','||((propuesta::jsonb)->>'version_regla') from public.eliminatorias_llaves where id=${finalKey}`)),'borrador,19');
  assert.equal(last(sql(`select count(*) from public.eliminatorias_enfrentamientos where llave_id=${finalKey}`)),'1');
  sql(judge+`select public.confirmar_llave_eliminatoria_019(${finalKey},'Acta de confirmación 019',true,true,'Reglamento Liga, final grupo único','Resolución deportiva 019, final nueva y sin reencuentro');`);
  assert.equal(last(sql(`select referencia_pases_reencuentros from public.eliminatorias_respaldos where llave_id=${finalKey}`)),'Resolución deportiva 019, final nueva y sin reencuentro');
  sql(judge+`select public.configurar_formato_final_021(9001,'Regla SpinTrack final individual al mejor de 5, referencia deportiva local');`);
  assert.equal(last(sql(`select mejor_de||','||referencia_resolucion from public.competencia_formato_final_021 where competencia_id=9001`)),'5,Regla SpinTrack final individual al mejor de 5, referencia deportiva local');
  sql(`insert into public.competencias values(9002); insert into public.competencia_control_deportivo(competencia_id) values(9002);`);
  sql(judge+`select public.configurar_formato_final_021(9002,'Referencia nueva para final sin fila previa');`);
  assert.equal(last(sql(`select mejor_de||','||((actualizado_por is not null)::text) from public.competencia_formatos_sets where competencia_id=9002 and etapa='final'`)),'5,true');
  sql(`insert into public.competencias values(9003); insert into public.grupos_competencia values(9003,9003,1,'confirmado'); insert into public.jugadores values(9301,'Primero 3 sets'),(9302,'Segundo 3 sets'); insert into public.grupo_participantes values(9003,9301),(9003,9302); insert into public.fixture_standings values(9003,${quote({grupo_id:9003,numero:1,total:2,confirmados:2,pendientes:0,empate:false,aprobable:true,aprobacion:{vigente:true,referencia:'Acta local'},snapshot:{revision:1},filas:[{jugador_id:9301,nombre_completo:'Primero 3 sets',empate:false},{jugador_id:9302,nombre_completo:'Segundo 3 sets',empate:false}]})}); insert into public.competencia_control_deportivo(competencia_id) values(9003); insert into public.competencia_formatos_sets(competencia_id,etapa,mejor_de,referencia_resolucion,actualizado_por) values(9003,'final',3,'Referencia antigua mejor de 3','00000000-0000-0000-0000-000000000001');`);
  const oldBestOf3={version_regla:19,posiciones:2,clasificados:2,pases_automaticos:0,metodo_distribucion:'final_grupo_unico',clasificaciones:[{grupo_id:9003,posicion:1,jugador_id:9301,snapshot:{revision:1}},{grupo_id:9003,posicion:2,jugador_id:9302,snapshot:{revision:1}}],rondas:[],decisiones:['Prueba de referencia antigua.']};
  const oldBestOf3Key=Number(last(sql(judge+`select public.guardar_propuesta_eliminatoria_019(9003,${quote(oldBestOf3)},'Acta local 3 sets');`)));
  sql(judge+`select public.confirmar_llave_eliminatoria_019(${oldBestOf3Key},'Confirmación local 3 sets',true,true,'Reglamento local','Respaldo local');`);
  reject(judge+`select public.iniciar_eliminatoria_018(${oldBestOf3Key},'Inicio sin respaldo nuevo');`);
  reject(judge+`select public.configurar_formato_final_021(9003,'Referencia antigua mejor de 3');`);
  sql(judge+`select public.configurar_formato_final_021(9003,'Referencia auténtica nueva para final al mejor de 5');`);
  assert.equal(last(sql(`select mejor_de||','||referencia_resolucion from public.competencia_formatos_sets where competencia_id=9003 and etapa='final'`)),'5,Referencia auténtica nueva para final al mejor de 5');
  sql(judge+`select public.preparar_asignar_final_eliminatoria_020(${finalKey},'${refereeId}','Acta de preparación y asignación 020');`);
  const finalMatch=Number(last(sql(`select id from public.eliminatorias_partidos where llave_id=${finalKey}`)));
  const assignedEvents=Number(last(sql(`select count(*) from public.eliminatorias_eventos where partido_id=${finalMatch} and evento='asignado'`)));
  sql(judge+`select public.preparar_asignar_final_eliminatoria_020(${finalKey},'${refereeId}','Reintento idempotente 020');`);
  assert.equal(Number(last(sql(`select count(*) from public.eliminatorias_eventos where partido_id=${finalMatch} and evento='asignado'`))),assignedEvents);
  reject(judge+`select public.preparar_asignar_final_eliminatoria_020(${finalKey},'00000000-0000-0000-0000-000000000004','Reemplazo no autorizado');`);
  assert.equal(last(sql(`select arbitro_id from public.eliminatorias_partidos where id=${finalMatch}`)),refereeId);
  assert.equal(last(sql(`select jugador_a_id||','||jugador_b_id from public.eliminatorias_partidos where id=${finalMatch}`)),'9101,9102');
  const finalCall=(op,rev=0,sets=null)=>`select public.operar_eliminatoria_018(${finalMatch},'${op}',${rev},'Acta operación 019','${refereeId}',${sets?quote(sets):'null'});`;
  const concurrent020=await Promise.all([
    runConcurrent(judge+`select public.preparar_asignar_final_eliminatoria_020(${finalKey},'${refereeId}','Reintento concurrente A');`),
    runConcurrent(judge+`select public.preparar_asignar_final_eliminatoria_020(${finalKey},'${refereeId}','Reintento concurrente B');`),
  ]);
  concurrent020.forEach(result=>assert.equal(result.status,0,result.stderr));
  assert.equal(Number(last(sql(`select count(*) from public.eliminatorias_eventos where partido_id=${finalMatch} and evento='asignado'`))),assignedEvents);
  reject(judge+`select public.operar_eliminatoria_018(${finalMatch},'asignar',0,'Reemplazo vía 018','00000000-0000-0000-0000-000000000004',null);`);
  sql(referee+finalCall('comenzar')+finalCall('enviar',0,[{a:11,b:4},{a:11,b:4},{a:11,b:4}]));
  sql(judge+finalCall('observar',1));
  sql(referee+finalCall('enviar',1,[{a:11,b:4},{a:11,b:4},{a:11,b:4}]));
  const finalConfirms=await Promise.all([runConcurrent(judge+finalCall('confirmar',2)),runConcurrent(judge+finalCall('confirmar',2))]);
  finalConfirms.forEach(result=>assert.equal(result.status,0,result.stderr));
  assert.equal(last(sql(`select campeon_id||','||finalista_id||','||estado from public.eliminatorias_cuadros where llave_id=${finalKey}`)),'9101,9102,finalizado');
  assert.equal(last(sql(`select count(*) from public.eliminatorias_eventos where partido_id=${finalMatch} and evento='confirmado'`)),'1');
  console.log('019 PostgreSQL temporal: final de grupo único, observación, confirmación, campeón e idempotencia aprobados.');  // Reemplazo real del borrador 016 de la competencia de un solo grupo.
  sql(`insert into public.fixture_standings values(9100,${quote({grupo_id:9100,numero:1,total:4,confirmados:4,pendientes:0,empate:false,aprobable:true,aprobacion:{vigente:true,referencia:'Acta histórica 019'},snapshot:{grupo_id:9100},filas:[{jugador_id:9200,nombre_completo:'Histórico primero',empate:false},{jugador_id:9201,nombre_completo:'Histórico segundo',empate:false},{jugador_id:9202,nombre_completo:'Histórico tercero',empate:false},{jugador_id:9203,nombre_completo:'Histórico cuarto',empate:false}]})});
    insert into public.competencia_control_deportivo(competencia_id) values(9100);
    insert into public.competencia_formatos_sets(competencia_id,etapa,mejor_de,referencia_resolucion,actualizado_por) values(9100,'final',3,'Acta formato histórico 019','00000000-0000-0000-0000-000000000001');`);
  const historicalFinal={version_regla:19,posiciones:2,clasificados:2,pases_automaticos:0,metodo_distribucion:'final_grupo_unico',clasificaciones:[{grupo_id:9100,posicion:1,jugador_id:9200,snapshot:{grupo_id:9100}},{grupo_id:9100,posicion:2,jugador_id:9201,snapshot:{grupo_id:9100}}],rondas:[],decisiones:['Final nueva posterior al borrador 016.']};
  const replacementKey=Number(last(sql(judge+`select public.guardar_propuesta_eliminatoria_019(9100,${quote(historicalFinal)},'Acta reemplazo 019');`)));
  assert.equal(last(sql(`select estado from public.eliminatorias_llaves where id=${legacySingleId}`)),'reemplazada');
  assert.equal(last(sql(`select count(*) from public.eliminatorias_historial where llave_id=${legacySingleId} and evento='borrador_reemplazado'`)),'1');
  assert.equal(last(sql(`select count(*) from public.eliminatorias_enfrentamientos where llave_id=${replacementKey} and jugador_a_id<>jugador_b_id`)),'1');
  sql(judge+`select public.confirmar_llave_eliminatoria_019(${replacementKey},'Acta confirmación histórica 019',true,true,'Reglamento real 019','Resolución real de final única 019'); select public.configurar_formato_final_021(9100,'Referencia nueva final histórica al mejor de 5'); select public.iniciar_eliminatoria_018(${replacementKey},'Acta inicio histórico 019');`);
  const replacementMatch=Number(last(sql(`select id from public.eliminatorias_partidos where llave_id=${replacementKey}`)));
  const replacementCall=(op,rev=0,sets=null)=>`select public.operar_eliminatoria_018(${replacementMatch},'${op}',${rev},'Acta operación histórica 019','${refereeId}',${sets?quote(sets):'null'});`;
  sql(judge+replacementCall('asignar')+referee+replacementCall('comenzar')+replacementCall('enviar',0,[{a:11,b:4},{a:11,b:4},{a:11,b:4}])+judge+replacementCall('confirmar',1));
  assert.equal(last(sql(`select campeon_id||','||finalista_id from public.eliminatorias_cuadros where llave_id=${replacementKey}`)),'9200,9201');  // RegeneraciÃ³n explÃ­cita del borrador histÃ³rico, conservando el historial original.
  const groups=standings(2);sql(groups.map(g=>`
    insert into public.jugadores values ${g.filas.map(r=>`(${r.jugador_id},'Local')`).join(',')};
    insert into public.grupo_participantes values ${g.filas.map(r=>`(${g.grupo_id},${r.jugador_id})`).join(',')};
    insert into public.fixture_standings values(${g.grupo_id},${quote(g)});`).join('\n'));
  const input=lib.competitionInput('1',groups);
  sql(judge+`select public.guardar_propuesta_eliminatoria_017(1,${quote(lib.persistableProposal(input,lib.proposeBracket(input)))},'RegeneraciÃ³n explÃ­cita');`);
  assert.equal(last(sql(`select estado from public.eliminatorias_llaves where id=${oldId}`)),'reemplazada');
  assert.equal(last(sql(`select count(*) from public.eliminatorias_historial where llave_id=${oldId}`)),'2');
  reject(judge+`select public.iniciar_eliminatoria_018(${confirmedId},'Hist?rico no se convierte');`);
  assert.equal(sql(`select jsonb_build_array(
    (select to_jsonb(k) from public.eliminatorias_llaves k where id=${confirmedId}),
    (select jsonb_agg(to_jsonb(r)) from public.eliminatorias_rondas r where llave_id=${confirmedId}),
    (select jsonb_agg(to_jsonb(e)) from public.eliminatorias_enfrentamientos e where llave_id=${confirmedId}),
    (select jsonb_agg(to_jsonb(h) order by id) from public.eliminatorias_historial h where llave_id=${confirmedId}))::text`),confirmedBefore);
  console.log('018 PostgreSQL temporal: aprobado; sin conexiones remotas.');
} finally {
  if(started) assert.equal(run('pg_ctl',['-D',data,'-m','immediate','-w','stop']).status,0,'No borrar datos de un servidor que no se pudo detener');
  // Verificar el destino absoluto antes de la eliminaciÃ³n recursiva en Windows.
  assert.equal(path.dirname(path.resolve(scratch)),scratchRoot);
  assert.ok(path.basename(scratch).startsWith('spintrack-pg018-'));
  fs.rmSync(scratch,{recursive:true,force:true});
}




















