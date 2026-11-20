// PostgreSQL temporal loopback; no lee .env ni conecta a Supabase.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const url=new URL('./023_habilitacion_arbitraje.test.mjs',import.meta.url);
let source=fs.readFileSync(url,'utf8').replaceAll('import.meta.url',JSON.stringify(url.href));
const marker="  console.log('023 PostgreSQL temporal:";
assert.equal(source.split(marker).length,2);
source=source.replace(marker,()=>String.raw`
  sql(file('supabase/migrations/025_lectura_torneos_publicos.sql'));
  sql(file('supabase/migrations/026_ranking_oficial_2026.sql'));
  sql(file('supabase/migrations/027_mesas_programacion.sql'));
  const sports028="select jsonb_build_array((select jsonb_agg(to_jsonb(p) order by id) from public.partidos p),(select jsonb_agg(to_jsonb(r) order by id) from public.resultados_partidos r),(select jsonb_agg(to_jsonb(p) order by id) from public.eliminatorias_partidos p))";
  const historical028=sql(sports028);
  sql(file('supabase/migrations/028_jornadas_y_aceptacion_legal.sql'));
  assert.equal(sql(sports028),historical028,'028 conserva todos los partidos y resultados');
  const json028=text=>JSON.parse(text.trim().split('\n').at(-1));
  const review028=id=>json028(sql(admin+'select public.revisar_jornada_028('+id+');'));
  const operate028=(r,op,phrase=null)=>"select public.gestionar_jornada_028('"+r.token+"','"+op+"',"+(phrase===null?'null':"'"+phrase+"'")+");";
  sql(player+reject('select public.revisar_jornada_028(4004);'));
  sql(judge+reject('select public.revisar_jornada_028(4004);'));
  sql(admin+reject('delete from public.fechas where id=4004;'));
  sql(admin+reject("update public.fechas set estado='borrador' where id=4004;",'23514'));
  const protected028=review028(4004);assert.equal(protected028.protegida,true);
  assert.ok(protected028.dependencias.partidos>0);assert.ok(protected028.dependencias.resultados_partidos>0);
  sql(admin+reject(operate028(protected028,'eliminar','ELIMINAR JORNADA '+protected028.jornada.numero),'55000'));
  sql('begin;'+admin+operate028(protected028,'archivar')+"select public.check004((select archivada from public.fechas where id=4004),'Archivo conserva jornada');rollback;");
  assert.equal(sql(sports028),historical028,'Archivo y rechazo no cambian resultados históricos');
  sql("insert into public.fechas(id,temporada_id,numero,fecha,comuna,recinto,estado) values(28001,4004,81,'2026-11-20','Local','Prueba','borrador'),(28002,4004,82,'2026-11-21','Local','Prueba','publicada'),(28003,4004,83,'2026-11-22','Local','Prueba','publicada');");
  const draft028=review028(28001);assert.equal(draft028.protegida,false);
  sql(admin+reject(operate028(draft028,'eliminar','ELIMINAR JORNADA 82'),'22023'));
  sql(player+reject(operate028(draft028,'eliminar','ELIMINAR JORNADA 81')));
  sql(admin+reject("select public.gestionar_jornada_028('00000000-0000-0000-0000-000000000000','eliminar','ELIMINAR JORNADA 81');",'22023'));
  sql(admin+operate028(draft028,'eliminar','ELIMINAR JORNADA 81'));
  assert.equal(sql('select count(*) from public.fechas where id=28001'),'0');
  sql(admin+reject(operate028(draft028,'eliminar','ELIMINAR JORNADA 81'),'22023'));
  const published028=review028(28002);
  sql(admin+operate028(published028,'despublicar'));
  assert.equal(sql('select estado from public.fechas where id=28002'),'borrador');
  sql(admin+"reset role;insert into public.competencias(id,temporada_id,fecha_id,categoria_temporada_id) overriding system value values(28003,4004,28003,4004);");
  const emptyComp028=review028(28003);assert.equal(emptyComp028.dependencias.competencias,1);assert.equal(emptyComp028.protegida,false);
  // Una modificación concurrente debe invalidar el primer paso.
  const holder028=concurrent("begin;update public.fechas set recinto='Cambio concurrente' where id=28003;select pg_sleep(1);commit;");
  await new Promise(resolve=>setTimeout(resolve,150));
  await concurrent(admin+reject(operate028(emptyComp028,'eliminar','ELIMINAR JORNADA 83'),'40001'));
  await holder028;
  const refreshed028=review028(28003);
  sql(admin+operate028(refreshed028,'eliminar','ELIMINAR JORNADA 83'));
  assert.equal(sql('select count(*) from public.competencias where id=28003'),'0');
  assert.equal(sql("select count(*) from public.jornadas_operaciones_028 where operacion='eliminar' and actor_id='e0040000-0000-0000-0000-000000000001'"),'2');
  const expired028=review028(28002);
  sql("update public.jornadas_revisiones_028 set vence_en=clock_timestamp()-interval '1 second' where token='"+expired028.token+"';");
  sql(admin+reject(operate028(expired028,'eliminar','ELIMINAR JORNADA 82'),'22023'));
  sql("set role anon;select public.reject004('select * from public.jornadas_operaciones_028','42501');");
  sql(player+reject('insert into public.jornadas_revisiones_028(fecha_id,actor_id,snapshot) values(28002,auth.uid(),\'{}\');'));
  // Usuarios existentes: aceptación propia, idempotente y nueva versión obligatoria.
  assert.equal(json028(sql(player+'select public.estado_legal_028();')).aceptada,false);
  sql(player+reject("select public.aceptar_terminos_028('2026-11-19.1',false);",'22023')+reject("select public.aceptar_terminos_028('obsoleta',true);",'22023'));
  sql(player+"select public.aceptar_terminos_028('2026-11-19.1',true);select public.aceptar_terminos_028('2026-11-19.1',true);");
  assert.equal(json028(sql(player+'select public.estado_legal_028();')).aceptada,true);
  assert.equal(sql("select count(*) from public.aceptaciones_legales_028 where usuario_id='e0040000-0000-0000-0000-000000000003'"),'1');
  sql("begin;update public.version_legal_028 set version='nueva';"+player+"select public.check004((public.estado_legal_028()->>'aceptada')::boolean=false,'Nueva versión exige aceptación');rollback;");
  sql(player+reject("insert into public.aceptaciones_legales_028(usuario_id,version,origen) values(auth.uid(),'falsa','sesion');"));
  // Registro directo tampoco puede eludir la aceptación, incluso fuera de Next.
  sql("select public.reject004($q$insert into auth.users(id,email,raw_user_meta_data) values('e0280000-0000-0000-0000-000000000001','local@example.test','{}')$q$,'23514');");
  sql("begin;insert into auth.users(id,email,raw_user_meta_data) values('e0280000-0000-0000-0000-000000000001','local@example.test','{\"full_name\":\"Local\",\"terminos_version\":\"2026-11-19.1\",\"terminos_aceptados\":true}');select public.check004((select count(*)=1 from public.aceptaciones_legales_028 where usuario_id='e0280000-0000-0000-0000-000000000001' and origen='registro'),'Registro con aceptación auditada');rollback;");
  // Crear/editar jornadas conserva autorización y campos administrativos de 001.
  sql(admin+"insert into public.fechas(id,temporada_id,numero,fecha,comuna,recinto,estado) values(28004,4004,84,'2026-11-23','Administración','Sede','borrador');update public.fechas set fecha='2026-11-24',comuna='Editada',recinto='Editado',estado='publicada' where id=28004;");
  assert.equal(sql("select estado||':'||comuna from public.fechas where id=28004"),'publicada:Editada');
  sql(admin+"update public.fechas set estado='borrador' where id=28004;");
  sql(player+"update public.fechas set recinto='Sin autorización' where id=28004;");
  assert.equal(sql('select recinto from public.fechas where id=28004'),'Editado');
  sql(admin+reject('update public.fechas set archivada=true where id=28004;'));
  sql(admin+reject('delete from public.fechas where id=28004;'));

  // Ranking sin FK: una jornada vacía incluida en fecha_ids también está protegida.
  for(let n=2;n<=7;n++) sql("insert into public.fechas(id,temporada_id,numero,fecha,comuna,recinto,estado) values("+(28200+n)+",4004,"+n+",'2026-11-24','Ranking','Sede','publicada');");
  sql(admin+"select public.configurar_ranking_026(4004,4004,array[4004,28202,28203,28204,28205,28206,28207],'Resolución sintética para verificar protección');");
  const ranked028=review028(28202);
  assert.equal(ranked028.protegida,true);assert.equal(ranked028.dependencias.ranking_configuraciones_026,1);
  sql(admin+reject(operate028(ranked028,'eliminar','ELIMINAR JORNADA 2'),'55000')+reject(operate028(ranked028,'despublicar'),'55000'));
  sql(admin+operate028(ranked028,'archivar'));
  assert.equal(sql("select archivada and estado='publicada' from public.fechas where id=28202"),'t');

  // Una referencia FK insertada concurrentemente invalida la revisión y conserva historial.
  sql("insert into public.fechas(id,temporada_id,numero,fecha,comuna,recinto,estado) values(28010,4004,90,'2026-11-24','Historial','Sede','publicada');");
  const beforeHistory028=review028(28010);
  const historyHolder028=concurrent("begin;insert into public.programacion_historial(fecha_id,evento,actor_id,motivo,detalle) values(28010,'mesa','e0040000-0000-0000-0000-000000000001','NO_PUBLICAR_MOTIVO','{\"nombre_completo\":\"NO_PUBLICAR_PERSONA\"}');select pg_sleep(1);commit;");
  await new Promise(resolve=>setTimeout(resolve,150));
  await concurrent(admin+reject(operate028(beforeHistory028,'eliminar','ELIMINAR JORNADA 90'),'40001'));
  await historyHolder028;
  const withHistory028=review028(28010);assert.equal(withHistory028.protegida,true);
  sql(admin+reject(operate028(withHistory028,'eliminar','ELIMINAR JORNADA 90'),'55000'));
  sql(admin+operate028(withHistory028,'archivar'));
  // La protección de despublicación no impide el cierre administrativo legítimo.
  sql(admin+"update public.fechas set estado='finalizada' where id=28010;");
  assert.equal(sql("select archivada and estado='finalizada' from public.fechas where id=28010"),'t');
  sql(admin+reject("update public.fechas set estado='borrador' where id=28010;",'55000'));
  const savedReviews028=sql('select coalesce(jsonb_agg(snapshot),\'[]\') from public.jornadas_revisiones_028');
  assert.ok(!/NO_PUBLICAR|nombre_completo|fecha_nacimiento|referencia_evidencia/.test(savedReviews028));
  const audit028=JSON.parse(sql('select jsonb_agg(resumen) from public.jornadas_operaciones_028'));
  for(const entry028 of audit028) assert.deepEqual(Object.keys(entry028).sort(),['dependencias','jornada']);
  assert.ok(!/NO_PUBLICAR|nombre_completo|fecha_nacimiento|huella|snapshot/.test(JSON.stringify(audit028)));

  // Mantener locks de una jornada no debe bloquear escrituras de catálogos ajenos.
  const independent028=review028(28004);
  const held028=concurrent("begin;"+admin+operate028(independent028,'archivar')+"select pg_advisory_xact_lock(28028,1);select pg_sleep(2);commit;");
  let ready028=false;
  for(let i=0;i<15;i++) {
    if(sql('select exists(select 1 from pg_locks where locktype=\'advisory\' and classid=28028 and objid=1 and granted)')==='t'){ready028=true;break;}
    await new Promise(resolve=>setTimeout(resolve,40));
  }
  assert.equal(ready028,true,'Operación mantiene sus locks durante la comprobación');
  sql("set lock_timeout='400ms';insert into public.localidades(nombre) values('Catálogo concurrente independiente');");
  await held028;

  // Booleano real, versión vigente y fecha de servidor; no ejecutar controles en UPDATE.
  sql("select public.reject004($q$insert into auth.users(id,email,raw_user_meta_data) values('e0280000-0000-0000-0000-000000000002','local@example.test','{\"terminos_version\":\"2026-11-19.1\",\"terminos_aceptados\":\"true\"}')$q$,'23514');");
  sql("begin;insert into auth.users(id,email,raw_user_meta_data) values('e0280000-0000-0000-0000-000000000003','local@example.test','{\"full_name\":\"Prueba\",\"rol\":\"administrador\",\"terminos_version\":\"2026-11-19.1\",\"terminos_aceptados\":true,\"aceptado_en\":\"2099-01-01\"}');update auth.users set raw_user_meta_data='{}' where id='e0280000-0000-0000-0000-000000000003';select public.check004((select rol='jugador' from public.perfiles where id='e0280000-0000-0000-0000-000000000003'),'Registro conserva Jugador');select public.check004((select version='2026-11-19.1' and origen='registro' and aceptado_en<now()+interval '1 minute' from public.aceptaciones_legales_028 where usuario_id='e0280000-0000-0000-0000-000000000003'),'Fecha y aceptación real persisten tras UPDATE de Auth');rollback;");
  sql("begin;delete from public.version_legal_028;"+player+reject('select public.aceptar_terminos_028(null,true);','22023')+'rollback;');
  sql(player+reject("update public.aceptaciones_legales_028 set aceptado_en='2099-01-01';"));
  assert.equal(sql(sports028),historical028,'Todas las pruebas conservan resultados históricos');
  console.log('028 PostgreSQL: eliminación doble, permisos, archivo, revisión vencida, concurrencia, conservación histórica, registro y aceptación versionada aprobados.');
`+marker);
const runner=fileURLToPath(new URL('../../test-results/pg028-runner.mjs',import.meta.url));
fs.writeFileSync(runner,source);
try { await import(pathToFileURL(runner).href); } finally { fs.unlinkSync(runner); }
