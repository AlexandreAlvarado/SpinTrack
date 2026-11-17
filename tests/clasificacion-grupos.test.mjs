import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
function load(path,mocks={}) {
  const filename=fileURLToPath(new URL(path,import.meta.url)),mod=new Module(filename);
  mod.require=name=>{assert.ok(Object.hasOwn(mocks,name),name);return mocks[name];};
  mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
  return mod.exports;
}
const lib=load('../src/lib/clasificacion.ts');
const catalogs=load('../src/lib/catalogos.ts');
test('nombres visibles conservan identidad y distinguen nombres pendientes sin correos',()=>{
  assert.equal(lib.refereeLabel(' Ana  Soto ','12345678-abcd'),'Ana Soto · 12345678');
  assert.equal(lib.refereeLabel('Usuario','12345678-abcd'),'Árbitro · nombre pendiente · 12345678');
});
function actionHarness(role='juez_general',error=null) {
  const calls=[],invalidated=[];
  const actions=load('../src/app/panel/juez-general/clasificacion/actions.ts',{
    '@/lib/auth':{requireProfile:async()=>({rol:role})},'@/lib/catalogos':catalogs,
    '@/lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:1,error};}})},
    'next/cache':{revalidatePath:p=>invalidated.push(p)},
  });
  return {calls,invalidated,run:values=>{const f=new FormData();for(const [k,v] of Object.entries(values))f.set(k,v);return actions.approveStanding({},f);}};
}
const approval={grupo_id:'1',snapshot:'{"grupo_id":1}',referencia:'Resolución documentada',criterio_validado:'on',datos_reales:'on'};
test('aprobación exige rol, datos reales y respaldo; no acepta clasificación del cliente como autoridad',async()=>{
  for(const role of ['administrador','arbitro','jugador']){const h=actionHarness(role);assert.ok((await h.run(approval)).error);assert.equal(h.calls.length,0);}
  for(const change of [{grupo_id:'0'},{snapshot:'{'},{referencia:''},{criterio_validado:''},{datos_reales:''}]){const h=actionHarness();assert.ok((await h.run({...approval,...change})).error);assert.equal(h.calls.length,0);}
  const h=actionHarness();assert.ok((await h.run(approval)).success);assert.equal(h.calls[0].name,'aprobar_clasificacion_grupo');assert.deepEqual(h.calls[0].args.p_snapshot,{grupo_id:1});assert.equal(h.invalidated.length,1);
  for(const code of ['40001','42501','55000','PGRST202']){const h=actionHarness('juez_general',{code});assert.ok((await h.run(approval)).error);assert.equal(h.invalidated.length,0);}
});
const group={grupo_id:1,numero:1,total:6,confirmados:6,pendientes:0,empate:true,aprobable:false,snapshot:{},aprobacion:null,filas:[{jugador_id:1,nombre_completo:'Jugador sintético',pj:3,pg:2,pp:1,sf:4,sc:2,pf:50,pc:40,empate:true}]};
function html(value) {
  const component=load('../src/components/group-standings.tsx',{
    'react/jsx-runtime':jsx,'react':{useActionState:()=>[{},()=>{},false],useEffect:()=>{}},
    'next/navigation':{useRouter:()=>({refresh:()=>{}})},
    '@/app/panel/juez-general/clasificacion/actions':{approveStanding:()=>{}},
  });return renderToStaticMarkup(component.GroupStandings({group:value}));
}
test('tabla compacta marca empates y no permite aprobar ni asigna plazas',()=>{
  const text=html(group);assert.match(text,/Empate pendiente/);assert.match(text,/overflow-x-auto/);assert.match(text,/scope="col"/);assert.match(text,/PF\/PC: tantos/);assert.doesNotMatch(text,/Aprobar clasificación interna|name="criterio_validado"/);
});

