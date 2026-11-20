// Clúster PostgreSQL temporal: hereda fixtures y auditoría deportiva real 001–024.
// No lee .env ni se conecta a Supabase.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const url=new URL('./023_habilitacion_arbitraje.test.mjs',import.meta.url);
let source=fs.readFileSync(url,'utf8').replaceAll('import.meta.url',JSON.stringify(url.href));
function before(marker,code){assert.equal(source.split(marker).length,2,marker);source=source.replace(marker,code+'\n'+marker);}
before('  const session = suffix =>',String.raw`
  sql(file('supabase/migrations/025_lectura_torneos_publicos.sql'));
  sql(file('supabase/migrations/026_ranking_oficial_2026.sql'));
  const originalSports=sql("select jsonb_build_array((select jsonb_agg(to_jsonb(p) order by id) from public.partidos p),(select jsonb_agg(to_jsonb(r) order by id) from public.resultados_partidos r))");
  sql(file('supabase/migrations/027_mesas_programacion.sql'));
  assert.equal(sql("select jsonb_build_array((select jsonb_agg(to_jsonb(p) order by id) from public.partidos p),(select jsonb_agg(to_jsonb(r) order by id) from public.resultados_partidos r))"),originalSports,'027 no cambia los partidos ni resultados existentes');
`);
before("  check(`(select arbitraje_habilitado",String.raw`
  const fixtures=JSON.parse(sql('select json_agg(p order by id) from public.partidos p'));
  const firstMatch=fixtures[0],disjoint=fixtures.find(p=>![firstMatch.jugador_a_id,firstMatch.jugador_b_id].includes(p.jugador_a_id)&&![firstMatch.jugador_a_id,firstMatch.jugador_b_id].includes(p.jugador_b_id));
  const shared=fixtures.find(p=>p.id!==firstMatch.id&&[firstMatch.jugador_a_id,firstMatch.jugador_b_id].some(j=>[p.jugador_a_id,p.jugador_b_id].includes(j)));
  const ref='e0040000-0000-0000-0000-000000000005',ref2='e0040000-0000-0000-0000-000000000004';
  const setup027="alter sequence public.mesas_jornada_id_seq restart with 1;alter table public.competencia_control_deportivo disable trigger user;update public.competencia_control_deportivo set estado_deportivo='en_curso',inicio_programado='2026-11-19T14:00:00Z' where competencia_id=4004;alter table public.competencia_control_deportivo enable trigger user;";
  const allocation=(match,table=1,arbitro=ref,start='2026-11-19T15:00:00Z',end='2026-11-19T15:20:00Z')=>({tipo:'grupo',partido:match.id,mesa_id:table,arbitro_id:arbitro,inicio:start,fin:end});
  const confirm027=(items,rest=0)=>"select public.confirmar_programacion_027(4004,'"+JSON.stringify(items)+"'::jsonb,"+rest+",'Fixture programación');";
  const firstBooking=allocation(firstMatch);
  // Aislamiento, RLS y rechazo de participantes/mesas/personas incompatibles.
  sql('begin;'+setup027+judge+"select public.gestionar_mesa_027(4004,1,'disponible');select public.gestionar_mesa_027(4004,2,'disponible');"+confirm027([firstBooking])+
    reject(confirm027([allocation(disjoint)]),'23P01')+
    reject(confirm027([allocation(shared,2)]),'23P01')+
    reject(confirm027([allocation(disjoint,2)]),'23P01')+
    reject("select public.gestionar_mesa_027(4004,1,'fuera_servicio');",'55000')+
    reject(confirm027([firstBooking]),'23P01')+
    "select public.check004((select count(*)=1 from public.programacion_reservas),'Una mesa una reserva');rollback;");
  sql(player+reject("select public.consultar_programacion_027(4004);"));
  sql(player+reject("select public.gestionar_mesa_027(4004,1,'disponible');"));
  sql(judge+reject("insert into public.mesas_jornada(fecha_id,numero) values(4004,999);"));
  sql("set role anon;select public.reject004('select * from public.programacion_reservas','42501');");
  sql('begin;'+setup027+admin+"select public.habilitar_arbitraje_023('e0040000-0000-0000-0000-000000000003',true,false);"+judge+"select public.gestionar_mesa_027(4004,1,'disponible');"+reject(confirm027([allocation(firstMatch,1,'e0040000-0000-0000-0000-000000000003')]),'23514')+'rollback;');
  // La propuesta completa es atómica: un conflicto revierte la primera fila.
  sql('begin;'+setup027+judge+"select public.gestionar_mesa_027(4004,1,'disponible');"+reject(confirm027([firstBooking,allocation(disjoint)]),'23P01')+"select public.check004((select count(*)=0 from public.programacion_reservas),'Tanda atómica');rollback;");
  // Una reserva futura no impide jugar/enviar el encuentro anterior, pero no
  // puede comenzar mientras el primero siga en juego o revisión.
  sql('begin;'+setup027+judge+"select public.gestionar_mesa_027(4004,1,'disponible');"+confirm027([firstBooking,allocation(disjoint,1,ref,'2026-11-19T15:20:00Z','2026-11-19T15:40:00Z')])+
    "select public.operar_reserva_027((select min(id) from public.programacion_reservas),1,'comenzar','Inicio supervisado');select public.check004((select count(*)=1 from public.programacion_reservas where estado='en_juego'),'Inicio con siguiente reserva');"+
    "select public.reject004('select public.operar_reserva_027('||(select max(id) from public.programacion_reservas)||',1, ''comenzar'', ''Mesa todavía ocupada'')','23P01');"+legacy+
    "select public.capturar_resultado_partido("+firstMatch.id+",0,'ordinario','[{\"a\":11,\"b\":5},{\"a\":11,\"b\":5}]','Fixture','Fixture',true);"+judge+"select public.check004((select count(*)=1 from public.programacion_reservas where estado='revision'),'Envío conserva mesa con reserva futura');rollback;");
  // Dos competencias en la misma jornada: paralelo permitido con recursos distintos.
  sql('begin;'+setup027+admin+"update public.jugadores set perfil_id=null where perfil_id='"+ref2+"';select public.habilitar_arbitraje_023('"+ref2+"',true,false);"+judge+
    "select public.confirmar_participantes_competencia(4005,array[4005,4006,4007,4008],'manual','Fixture programación');select public.guardar_grupos_competencia(4005,'[{\"numero\":1,\"jugador_ids\":[4005,4006,4007,4008]}]','Fixture');select public.confirmar_grupos_competencia(4005,'Fixture');select public.generar_partidos_grupos(4005,true,'Fixture');select public.confirmar_partidos_grupos(4005,(select id from public.lotes_partidos_grupos where competencia_id=4005),'Fixture');"+
    "reset role;alter table public.competencia_control_deportivo disable trigger user;update public.competencia_control_deportivo set inicio_programado='2026-11-19T14:00:00Z' where competencia_id=4005;alter table public.competencia_control_deportivo enable trigger user;"+judge+
    "select public.gestionar_mesa_027(4004,1,'disponible');select public.gestionar_mesa_027(4004,2,'disponible');"+confirm027([firstBooking])+
    "select public.confirmar_programacion_027(4004,jsonb_build_array(jsonb_build_object('tipo','grupo','partido',(select min(id) from public.partidos where competencia_id=4005 and jugador_a_id=4007 and jugador_b_id=4008),'mesa_id',2,'arbitro_id','"+ref2+"','inicio','2026-11-19T15:00:00Z','fin','2026-11-19T15:20:00Z')),0,'Paralelo');select public.check004((select count(*)=2 from public.programacion_reservas),'Dos categorías en paralelo');select public.operar_reserva_027((select max(id) from public.programacion_reservas),1,'liberar','Prueba de jugador compartido');"+
    "select public.reject004($q$select public.confirmar_programacion_027(4004,jsonb_build_array(jsonb_build_object('tipo','grupo','partido',(select min(id) from public.partidos where competencia_id=4005 and jugador_a_id=4005),'mesa_id',2,'arbitro_id','"+ref2+"','inicio','2026-11-19T15:00:00Z','fin','2026-11-19T15:20:00Z')),0,'Jugador compartido')$q$,'23P01');rollback;");
  // Reprogramación, versión obsoleta, liberación y reutilización.
  const single=Number(sql('begin;'+setup027+judge+"select public.gestionar_mesa_027(4004,1,'disponible');"+confirm027([firstBooking])+"select max(id) from public.programacion_reservas;rollback;").split(/\r?\n/).at(-1));
  assert.ok(single>0);
  // Secuencias identity no se revierten: resolver id de mesa siempre en el servidor local.
  sql(setup027+judge+"select public.gestionar_mesa_027(4004,1,'disponible');select public.gestionar_mesa_027(4004,2,'disponible');");
  const ids027=JSON.parse(sql('select json_agg(id order by numero) from public.mesas_jornada where fecha_id=4004'));
  const actualFirst=allocation(firstMatch,ids027[0]);
  const race027=await Promise.allSettled([concurrent(judge+confirm027([actualFirst])),concurrent(judge+confirm027([allocation(disjoint,ids027[0])]))]);
  assert.equal(race027.filter(r=>r.status==='fulfilled').length,1,'Dos confirmaciones simultáneas: solo una ocupa la mesa');
  const booking027=JSON.parse(sql("select row_to_json(r) from public.programacion_reservas r where estado='asignada'"));
  const chosen=fixtures.find(m=>m.id===booking027.grupo_partido_id);
  sql(judge+confirm027([{...allocation(chosen,ids027[1]),reserva_id:booking027.id,version:booking027.version}]));
  sql(judge+reject("select public.operar_reserva_027("+booking027.id+",1,'liberar','Obsoleta');",'40001'));
  let moved=JSON.parse(sql("select row_to_json(r) from public.programacion_reservas r where estado='asignada'"));
  sql(judge+"select public.operar_reserva_027("+moved.id+","+moved.version+",'liberar','Liberación supervisada');");
  sql(judge+confirm027([actualFirst],5));
  // Envío mantiene la mesa; confirmación libera; una corrección reabre revisión.
  const capture027="select public.capturar_resultado_partido("+firstMatch.id+",0,'ordinario','[{\"a\":11,\"b\":5},{\"a\":11,\"b\":5}]','Fixture','Fixture',true);";
  sql('begin;'+legacy+capture027+judge+"select public.check004((select estado='revision' from public.programacion_reservas where estado not in ('cancelada','liberada')),'Enviado mantiene reserva');"+
    "select public.reject004('select public.operar_reserva_027('||(select id from public.programacion_reservas where estado='revision')||','||(select version from public.programacion_reservas where estado='revision')||', ''liberar'', ''Revisión'')','55000');"+
    "select public.confirmar_resultado_partido("+firstMatch.id+",(select max(id) from public.resultados_partidos where partido_id="+firstMatch.id+"),1,'Fixture');select public.check004((select count(*)=0 from public.programacion_reservas where estado not in ('cancelada','liberada')),'Confirmación libera');"+
    reject(confirm027([allocation(shared,ids027[0])]),'23P01')+legacy+
    "select public.capturar_resultado_partido("+firstMatch.id+",1,'ordinario','[{\"a\":11,\"b\":5},{\"a\":11,\"b\":5}]','Fixture','Fixture',true,'','Corrección supervisada');"+judge+"select public.check004((select count(*)=1 from public.programacion_reservas where estado='revision'),'Corrección reabre reserva');rollback;");
  const active027=JSON.parse(sql("select row_to_json(r) from public.programacion_reservas r where estado='asignada'"));
  sql(judge+"select public.operar_reserva_027("+active027.id+","+active027.version+",'liberar','Preparar carrera de aislamiento');");
  const repeatable027=items=>"begin isolation level repeatable read;select count(*) from public.programacion_guardia_027;select pg_sleep(0.2);"+judge+confirm027(items)+'commit;';
  const isolation027=await Promise.allSettled([concurrent(repeatable027([actualFirst])),concurrent(repeatable027([allocation(disjoint,ids027[0])]))]);
  assert.equal(isolation027.filter(r=>r.status==='fulfilled').length,1,'REPEATABLE READ tampoco permite reservas contradictorias');
  // Limpiar solo fixtures del clúster temporal, antes de ejecutar la regresión 023.
  sql('delete from public.programacion_historial;delete from public.programacion_reservas;delete from public.mesas_jornada;alter table public.competencia_control_deportivo disable trigger user;update public.competencia_control_deportivo set estado_deportivo=\'preparada\' where competencia_id=4004;alter table public.competencia_control_deportivo enable trigger user;');
  console.log('027: RLS, atomicidad, intervalos, mesa/persona/árbitro, reprogramación, liberación, revisión/confirmación y carrera concurrente: OK');
`);
before('  const semis=JSON.parse',String.raw`
  const snapshot027=JSON.parse(sql(judge+'select public.consultar_programacion_027(4004);').split(/\r?\n/).at(-1));
  const future027=snapshot027.partidos.find(p=>p.tipo==='eliminatoria'&&p.id===futureFinal);
  assert.equal(future027.elegible,false);assert.equal(future027.a,null);assert.equal(future027.b,null);
  sql(judge+"select public.gestionar_mesa_027(4004,27,'disponible');");
  const tableFinal027=Number(sql('select id from public.mesas_jornada where numero=27'));
  sql(judge+reject(confirm027([{tipo:'eliminatoria',partido:futureFinal,mesa_id:tableFinal027,arbitro_id:ref,inicio:'2026-11-19T15:00:00Z',fin:'2026-11-19T15:20:00Z'}]),'40001'));
`);
const temp=new URL('../../test-results/runner-programacion-027.mjs',import.meta.url);
fs.mkdirSync(new URL('../../test-results/',import.meta.url),{recursive:true});fs.writeFileSync(temp,source);
try{await import(pathToFileURL(fileURLToPath(temp)).href);}finally{fs.unlinkSync(temp);}
