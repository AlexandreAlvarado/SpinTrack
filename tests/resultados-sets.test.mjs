import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Module from 'node:module';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
function load(path,mocks={}) {
  const filename=fileURLToPath(new URL(path,import.meta.url)), mod=new Module(filename);
  mod.require=name=>{assert.ok(Object.hasOwn(mocks,name),name);return mocks[name];};
  mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
  return mod.exports;
}
const rules=load('../src/lib/resultados.ts');
const catalogs=load('../src/lib/catalogos.ts');
const win=[{a:11,b:9},{a:12,b:10}];
test('resultados ordinarios 2Ò¢â�a¬â���0, 2Ò¢â�a¬â���1, 3Ò¢â�a¬â���0, 3Ò¢â�a¬â���2 y ventaja sin tope deportivo',()=>{
  assert.deepEqual(rules.calculateSets(win,3),{a:2,b:0,winner:'a'});
  assert.deepEqual(rules.calculateSets([{a:0,b:11},{a:11,b:0},{a:1001,b:999}],3),{a:2,b:1,winner:'a'});
  assert.deepEqual(rules.calculateSets([...win,{a:11,b:0}],5),{a:3,b:0,winner:'a'});
  assert.deepEqual(rules.calculateSets([{a:0,b:11},{a:11,b:0},{a:10,b:12},{a:11,b:9},{a:13,b:15}],5),{a:2,b:3,winner:'b'});
});
for(const [label,sets,best] of [
  ['vacío',[],3],['incompleto',[win[0]],3],['sin ganador',[win[0],{a:0,b:11}],3],
  ['set extra',[...win,win[0]],3],['exceso',[...win,...win],3],['11Ò¢â�a¬â���10',[{a:11,b:10},win[0]],3],
  ['12Ò¢â�a¬â���9',[{a:12,b:9},win[0]],3],['13Ò¢â�a¬â���10',[{a:13,b:10},win[0]],3],['10Ò¢â�a¬â���8',[{a:10,b:8},win[0]],3],
  ['empate',[{a:11,b:11},win[0]],3],['decimal',[{a:11.5,b:9},win[0]],3],['negativo',[{a:-1,b:11},win[0]],3],
  ['texto',[{a:'11',b:9},win[0]],3],['nulo',[null,win[0]],3],['campo extra',[{...win[0],ganador:1},win[0]],3],
  ['desborde',[{a:2147483648,b:2147483646},win[0]],3],['mejor de inválido',win,7],['cinco incompleto',win,5],
])test(`puntuación rechaza ${label}`,()=>assert.ok(rules.calculateSets(sets,best).error));
test('captura textual conserva cero, no salta sets ni acepta entradas parciales',()=>{
  assert.deepEqual(rules.parseSetInputs([{a:'0',b:'11'},{a:'9',b:'11'},{a:'',b:''}]),[{a:0,b:11},{a:9,b:11}]);
  for(const rows of [[{a:'11',b:''}],[{a:'',b:''},{a:'11',b:'0'}],[{a:'1e1',b:'8'}],[{a:'11.5',b:'9'}]]) assert.ok(rules.parseSetInputs(rows).error);
});
function actionHarness(options={}) {
  const calls=[], invalidated=[];
  const actions=load('../src/app/panel/juez-general/resultados/actions.ts',{
    '@/lib/resultados':rules,'@/lib/catalogos':catalogs,'next/cache':{revalidatePath:p=>invalidated.push(p)},
    '@/lib/auth':{requireProfile:async()=>{if(options.noSession)throw Error('sesión');return {rol:options.role??'arbitro',arbitrajeHabilitado:(options.role??'arbitro')==='arbitro'};}},
    '@/lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:1,error:options.error};}})},
  });
  return {calls,invalidated,run:values=>{const form=new FormData();for(const [k,v]of Object.entries(values))form.set(k,v);return actions.manageResult({},form);}};
}
const capture={operacion:'capturar',partido_id:'2',revision:'0',tipo:'ordinario',a_0:'11',b_0:'9',a_1:'12',b_1:'10',referencia:'Acta',referencia_reglas:'ITTF verificado',reglas_confirmadas:'on'};
const confirm={operacion:'confirmar',partido_id:'2',resultado_id:'3',revision:'1',referencia:'Revisión',revision_confirmada:'on'};
test('acción envía puntos y revisión; ignora ganador, formato y autor falsificados',async()=>{
  const h=actionHarness();assert.ok((await h.run({...capture,ganador_id:'999',mejor_de:'1',autor_id:'otro'})).success);
  assert.deepEqual(h.calls,[{name:'capturar_resultado_partido',args:{p_partido_id:2,p_revision_esperada:0,p_tipo:'ordinario',p_sets:win,p_referencia:'Acta',p_referencia_reglas:'ITTF verificado',p_reglas_confirmadas:true,p_descripcion:'',p_motivo:null}}]);
  assert.deepEqual(h.invalidated,['/panel/juez-general/resultados','/panel/juez-general/partidos','/panel/juez-general','/panel/juez-general/clasificacion']);
});
test('validación es operación explícita distinta de captura',async()=>{
  const h=actionHarness({role:'juez_general'});assert.ok((await h.run({...confirm,revision_confirmada:''})).error);assert.equal(h.calls.length,0);
  assert.ok((await h.run(confirm)).success);assert.equal(h.calls[0].name,'confirmar_resultado_partido');assert.equal(h.calls[0].args.p_resultado_id,3);
});
test('servidor exige sesión, rol, referencias, corrección motivada y datos completos',async()=>{
  await assert.rejects(()=>actionHarness({noSession:true}).run(capture),/sesión/);
  for(const role of ['administrador','jugador']){const h=actionHarness({role});assert.ok((await h.run(capture)).error);assert.equal(h.calls.length,0);}
  for(const change of [{reglas_confirmadas:''},{referencia_reglas:''},{referencia:'x'.repeat(1001)},{revision:'-1'},{revision:'2147483648'},{partido_id:'0'},{tipo:'bye'},{operacion:'borrar'},{b_0:''},{descripcion:'x'.repeat(2001)}]){
    const h=actionHarness();assert.ok((await h.run({...capture,...change})).error,JSON.stringify(change));assert.equal(h.calls.length,0);
  }
  const h=actionHarness();assert.ok((await h.run({...capture,revision:'1',motivo:'Transcripción corregida'})).success);
});
test('Árbitro no confirma ni corrige; captura depende de autorización PostgreSQL',async()=>{
  const h=actionHarness({role:'arbitro',error:{code:'42501',message:'Sin asignación'}});
  assert.ok((await h.run(confirm)).error);assert.equal(h.calls.length,0);
  assert.ok((await h.run({...capture,revision:'1',motivo:'Corrección'})).error);assert.equal(h.calls.length,1);
  assert.match((await h.run(capture)).error,/asignación/);assert.equal(h.calls.length,2);assert.equal(h.invalidated.length,0);
});
for(const kind of ['incomparecencia','retiro','suspension'])test(`${kind} se envía como incidencia sin ganador ni sets sintéticos`,async()=>{
  const h=actionHarness();const form={...capture,tipo:kind,a_0:'',b_0:'',a_1:'',b_1:'',descripcion:'Acta de incidencia'};
  assert.ok((await h.run(form)).success);assert.deepEqual(h.calls[0].args.p_sets,[]);
  assert.ok((await h.run({...form,descripcion:''})).error);assert.ok((await h.run({...form,a_0:'11',b_0:'0'})).error);
});
for(const code of ['40001','23514','55000','42P01','42883','PGRST202','PGRST205'])test(`rechazo ${code} no anuncia éxito`,async()=>{
  const h=actionHarness({error:{code,message:'Prueba local'}});const result=await h.run(capture);assert.ok(result.error);assert.equal(result.success,undefined);assert.equal(h.invalidated.length,0);
});
const match={id:2,grupo_id:4,jugador_a_id:10,jugador_b_id:20};
const saved={id:3,partido_id:2,revision:1,tipo:'ordinario',sets:win,sets_a:2,sets_b:0,ganador_id:10,creado_en:'2026-11-14T14:00:00Z',autor_id:'autor-prueba',referencia:'Acta local',referencia_reglas:'ITTF',motivo_correccion:null};
function componentHarness({results=[],events=[],bestOf=3,state={},mode="judge"}={}) {
  const values=[];let cursor=0,requests=0;
  const component=load('../src/components/match-results.tsx',{
    'react/jsx-runtime':jsx,'react':{...React,useActionState:()=>[state,()=>{requests++;},false],useEffect:()=>{},useState:initial=>{const i=cursor++;if(!(i in values))values[i]=initial;return [values[i],value=>{values[i]=typeof value==='function'?value(values[i]):value;}];}},
    'next/navigation':{useRouter:()=>({refresh(){}})},'@/lib/resultados':rules,
    '@/app/panel/juez-general/resultados/actions':{manageResult:()=>assert.fail('render no escribe')},
  });
  function resolve(node){if(Array.isArray(node))return node.map((child,i)=>{const resolved=resolve(child);return React.isValidElement(resolved)?React.cloneElement(resolved,{key:child?.key??i}):resolved;});if(!React.isValidElement(node))return node;if(typeof node.type==='function')return resolve(node.type(node.props));return React.cloneElement(node,{},resolve(node.props.children));}
  const render=()=>{cursor=0;return resolve(component.MatchResults({matches:[match],groups:[{id:4,numero:1}],players:[{id:10,nombre_completo:'Participante A'},{id:20,nombre_completo:'Participante B'}],bestOf,results,events,mode}));};
  const walk=(tree,predicate)=>{const found=[];function visit(n){if(Array.isArray(n))return n.forEach(visit);if(!React.isValidElement(n))return;if(predicate(n))found.push(n);visit(n.props.children);}visit(tree);return found;};
  return {render,walk,html:()=>renderToStaticMarkup(render()),requests:()=>requests};
}
test('interfaz vacía es responsiva, accesible y nunca escribe al abrir',()=>{
  const h=componentHarness();const html=h.html();assert.match(html,/Pendiente/);assert.doesNotMatch(html,/Set 3/);assert.doesNotMatch(html,/Set 4/);assert.match(html,/grid-cols-2/);assert.doesNotMatch(html,/aria-label="Set 1, Participante A"/);assert.doesNotMatch(html,/Enviar resultado al Juez General/);assert.doesNotMatch(html,/Confirmar resultado deportivo/);assert.equal(h.requests(),0);
});
test('interacción de puntos calcula vista previa, bloquea inválidos y sets extra',()=>{
  const h=componentHarness({mode:'referee'});const set=(name,value)=>{const input=h.walk(h.render(),n=>n.type==='input'&&n.props.name===name)[0];input.props.onChange({target:{value}});};
  for(const [key,value]of Object.entries({a_0:'11',b_0:'9',a_1:'12',b_1:'10'}))set(key,value);
  assert.match(h.html(),/Marcador: 2\u20130/);
  assert.equal(h.walk(h.render(),n=>n.type==='button'&&n.props.children==='Enviar resultado al Juez General')[0].props.disabled,false);
  set('a_2','11');set('b_2','0');assert.match(h.html(),/después de definir/);
  assert.equal(h.walk(h.render(),n=>n.type==='button'&&n.props.children==='Enviar resultado al Juez General')[0].props.disabled,true);
});
test('enviado permite revisar sin reingresar sets; confirmado conserva lectura',()=>{
  const pending=componentHarness({results:[saved]});assert.match(pending.html(),/Enviado al Juez General/);assert.match(pending.html(),/Confirmar resultado/);assert.doesNotMatch(pending.html(),/name="a_0"/);
  const h=componentHarness({results:[saved],events:[{id:1,resultado_id:3,actor_id:'juez-local',ocurrido_en:saved.creado_en,referencia:'Revision'}]});
  assert.match(h.html(),/Confirmado/);assert.doesNotMatch(h.html(),/Confirmar resultado<|name="a_0"/);
});
test('incidencia oculta entradas de sets y jamás ofrece confirmación',()=>{
  const h=componentHarness({mode:'referee'});h.walk(h.render(),n=>n.type==='select')[0].props.onChange({target:{value:'retiro'}});
  assert.match(h.html(),/no asigna ganador/);assert.doesNotMatch(h.html(),/name="a_0"|Confirmar resultado deportivo/);
  const savedIncident=componentHarness({results:[{...saved,tipo:'retiro',sets:[],sets_a:null,sets_b:null,ganador_id:null,descripcion:'Detalle'}]});
  assert.match(savedIncident.html(),/Sin ganador asignado/);assert.doesNotMatch(savedIncident.html(),/Confirmar resultado deportivo/);
});
test('corrección pendiente conserva advertencia de resultado vigente e historial',()=>{
  const h=componentHarness({results:[saved,{...saved,id:4,revision:2,motivo_correccion:'Transcripción'}],events:[{id:1,resultado_id:3,actor_id:'juez-local',ocurrido_en:saved.creado_en,referencia:'Validación'}]});
  assert.match(h.html(),/Sigue vigente la revisión confirmada 1/);assert.match(h.html(),/Historial y responsables/);assert.match(h.html(),/Transcripción/);
});
async function pageHarness(options={}) {
  const reads=[],props=[];
  const rows={perfiles:[],competencia_control_deportivo:[],temporadas:[{id:1}],fechas:[{id:8,temporada_id:1}],competencias:[{id:2,temporada_id:1,fecha_id:8}],categorias_temporada:[],categorias:[],niveles:[],participantes_competencia:[],jugadores:[],grupos_competencia:[{id:4,competencia_id:2,numero:1,estado:'confirmado'}],lotes_partidos_grupos:[{id:5,competencia_id:2,estado:options.draft?'borrador':'confirmado',mejor_de:3}],partidos:[{...match,lote_id:5,competencia_id:2}],resultados_partidos:[],resultados_partidos_eventos:[],partidos_arbitros:[],partidos_arbitros_historial:[],partidos_grupos_historial:[],resultados_partidos_observaciones:[]};
  const db={rpc:()=>assert.fail('Página no escribe'),from(table){const filters=[];const q={select(){return q;},order(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},in(k,ids){filters.push(r=>ids.includes(r[k]));return q;},async range(a,b){reads.push(table);return {data:rows[table].filter(r=>filters.every(f=>f(r))).slice(a,b+1),error:options.fail===table?{code:'42P01',message:'Fixture local'}:null};}};return q;}};
  const page=load('../src/app/panel/juez-general/resultados/page.tsx',{
    '@/lib/clasificacion':load('../src/lib/clasificacion.ts'),
    '@/components/group-matches':{GroupMatches:()=>jsx.jsx('div',{children:'Revisión del lote'})},
    '@/lib/gestion-partidos':{matchSummary:()=>({})},
    '@/components/match-management':{MatchCounts:()=>null,MatchManagement:p=>{props.push(p);return jsx.jsx('div',{children:'Interfaz de resultados'});}},
    'react/jsx-runtime':jsx,'@/components/match-results':{MatchResults:p=>{props.push(p);return jsx.jsx('div',{children:'Interfaz de resultados'});}}, '@/components/referee-assignment':{RefereeAssignment:()=>null},
    '@/components/dashboard-shell':{DashboardShell:({children})=>children},'@/components/judge-navigation':{JudgeNavigation:()=>null},'@/components/judge-context-selector':{JudgeContextSelector:()=>null},
    '@/lib/auth':{requireRole:async role=>{assert.equal(role,'juez_general');if(options.denied)throw Error('denegado');return {rol:role,nombre:'Juez'};}},'@/lib/supabase/server':{createClient:async()=>db},'@/lib/competencias':{COMPETITION_COLUMNS:'id'},
  });
  const html=renderToStaticMarkup(await page.default({searchParams:Promise.resolve(options.query??{temporada:'1',fecha:'8',competencia:'2'})}));return {html,reads,props};
}
test('página carga solo competencia elegida y partidos confirmados sin escribir',async()=>{
  const ready=await pageHarness();assert.equal(ready.props.length,1);assert.equal(ready.props[0].matches.length,1);
  assert.equal((await pageHarness({draft:true})).props.length,0);
  assert.equal((await pageHarness({query:{temporada:'1',fecha:'8'}})).props.length,0);
  await assert.rejects(()=>pageHarness({denied:true}),/denegado/);
});
test('lectura fallida no se convierte en sin resultados ni habilita captura',async()=>{
  for(const table of ['resultados_partidos','resultados_partidos_eventos','resultados_partidos_observaciones','partidos_arbitros','perfiles','partidos']){const result=await pageHarness({fail:table});assert.equal(result.props.length,0);assert.match(result.html,/migración 013/);assert.match(result.html,/lectura desde Supabase falló/);}
});