test('un grupo abre detalle automáticamente; varios conservan resumen sin ejecutar acciones',()=>{
  const component=load('../src/components/group-standings.tsx',{
    'react/jsx-runtime':jsx,'react':{useState:value=>[value,()=>{}],useActionState:()=>[{},()=>{},false],useEffect:()=>{}},
    'next/navigation':{useRouter:()=>({refresh:()=>{throw Error('Selección no debe recargar ni escribir');}})},
    '@/app/panel/juez-general/clasificacion/actions':{approveStanding:()=>{throw Error('Sin escritura al seleccionar');}},
  });
  const single=renderToStaticMarkup(component.GroupStandingsCollection({groups:[group]}));
  assert.match(single,/Jugador sintético/);assert.match(single,/<option value="1" selected="">/);
  const multiple=renderToStaticMarkup(component.GroupStandingsCollection({groups:[group,{...group,grupo_id:2,numero:2}]}));
  assert.doesNotMatch(multiple,/Jugador sintético/);assert.match(multiple,/Selecciona un grupo/);
});
test('aprobación muestra declaración explícita y auditoría desactualizada sin posiciones definitivas',()=>{
  const ready={...group,empate:false,aprobable:true,filas:group.filas.map(r=>({...r,empate:false}))};
  assert.match(html(ready),/name="datos_reales"/);assert.match(html(ready),/Por validar/);
  const old=html({...ready,aprobable:false,aprobacion:{id:1,vigente:false,actor_id:'juez',ocurrido_en:'2026-11-15',referencia:'Respaldo'}});
  assert.match(old,/desactualizada/);assert.match(old,/Por validar/);assert.doesNotMatch(old,/Aprobar clasificación interna/);
  const approved=html({...ready,aprobacion:{id:1,vigente:true,actor_id:'juez',ocurrido_en:'2026-11-15',referencia:'Respaldo'}});
  assert.match(approved,/Aprobación vigente/);assert.doesNotMatch(approved,/Por validar|Aprobar clasificación interna/);
});

async function pageHarness(fail=false,denied=false) {
  const calls=[],tables={temporadas:[{id:1}],fechas:[{id:2}],competencias:[{id:3}],categorias_temporada:[],categorias:[],niveles:[],grupos_competencia:[{id:1},{id:2}]};
  const db={from(table){const q={select:()=>q,order:()=>q,eq:()=>q,range:async()=>({data:tables[table],error:null})};return q;},rpc:async(name,args)=>{calls.push({name,args});return fail&&args.p_grupo_id===2 ? {error:{code:'PGRST202',message:'Fixture'}} : {data:group};}};
  const page=load('../src/app/panel/juez-general/clasificacion/page.tsx',{
    'react/jsx-runtime':jsx,'@/components/dashboard-shell':{DashboardShell:({children})=>children},
    '@/components/judge-navigation':{JudgeNavigation:()=>null},'@/components/judge-context-selector':{JudgeContextSelector:()=>null},
    '@/components/knockout-operations':{KnockoutOperations:()=>null},
    '@/components/knockout-preview':{KnockoutPreview:()=>jsx.jsx('div',{children:'Laboratorio simulado'})},
    '@/components/group-standings':{GroupStandings:()=>jsx.jsx('div',{children:'Tabla calculada'}),GroupStandingsCollection:()=>jsx.jsx('div',{children:'Tabla calculada'}),StandingsRefresh:()=>null},
    '@/lib/auth':{requireRole:async role=>{assert.equal(role,'juez_general');if(denied)throw Error('denied');return {rol:role,nombre:'Juez'};}},
    '@/lib/supabase/server':{createClient:async()=>db},'@/lib/competencias':{COMPETITION_COLUMNS:'id'},
  });
  return {html:renderToStaticMarkup(await page.default({searchParams:Promise.resolve({temporada:'1',fecha:'2',competencia:'3'})})),calls};
}
test('página consulta RPC autenticada y no presenta tablas parciales ante error',async()=>{
  const ready=await pageHarness();assert.match(ready.html,/Tabla calculada/);assert.equal(ready.calls.length,2);
  assert.ok(ready.calls.every(c=>c.name==='consultar_clasificacion_grupo'));
  const failed=await pageHarness(true);assert.match(failed.html,/015/);assert.match(failed.html,/role="alert"/);assert.doesNotMatch(failed.html,/Tabla calculada/);
  assert.doesNotMatch(failed.html,/Laboratorio simulado/);
  await assert.rejects(()=>pageHarness(false,true),/denied/);
});
