import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Module from 'node:module';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
function load(path,mocks={}) {
  const filename=fileURLToPath(new URL(path,import.meta.url)), mod=new Module(filename);
  mod.require=name=>{assert.ok(Object.hasOwn(mocks,name),name);return mocks[name];};
  mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
  return mod.exports;
}
const catalogs=load('../src/lib/catalogos.ts');
function harness(options={}) {
  const calls=[], invalidated=[];
  const actions=load('../src/app/panel/juez-general/partidos/actions.ts',{
    '@/lib/catalogos':catalogs,'next/cache':{revalidatePath:path=>invalidated.push(path)},
    '@/lib/auth':{requireRole:async role=>{assert.equal(role,'juez_general');if(options.denied)throw Error('denegado');}},
    '@/lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:1,error:options.error};}})},
  });
  return {calls,invalidated,run:values=>{const form=new FormData();for(const [k,v]of Object.entries(values))form.set(k,v);return actions.manageMatches({},form);}};
}
const generation={competencia_id:'2',operacion:'generar',referencia:'Resolución Liga',formato_confirmado:'on'};
test('generar exige respaldo explícito y nunca usa pares enviados por cliente',async()=>{
  const h=harness();assert.ok((await h.run({...generation,formato_confirmado:''})).error);assert.equal(h.calls.length,0);
  assert.ok((await h.run({...generation,referencia:' '})).error);assert.equal(h.calls.length,0);
  assert.ok((await h.run({...generation,partidos:'pares falsificados'})).success);
  assert.deepEqual(h.calls,[{name:'generar_partidos_grupos',args:{p_competencia_id:2,p_formato_confirmado:true,p_referencia:'Resolución Liga'}}]);
});
test('confirmar exige lote revisado y revisión expresa',async()=>{
  const h=harness();const confirm={competencia_id:'2',operacion:'confirmar',lote_id:'9',referencia:'Revisión'};
  assert.ok((await h.run(confirm)).error);assert.equal(h.calls.length,0);
  assert.ok((await h.run({...confirm,revision_confirmada:'on'})).success);
  assert.deepEqual(h.calls[0],{name:'confirmar_partidos_grupos',args:{p_competencia_id:2,p_lote_id:9,p_referencia:'Revisión'}});
  assert.deepEqual(h.invalidated,['/panel/juez-general/partidos','/panel/juez-general','/panel/juez-general/resultados']);
});
test('descartar exige motivo y llama RPC auditable',async()=>{
  const h=harness();const discard={competencia_id:'2',operacion:'descartar',lote_id:'9',referencia:'Acta de revisión',motivo:'Cruces corregidos'};
  assert.ok((await h.run({...discard,motivo:''})).error);assert.equal(h.calls.length,0);
  assert.ok((await h.run(discard)).success);
  assert.deepEqual(h.calls[0],{name:'descartar_partidos_grupos',args:{p_competencia_id:2,p_lote_id:9,p_motivo:'Cruces corregidos',p_referencia:'Acta de revisión'}});
});
test('servidor rechaza rol ajeno antes de consultar y entradas inválidas',async()=>{
  const h=harness({denied:true});await assert.rejects(()=>h.run(generation),/denegado/);assert.equal(h.calls.length,0);
  const valid=harness();for(const change of [{competencia_id:'0'},{operacion:'eliminar'},{referencia:'x'.repeat(1001)}])assert.ok((await valid.run({...generation,...change})).error);
  assert.equal(valid.calls.length,0);
});
for(const code of ['42P01','42883','PGRST202','PGRST205','55000','23514'])test(`rechazo ${code} no anuncia éxito ni invalida`,async()=>{
  const h=harness({error:{code,message:'Fixture'}});const result=await h.run(generation);assert.ok(result.error);assert.equal(result.success,undefined);assert.equal(h.invalidated.length,0);
  if(code.startsWith('PGRST')||code==='42P01'||code==='42883')assert.match(result.error,/011/);
});
function render(lot,ready=true) {
  let submissions=0;
  const component=load('../src/components/group-matches.tsx',{
    'react/jsx-runtime':jsx,'react':{...React,useActionState:()=>[{},()=>{submissions++;},false],useEffect:()=>{}},
    'next/navigation':{useRouter:()=>({refresh(){}})},
    '@/app/panel/juez-general/partidos/actions':{manageMatches:()=>{submissions++;}},
  });
  const html=renderToStaticMarkup(component.GroupMatches({competitionId:2,groups:[{id:1,numero:1,estado:'confirmado'}],players:[{id:1,nombre_completo:'Ana'},{id:2,nombre_completo:'Luz'}],matches:lot?[{id:5,grupo_id:1,jugador_a_id:1,jugador_b_id:2}]:[],lot,ready,history:[]}));
  assert.equal(submissions,0,'renderizar no genera partidos');return html;
}
test('vista sin lote exige formato, grupos pendientes no ofrecen generación',()=>{
  assert.match(render(undefined),/La Liga confirmó/);assert.match(render(undefined),/Generar borrador/);
  assert.doesNotMatch(render(undefined,false),/Generar borrador/);
});
test('borrador muestra cruces, sets y revisión; confirmado queda en lectura',()=>{
  const lot={id:9,estado:'borrador',mejor_de:5,referencia_formato:'Liga'};
  const draft=render(lot);for(const value of ['Ana','Luz','Mejor de 5','Confirmar partidos','revision_confirmada'])assert.ok(draft.includes(value));
  const confirmed=render({...lot,estado:'confirmado'});assert.match(confirmed,/Lote de cruces confirmado/);assert.doesNotMatch(confirmed,/Confirmar partidos|Generar borrador|<form/);
});
async function page(options={}) {
  const reads=[], props=[];
  const rows={temporadas:[{id:1}],fechas:[{id:8,temporada_id:1}],competencias:[{id:2,temporada_id:1,fecha_id:8}],categorias_temporada:[],categorias:[],niveles:[],participantes_competencia:[],grupos_competencia:options.noGroups?[]:[{id:4,competencia_id:2,numero:1,estado:'confirmado'}],lotes_partidos_grupos:[],partidos:[],partidos_grupos_historial:[], resultados_partidos:[], resultados_partidos_eventos:[], resultados_partidos_observaciones:[], partidos_arbitros:[], perfiles:[]};
  const client={rpc:()=>assert.fail('consultar no invoca RPC'),from(table){const filters=[];const q={select(){return q;},order(){return q;},eq(k,v){filters.push([k,v]);return q;},in(){return q;},async range(a,b){reads.push({table,filters});return {data:rows[table].filter(r=>filters.every(([k,v])=>r[k]===v)).slice(a,b+1),error:options.fail===table?{code:'PGRST205',message:'Fixture'}:null};}};return q;}};
  const loadedPage=load('../src/app/panel/juez-general/resultados/page.tsx',{
    'react/jsx-runtime':jsx,'next/link':{default:({href,children})=>jsx.jsx('a',{href,children})},
    '@/components/dashboard-shell':{DashboardShell:({children})=>children},'@/components/judge-navigation':{JudgeNavigation:()=>null},'@/components/judge-context-selector':{JudgeContextSelector:()=>null},
    '@/components/group-matches':{GroupMatches:p=>{props.push(p);return jsx.jsx('div',{children:'Cruces revisables'});}},
    '@/lib/gestion-partidos':load('../src/lib/gestion-partidos.ts'),
    '@/components/match-management':{MatchCounts:()=>null,MatchManagement:()=>null},'@/lib/clasificacion':{refereeLabel:n=>n},
    '@/lib/auth':{requireRole:async()=>{if(options.denied)throw Error('denegado');return {rol:'juez_general',nombre:'Juez'};}},
    '@/lib/supabase/server':{createClient:async()=>client},'@/lib/competencias':{COMPETITION_COLUMNS:'id,temporada_id,fecha_id'},
  });
  const html=renderToStaticMarkup(await loadedPage.default({searchParams:Promise.resolve(options.query??{temporada:'1',fecha:'8',competencia:'2'})}));return {html,reads,props};
}
test('página conserva contexto y solo consulta, sin generar al abrir',async()=>{
  const result=await page();assert.equal(result.props.length,1);assert.equal(result.props[0].ready,true);
  for(const table of ['partidos','lotes_partidos_grupos','partidos_grupos_historial'])assert.deepEqual(result.reads.find(r=>r.table===table).filters,[['competencia_id',2]]);
  assert.equal((await page({query:{temporada:'1',fecha:'8'}})).props.length,0);
});

test('competencia sin grupos no habilita generación; grupos confirmados reutilizan flujo existente', async () => {
  const empty = await page({ noGroups: true });
  assert.equal(empty.props[0].ready, false);
  assert.equal(empty.props[0].groups.length, 0);
  const ready = await page();
  assert.equal(ready.props[0].ready, true);
  assert.equal(ready.props[0].lot, undefined);
  assert.equal(ready.props[0].matches.length, 0);
});
test('migración ausente no presenta vacío como disponibilidad y rol ajeno no accede',async()=>{
  const failed=await page({fail:'lotes_partidos_grupos'});assert.match(failed.html,/migración 013/);assert.equal(failed.props.length,0);
  await assert.rejects(()=>page({denied:true}),/denegado/);
});
