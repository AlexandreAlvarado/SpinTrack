import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
function load(relative, mocks={}) {
  const file=fileURLToPath(new URL(relative,import.meta.url)), mod=new Module(file);
  mod.require=name=>{assert.ok(Object.hasOwn(mocks,name),name);return mocks[name];};
  mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
  return mod.exports;
}
const results=load('../src/lib/resultados.ts'), catalogs=load('../src/lib/catalogos.ts');
const lib=load('../src/lib/eliminatorias-operacion.ts');
const act={id:9,partido_id:1,revision:1,sets:[{a:11,b:4},{a:11,b:9}],sets_a:2,sets_b:0,ganador_id:10,autor_id:'ref',creado_en:'2026-11-16T12:00:00Z',referencia:'Acta'};
const match={id:1,mejor_de:3,referencia_reglas:'Formato aprobado'};
function harness(role='arbitro',error=null,rows=[]) {
  const calls=[],ranges=[],filters=[],invalidated=[];
  const db={rpc:async(name,args)=>{calls.push({name,args});return {error};},from:table=>{
    const query={select:()=>query,order:()=>query,eq:(key,value)=>{filters.push({table,key,value});return query;},in:()=>query,not:()=>query,
      range:async(a,b)=>{ranges.push({table,a,b});return {data:table==='eliminatorias_partidos'?rows:[],error};},maybeSingle:async()=>({data:null,error})};return query;
  }};
  const actions=load('../src/app/panel/juez-general/clasificacion/operacion-actions.ts',{
    '@/lib/auth':{requireProfile:async()=>({rol:role==='jugador_arbitro'?'jugador':role,id:'ref',arbitrajeHabilitado:role==='arbitro' || role==='jugador_arbitro'})},'@/lib/supabase/server':{createClient:async()=>db},
    'next/cache':{revalidatePath:p=>invalidated.push(p)},'@/lib/catalogos':catalogs,'@/lib/resultados':results,'@/lib/eliminatorias-operacion':lib,
  });
  return {calls,ranges,filters,invalidated,actions,run:values=>{const f=new FormData();Object.entries(values).forEach(([k,v])=>f.set(k,v));return actions.operateKnockout({},f);}};
}
const capture={operacion:'capturar',partido_id:'1',revision:'0',referencia:'Acta',tipo:'ordinario',a_0:'11',b_0:'4',a_1:'11',b_1:'9'};
test('captura eliminatoria reutiliza puntos y no acepta ganador, formato, autor ni respaldo del navegador',async()=>{
  const h=harness();assert.ok((await h.run({...capture,ganador_id:99,mejor_de:5,autor_id:'otro',respaldo:true})).success);
  assert.deepEqual(h.calls[0],{name:'operar_eliminatoria_018',args:{p_partido_id:1,p_operacion:'enviar',p_revision:0,p_referencia:'Acta',p_arbitro_id:null,p_sets:act.sets}});
  assert.ok(h.invalidated.includes('/panel/arbitro/resultados'));
});

