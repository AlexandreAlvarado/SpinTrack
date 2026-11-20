// Solo PostgreSQL temporal y fixtures locales. Nunca lee .env ni usa Supabase.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const url=new URL('./023_habilitacion_arbitraje.test.mjs',import.meta.url);
let source=fs.readFileSync(url,'utf8').replaceAll('import.meta.url',JSON.stringify(url.href));
function before(marker,code){assert.equal(source.split(marker).length,2,marker);source=source.replace(marker,code+'\n'+marker);}
before('  const session = suffix =>',String.raw`
  sql(file('supabase/migrations/025_lectura_torneos_publicos.sql'));
  sql(file('supabase/migrations/026_ranking_oficial_2026.sql'));
  sql(file('supabase/migrations/027_mesas_programacion.sql'));
`);
before("  check(`(select arbitraje_habilitado",String.raw`
  const baseline12=()=>sql("select jsonb_build_array((select jsonb_agg(to_jsonb(p) order by id) from public.partidos p),(select jsonb_agg(to_jsonb(r) order by id) from public.resultados_partidos r),(select jsonb_agg(to_jsonb(e) order by id) from public.resultados_partidos_eventos e),(select jsonb_agg(to_jsonb(a) order by partido_id) from public.partidos_arbitros a))");
  const previous12=baseline12();
  const profiles12=[1,2,4,5].map(n=>'e0040000-0000-0000-0000-00000000000'+n);
  const setup12="reset role;alter sequence public.mesas_jornada_id_seq restart with 1;alter sequence public.partidos_id_seq restart with 100000;alter table public.competencia_control_deportivo disable trigger user;update public.competencia_control_deportivo set inicio_programado='2026-11-19T14:00Z' where competencia_id in(4004,4005);alter table public.competencia_control_deportivo enable trigger user;"+
    "insert into public.jugadores(id,nombre_completo,fecha_nacimiento) overriding system value select id,'Fixture 12 mesas '||id,date '2000-01-01' from generate_series(4009,4012) id;"+admin+
    "update public.jugadores set perfil_id=null where perfil_id='e0040000-0000-0000-0000-000000000004';"+
    profiles12.filter(p=>!p.endsWith('5')).map(p=>"select public.habilitar_arbitraje_023('"+p+"',true,false);").join('')+judge+
    "insert into public.habilitaciones_jugador_categoria(jugador_id,categoria_temporada_id,estado,motivo,referencia_evidencia) select id,4005,'habilitado','Fixture local','Fixture local' from generate_series(4009,4012) id;"+
    "select public.confirmar_participantes_competencia(4005,array[4005,4006,4007,4008,4009,4010,4011,4012],'manual','Fixture local');"+
    "select public.guardar_grupos_competencia(4005,'[{\"numero\":1,\"jugador_ids\":[4005,4006,4007,4008]},{\"numero\":2,\"jugador_ids\":[4009,4010,4011,4012]}]','Fixture local');select public.confirmar_grupos_competencia(4005,'Fixture local');select public.generar_partidos_grupos(4005,true,'Fixture local');select public.confirmar_partidos_grupos(4005,(select id from public.lotes_partidos_grupos where competencia_id=4005),'Fixture local');"+
    Array.from({length:12},(_,i)=>"select public.gestionar_mesa_027(4004,"+(i+1)+",'disponible');").join('')+legacy+
    "select public.capturar_resultado_partido((select min(id) from public.partidos where competencia_id=4004),0,'ordinario','[{\"a\":11,\"b\":5},{\"a\":11,\"b\":5}]','Fixture ocupado','Fixture',true);"+judge;
  const snapshot12=JSON.parse(sql('begin;'+setup12+"select public.consultar_programacion_027(4004);rollback;").split(/\r?\n/).at(-1));
  assert.equal(snapshot12.mesas.length,12);assert.ok(snapshot12.mesas.every(t=>t.estado==='disponible'));
  assert.equal(new Set(snapshot12.partidos.filter(m=>m.elegible).map(m=>m.competencia_id)).size,2);
  const scheduler12=new Module(path.join(root,'src/lib/programacion.ts'));
  scheduler12._compile(ts.transpileModule(file('src/lib/programacion.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,path.join(root,'src/lib/programacion.ts'));
  const proposed12=scheduler12.exports.proposeSchedule(snapshot12,'2026-11-19T15:00:00Z',20,0,profiles12);
  assert.equal(proposed12.proposal.length,3,'Tres cruces posibles con personas y árbitros disponibles');
  assert.equal(new Set(proposed12.proposal.map(p=>p.mesa_id)).size,3);
  assert.ok(proposed12.proposal.every(p=>p.arbitro_id!==profiles12[3]),'Árbitro de encuentro en revisión no se reutiliza');
  const playing12=proposed12.proposal.map(p=>snapshot12.partidos.find(m=>m.tipo===p.tipo&&m.id===p.partido));
  assert.equal(new Set(playing12.map(m=>m.competencia_id)).size,2);
  assert.equal(new Set(playing12.flatMap(m=>[m.a,m.b])).size,6,'Jugador compartido no disputa dos cruces simultáneos');
  const payload12=JSON.stringify(proposed12.proposal).replaceAll("'","''");
  const after12=JSON.parse(sql('begin;'+setup12+"select public.confirmar_programacion_027(4004,'"+payload12+"',0,'Propuesta automática local de 12 mesas');"+
    "select public.check004((select count(*)=3 from public.programacion_reservas where estado='asignada'),'Propuesta automática confirmada');"+
    "select public.confirmar_programacion_027(4004,(select jsonb_build_array(jsonb_build_object('tipo','grupo','partido',grupo_partido_id,'mesa_id',12,'arbitro_id',arbitro_id,'inicio','2026-11-19T16:00:00Z','fin','2026-11-19T16:20:00Z','reserva_id',id,'version',version)) from public.programacion_reservas where estado='asignada' order by id limit 1),0,'Reprogramación local');"+
    "select public.check004((select count(*)=1 from public.programacion_reservas where mesa_id=12 and estado='asignada'),'Reprogramación a mesa 12');reset role;"+
    "do $case$ declare r record; result_id bigint; begin for r in select * from public.programacion_reservas where estado='asignada' order by id loop perform set_config('request.jwt.claims',jsonb_build_object('sub',r.arbitro_id)::text,true);result_id:=public.capturar_resultado_partido(r.grupo_partido_id,0,'ordinario','[{\"a\":11,\"b\":5},{\"a\":11,\"b\":5}]','Fixture local','Fixture',true);perform public.check004((select estado='revision' from public.programacion_reservas where id=r.id),'Envío retiene mesa');perform set_config('request.jwt.claims','{\"sub\":\"e0040000-0000-0000-0000-000000000002\"}',true);perform public.confirmar_resultado_partido(r.grupo_partido_id,result_id,1,'Confirmación local');end loop;end $case$;"+judge+
    "select public.check004((select count(*)=0 from public.programacion_reservas where estado not in('cancelada','liberada')),'Confirmaciones deportivas liberan todas las mesas');select public.check004((select count(*)=3 from public.programacion_reservas where estado='liberada'),'Tres encuentros confirmados');select public.consultar_programacion_027(4004);rollback;").split(/\r?\n/).at(-1));
  const nextInstant12=new Date(Math.max(...after12.reservas.filter(r=>r.estado==='liberada').map(r=>Date.parse(r.liberado_en)))+1).toISOString();
  const following12=scheduler12.exports.proposeSchedule(after12,nextInstant12,20,0,profiles12);
  assert.ok(following12.proposal.length>0,'Hay una siguiente propuesta después de confirmar resultados y liberar recursos');
  assert.ok(following12.proposal.every(p=>!proposed12.proposal.some(old=>old.tipo===p.tipo&&old.partido===p.partido)),'No se reprograman resultados ya confirmados');
  assert.equal(baseline12(),previous12,'El escenario aislado conserva todos los registros anteriores');
  console.log('12 mesas: propuesta real de dos competencias, jugadores compartidos, árbitro ocupado, confirmación atómica, reprogramación, liberación deportiva y siguiente propuesta: OK; fixtures revertidas');
`);
const temp=new URL('../../test-results/runner-12-mesas.mjs',import.meta.url);
fs.mkdirSync(new URL('../../test-results/',import.meta.url),{recursive:true});fs.writeFileSync(temp,source);
try{await import(pathToFileURL(fileURLToPath(temp)).href);}finally{fs.unlinkSync(temp);}
