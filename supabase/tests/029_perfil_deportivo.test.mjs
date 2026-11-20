// PostgreSQL temporal loopback, fixtures sintéticos, solo migraciones 001–029.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
const url = new URL('./023_habilitacion_arbitraje.test.mjs', import.meta.url);
let source = fs.readFileSync(url, 'utf8').replaceAll('import.meta.url', JSON.stringify(url.href));
const marker = "  console.log('023 PostgreSQL temporal:";
assert.equal(source.split(marker).length, 2);
source = source.replace(marker, () => String.raw`
  for (const migration of ['025_lectura_torneos_publicos.sql','026_ranking_oficial_2026.sql','027_mesas_programacion.sql','028_jornadas_y_aceptacion_legal.sql']) sql(file('supabase/migrations/'+migration));
  const signatures029=sql("select jsonb_object_agg(p.proname,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('estado_legal_028','aceptar_terminos_028','validar_registro_legal_028','registrar_aceptacion_028','snapshot_jornada_028','protegida_jornada_028','bloquear_jornada_028','validar_estado_jornada_028','revisar_jornada_028','gestionar_jornada_028')");
  fs.writeFileSync(path.join(root,'test-results/029-028-firmas.json'),JSON.stringify(JSON.parse(signatures029),null,2));
  sql(file('supabase/audits/025_026_solo_lectura.sql'));
  sql(file('supabase/audits/028_solo_lectura.sql'));
  const publicBefore029=sql("select jsonb_agg(jsonb_build_array(p.proname,p.prosrc,p.proacl) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('consultar_torneos_publicos_025','consultar_ranking_publico_026')");
  sql(file('supabase/migrations/029_editar_perfil_deportivo.sql'));
  assert.equal(sql("select jsonb_agg(jsonb_build_array(p.proname,p.prosrc,p.proacl) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('consultar_torneos_publicos_025','consultar_ranking_publico_026')"),publicBefore029,'029 conserva cuerpos y permisos originales 025/026');
  assert.equal(sql("select count(*) from pg_trigger where tgname in ('resguardo_alta_revision_030','resguardo_aceptacion_revision_030')"),'0');
  const uid029='e0290000-0000-0000-0000-000000000001';
  const owner029="set role authenticated;select set_config('request.jwt.claims','{\"sub\":\""+uid029+"\"}',false);";
  sql("insert into auth.users(id,email,raw_user_meta_data) values('"+uid029+"','synthetic@example.test','{\"full_name\":\"Ficha sin antecedentes\",\"terminos_version\":\"2026-11-19.1\",\"terminos_aceptados\":true}');insert into public.jugadores(id,perfil_id,nombre_completo) overriding system value values(29001,'"+uid029+"','Ficha sintética');");
  sql("insert into public.clubes(id,nombre,activo) overriding system value values(29001,'Catálogo activo',true),(29002,'Catálogo inactivo',false);insert into public.localidades(id,nombre,activo) overriding system value values(29001,'Localidad activa',true),(29002,'Localidad inactiva',false);");
  const state029=id=>JSON.parse(sql("select jsonb_build_object('fecha_nacimiento',fecha_nacimiento,'club_id',club_id,'localidad_procedencia_id',localidad_procedencia_id) from public.jugadores where id="+id));
  const literal029=value=>value===null?'null':typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'";
  const save029=(id,patch={},expected=state029(id))=>{const data={...state029(id),...patch};return 'select public.editar_mi_perfil_deportivo_029('+id+','+literal029(data.fecha_nacimiento)+','+literal029(data.club_id)+','+literal029(data.localidad_procedencia_id)+','+literal029(expected===null?null:JSON.stringify(expected))+'::jsonb);';};
  const sports029=sql('select jsonb_build_array((select jsonb_agg(to_jsonb(p) order by id) from public.partidos p),(select jsonb_agg(to_jsonb(r) order by id) from public.resultados_partidos r),(select jsonb_agg(to_jsonb(p) order by id) from public.eliminatorias_partidos p))');
  const accounts029=sql('select jsonb_agg(to_jsonb(u) order by id) from auth.users u');
  const profiles029=sql('select jsonb_agg(to_jsonb(p) order by id) from public.perfiles p');
  const identities029=sql('select jsonb_agg(jsonb_build_array(id,perfil_id,nombre_completo,activo) order by id) from public.jugadores');
  const original029=state029(29001);
  sql('set role anon;'+reject(save029(29001)));
  sql("set role authenticated;select set_config('request.jwt.claims','{}',false);"+reject(save029(29001)));
  sql(player+reject(save029(29001)));
  sql(owner029+reject(save029(4004)));
  for(const expected029 of [null,{},[],{...original029,rol:'administrador'}]) sql(owner029+reject(save029(29001,{},expected029),'22023'));
  for(const birth029 of ['2999-01-01','infinity','-infinity','0001-01-01 BC']) sql(owner029+reject(save029(29001,{fecha_nacimiento:birth029}),'22023'));
  sql(owner029+reject(save029(29001,{fecha_nacimiento:'2025-02-29'}),'22008'));
  for(const patch029 of [{club_id:999999999},{club_id:29002},{localidad_procedencia_id:29002},{localidad_procedencia_id:-1}]) sql(owner029+reject(save029(29001,patch029),'22023'));
  sql(owner029+save029(29001,{fecha_nacimiento:'2000-02-29',club_id:29001,localidad_procedencia_id:29001}));
  assert.deepEqual(state029(29001),{fecha_nacimiento:'2000-02-29',club_id:29001,localidad_procedencia_id:29001});
  for(const field029 of ['fecha_nacimiento','club_id','localidad_procedencia_id']) sql(owner029+reject(save029(29001,{[field029]:null}),'22023'));
  sql(owner029+reject(save029(29001,{},original029),'40001'));
  sql(owner029+"update public.jugadores set fecha_nacimiento='2001-01-01' where id=29001;");
  assert.equal(state029(29001).fecha_nacimiento,'2000-02-29','RLS impide UPDATE directo propio');
  sql("update public.clubes set activo=false where id=29001;");
  sql(owner029+save029(29001,{fecha_nacimiento:'2000-03-01'}));
  assert.equal(state029(29001).club_id,29001,'Conserva catálogo inactivo asignado');
  sql('begin isolation level repeatable read;'+owner029+reject(save029(29001),'25001')+'rollback;');
  // Mantener permisos administrativos sin debilitar la RPC de autoservicio.
  sql('begin;'+admin+"update public.jugadores set fecha_nacimiento='2000-02-28' where id=4004;select public.check004((select fecha_nacimiento='2000-02-28' from public.jugadores where id=4004),'Corrección administrativa conservada');rollback;");
  sql(player+reject(save029(4005,{fecha_nacimiento:'2000-02-28'}),'55000'));
  const change029={fecha_nacimiento:'2001-02-01'};
  // Habilitación pendiente y antecedentes históricos también requieren revisión.
  sql('begin;'+judge+"insert into public.habilitaciones_jugador_categoria(jugador_id,categoria_temporada_id,estado) values(29001,4004,'pendiente');"+owner029+reject(save029(29001,change029),'55000')+'rollback;');
  sql("begin;insert into public.participantes_competencia_historial(jugador_id,competencia_id,evento,actor_id,fuente,referencia_trazabilidad,motivo) values(29001,4004,'retirado','e0040000-0000-0000-0000-000000000002','manual','Fixture histórico','Retirada de prueba');"+owner029+reject(save029(29001,change029),'55000')+save029(29001)+'rollback;');
  sql("begin;insert into public.ranking_resoluciones_026(competencia_id,jugador_id,puesto,autoridad,referencia,motivo,registrado_por) values(4004,29001,3,'Juez de prueba','Referencia sintética de ranking','Motivo sintético de ranking','e0040000-0000-0000-0000-000000000002');"+owner029+reject(save029(29001,change029),'55000')+'rollback;');
  // Dos formularios con la misma fotografía: uno guarda y el otro falla sin sobrescribir.
  const expected029=state029(29001);
  const first029=save029(29001,{fecha_nacimiento:'2001-02-02'},expected029);
  const second029=save029(29001,{fecha_nacimiento:'2001-02-03'},expected029);
  const holder029=concurrent('begin;'+owner029+first029+'select pg_sleep(1);commit;');
  await new Promise(resolve=>setTimeout(resolve,150));
  await concurrent(owner029+reject(second029,'40001'));await holder029;
  assert.equal(state029(29001).fecha_nacimiento,'2001-02-02');
  // Un vínculo revocado mientras se espera no conserva el acceso.
  const beforeUnlink029=save029(29001,{fecha_nacimiento:'2001-02-04'});
  const unlink029=concurrent('begin;'+admin+'update public.jugadores set perfil_id=null where id=29001;select pg_sleep(1);commit;');
  await new Promise(resolve=>setTimeout(resolve,150));
  await concurrent(owner029+reject(beforeUnlink029));await unlink029;
  sql(admin+"update public.jugadores set perfil_id='"+uid029+"' where id=29001;");
  // Una habilitación validada concurrentemente no puede quedar con nacimiento obsoleto.
  const eligibilityEdit029=save029(29001,{fecha_nacimiento:'2001-02-05'});
  const eligibility029=concurrent('begin;'+judge+"insert into public.habilitaciones_jugador_categoria(jugador_id,categoria_temporada_id,estado) values(29001,4004,'pendiente');select pg_sleep(1);commit;");
  await new Promise(resolve=>setTimeout(resolve,150));
  await concurrent(owner029+reject(eligibilityEdit029,'55000'));await eligibility029;
  assert.equal(state029(29001).fecha_nacimiento,'2001-02-02');
  assert.equal(sql('select jsonb_agg(to_jsonb(u) order by id) from auth.users u'),accounts029);
  assert.equal(sql('select jsonb_agg(to_jsonb(p) order by id) from public.perfiles p'),profiles029);
  assert.equal(sql('select jsonb_agg(jsonb_build_array(id,perfil_id,nombre_completo,activo) order by id) from public.jugadores'),identities029);
  assert.equal(sql('select jsonb_build_array((select jsonb_agg(to_jsonb(p) order by id) from public.partidos p),(select jsonb_agg(to_jsonb(r) order by id) from public.resultados_partidos r),(select jsonb_agg(to_jsonb(p) order by id) from public.eliminatorias_partidos p))'),sports029);
  for(const role029 of ['anon','service_role']) assert.equal(sql("select has_function_privilege('"+role029+"','public.editar_mi_perfil_deportivo_029(bigint,date,bigint,bigint,jsonb)','execute')"),'f');
  assert.equal(sql("select has_function_privilege('authenticated','public.editar_mi_perfil_deportivo_029(bigint,date,bigint,bigint,jsonb)','execute')"),'t');
  console.log('029 PostgreSQL: ficha propia, NULL, p_esperado, catálogos, antecedentes, concurrencia real, permisos e historial aprobados.');
` + marker);
const runner = fileURLToPath(new URL('../../test-results/pg029-runner.mjs', import.meta.url));
fs.writeFileSync(runner, source);
try { await import(pathToFileURL(runner).href); } finally { fs.unlinkSync(runner); }