test('Jugador con habilitación puede enviar sets, sin confirmar ni asignar',async()=>{
  const h=harness('jugador_arbitro');
  assert.ok((await h.run(capture)).success);
  assert.ok((await h.run({...capture,operacion:'confirmar',revision_confirmada:'on'})).error);
  assert.ok((await h.run({...capture,operacion:'asignar'})).error);
  assert.equal(h.calls.length,1);
});
test('roles separados y revisión oficial explícita',async()=>{
  for(const role of ['jugador','administrador','juez_general']) {const h=harness(role);assert.ok((await h.run(capture)).error);assert.equal(h.calls.length,0);}
  const f={operacion:'confirmar',partido_id:'1',revision:'1',referencia:'Revisión',revision_confirmada:'on'};
  assert.ok((await harness().run(f)).error);
  const h=harness('juez_general');assert.ok((await h.run({...f,revision_confirmada:''})).error);assert.equal(h.calls.length,0);
  assert.ok((await h.run(f)).success);assert.equal(h.calls[0].args.p_operacion,'confirmar');
});
test('observación usa el texto del Juez y no envía sets ni participantes',async()=>{
  const h=harness('juez_general');assert.ok((await h.run({operacion:'observar',partido_id:1,revision:1,observacion:'Revisar set 2'})).success);
  assert.equal(h.calls[0].args.p_referencia,'Revisar set 2');assert.equal(h.calls[0].args.p_sets,null);
});
test('operaciones de infraestructura generan referencia interna automáticamente',async()=>{
  const h=harness('arbitro');
  assert.ok((await h.run({operacion:'comenzar',partido_id:'12',revision:'0'})).success);
  assert.equal(h.calls[0].args.p_referencia,'Inicio de partido 12');
});
test('rechaza incidencias sin regla de resolución, correcciones sin motivo y entradas incompletas',async()=>{
  for(const patch of [{tipo:'retiro'},{revision:'1'},{b_0:''},{revision:'-1'},{partido_id:'0'},{operacion:'eliminar'}]) {
    const h=harness();assert.ok((await h.run({...capture,...patch})).error);assert.equal(h.calls.length,0);
  }
  const h=harness();assert.ok((await h.run({...capture,revision:1,motivo:'Corregir transcripción'})).success);assert.match(h.calls[0].args.p_referencia,/Corregir transcripción/);
});
test('errores PostgreSQL no anuncian avance ni invalidan vistas',async()=>{
  const h=harness('arbitro',{code:'55000',message:'Participantes pendientes'});
  assert.ok((await h.run(capture)).error);assert.deepEqual(h.invalidated,[]);
});
test('preparar y asignar final usa la RPC transaccional sin referencia manual',async()=>{
  const h=harness('juez_general');
  assert.ok((await h.run({operacion:'preparar_asignar',llave_id:'22',arbitro_id:'550e8400-e29b-41d4-a716-446655440000',revision:'0'})).success);
  assert.deepEqual(h.calls[0],{name:'preparar_asignar_final_eliminatoria_020',args:{p_llave_id:22,p_arbitro_id:'550e8400-e29b-41d4-a716-446655440000',p_referencia:'Preparación y asignación de árbitro para llave 22'}});
});
test('la asignación conserva SQLSTATE y muestra un motivo comprensible',async()=>{
  const missing=harness('juez_general',{code:'PGRST202',message:'function preparar_asignar_final_eliminatoria_020 does not exist'});
  assert.match((await missing.run({operacion:'preparar_asignar',llave_id:'22',arbitro_id:'550e8400-e29b-41d4-a716-446655440000',revision:'0'})).error,/migración 020/);
  const conflict=harness('juez_general',{code:'55000',message:'El árbitro ya tiene una asignación operativa incompatible'});
  assert.match((await conflict.run({operacion:'preparar_asignar',llave_id:'22',arbitro_id:'550e8400-e29b-41d4-a716-446655440000',revision:'0'})).error,/asignación incompatible/);
});
test('la operación combinada muestra el selector de árbitro',()=>{
  const source=fs.readFileSync(fileURLToPath(new URL('../src/components/knockout-operations.tsx',import.meta.url)),'utf8');
  assert.match(source,/operation === "asignar" \|\| operation === "preparar_asignar"/);
  assert.match(source,/name="arbitro_id"/);
});
test('consulta Árbitro filtra asignación y pagina en servidor con una fila de anticipación',async()=>{
  const rows=Array.from({length:17},(_,i)=>({id:i+1,jugador_a_id:10,jugador_b_id:11}));
  const h=harness('arbitro',null,rows);const page=await h.actions.loadKnockoutPage(null,1,2);
  assert.equal(page.matches.length,16);assert.equal(page.more,true);assert.deepEqual(h.ranges[0],{table:'eliminatorias_partidos',a:32,b:48});
  assert.ok(h.filters.some(f=>f.key==='arbitro_id'&&f.value==='ref'));
});
test('consulta Juez exige llave y ronda y descarta datos parciales ante error',async()=>{
  const h=harness('juez_general');assert.ok((await h.actions.loadKnockoutPage(null,1,0)).error);
  await h.actions.loadKnockoutPage(42,3,0);
  assert.ok(h.filters.some(f=>f.key==='llave_id'&&f.value===42));assert.ok(h.filters.some(f=>f.key==='ronda_numero'&&f.value===3));
  const failed=await harness('juez_general',{code:'42P01'}).actions.loadKnockoutPage(42,1,0);
  assert.ok(failed.error);assert.deepEqual(failed.matches,[]);
});
const cards=load('../src/components/match-results.tsx',{'react':React,'react/jsx-runtime':jsx,'next/navigation':{useRouter:()=>({refresh(){}})},'@/app/panel/juez-general/resultados/actions':{manageResult:async()=>({})},'@/lib/resultados':results,'@/lib/format':{formatSantiagoShortDateTime:value=>value}});
function card(mode,events=[],observations=[]) {
  return renderToStaticMarkup(jsx.jsx(cards.ResultCard,{match:{id:1,grupo_id:1,jugador_a_id:10,jugador_b_id:11},bestOf:3,results:[lib.knockoutResult(act,match)],events,observations,name:id=>'Jugador '+id,mode,rulesReference:'Formato',actReference:'Acta',knockout:true,resultAction:async()=>({})}));
}
test('resultado pendiente muestra revisión y solo admite corrección después de observación',()=>{
  assert.doesNotMatch(card('referee'),/Confirmar resultado|Corregir y reenviar/);
  assert.match(card('referee',[],[{id:1,resultado_id:9,juez_id:'juez',observacion:'Corregir',creado_en:act.creado_en}]),/Corregir y reenviar/);
  assert.match(card('judge'),/Confirmar resultado/);
});
test('resultado confirmado no ofrece edición ni nueva confirmación en ambos roles',()=>{
  const events=[{id:1,resultado_id:9,actor_id:'juez',ocurrido_en:act.creado_en,referencia:'Oficial'}];
  for(const role of ['judge','referee'])assert.doesNotMatch(card(role,events),/Confirmar resultado|Corregir y reenviar|Enviar resultado al Juez/);
});
