import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
function load(path, mocks={}) {
  const name=fileURLToPath(new URL(path,import.meta.url)), mod=new Module(name);
  mod.require=key=>{assert.ok(Object.hasOwn(mocks,key),key);return mocks[key];};
  mod._compile(ts.transpileModule(fs.readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,name);return mod.exports;
}
const legal=load('../src/lib/legal.ts');
const jsxMocks={'react/jsx-runtime':jsx,'next/link':{default:props=>jsx.jsx('a',props)},'@/lib/legal':legal};
for(const path of ['terminos','privacidad']) test('documento vigente '+path,()=>{
  const page=load('../src/app/'+path+'/page.tsx',jsxMocks);
  const html=renderToStaticMarkup(jsx.jsx(page.default,{}));
  for(const text of ['65.260.893-0','Futrono','lrtenisdemesalr@gmail.com','Presidente',legal.LEGAL_VERSION,'menores','max-w-3xl']) assert.ok(html.includes(text),text);
  for(const text of ['Borrador','[COMPLETAR','2026-11-19.2','Pendiente de aprobaci']) assert.ok(!html.includes(text),text);
});
test('version aprobada activa sin habilitar tratamientos personales pendientes',()=>{
  assert.equal(legal.LEGAL_VERSION,'2026-11-19.1');
  assert.equal(legal.LEGAL_REVIEW_PENDING,false);
  assert.equal(legal.PERSONAL_DATA_REVIEW_PENDING,true);
});
test('rechaza version falsificada antes de contactar Supabase',async()=>{
  let connected=false;
  const actions=load('../src/app/actions.ts',{'next/navigation':{redirect:p=>{throw Error(p);}},'next/cache':{},'@/lib/supabase/server':{createClient:async()=>{connected=true;}},'@/lib/auth':{},'@/lib/config':{},'@/lib/auth-flow':{},'@/lib/legal':legal});
  const form=new FormData();form.set('acepta_terminos','on');form.set('terminos_version','falsa');
  await assert.rejects(actions.register(form),/error=terminos/);assert.equal(connected,false);
});
test('cuenta existente no puede aceptar sin casilla o con version falsa',async()=>{
  const actions=load('../src/app/aceptar-terminos/actions.ts',{'next/navigation':{redirect:p=>{throw Error(p);}},'next/cache':{},'@/lib/auth':{getCurrentProfile:async()=>({id:'own'})},'@/lib/supabase/server':{},'@/lib/legal':legal});
  for(const fields of [{terminos_version:legal.LEGAL_VERSION},{acepta_terminos:'on',terminos_version:'falsa'}]){
    const form=new FormData();for(const [k,v] of Object.entries(fields))form.set(k,v);
    await assert.rejects(actions.acceptTerms(form),/error=aceptacion/);
  }
});

test('publicación conserva solo metadatos de calendario sin nombres, resultados o fichas',async()=>{
  const lib=load('../src/lib/public-tournaments.ts',{'@/lib/legal':legal,'@/lib/config':{supabaseConfigured:()=>true},'@/lib/supabase/server':{createClient:async()=>({rpc:async()=>({data:{temporadas:[],jornadas:[{id:1}],competencias:[{campeon:'Nombre reservado'}],detalle:{nombre:'Menor reservado'}},error:null})})}});
  const result=await lib.getPublicTournaments(1);
  assert.deepEqual(result.data,{temporadas:[],jornadas:[{id:1}],competencias:[],detalle:null});
  assert.ok(!JSON.stringify(result).includes('reservado'));
});
test('ranking no consulta datos mientras la publicación está suspendida',async()=>{
  const lib=load('../src/lib/ranking-data.ts',{'@/lib/legal':legal,'@/lib/config':{},'@/lib/supabase/server':{},'@/lib/ranking':{}});
  assert.deepEqual(await lib.getSeasonRanking(),{scopes:[],unavailable:true});
});
