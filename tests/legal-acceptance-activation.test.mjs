import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import Module from 'node:module';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
function load(path,mocks={}) {
  const name=fileURLToPath(new URL(path,import.meta.url)),mod=new Module(name);
  mod.require=key=>{assert.ok(Object.hasOwn(mocks,key),key);return mocks[key];};
  mod._compile(ts.transpileModule(readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,name);return mod.exports;
}
const legal=load('../src/lib/legal.ts');
const redirect=path=>{throw Error(path);};
function acceptancePage(data,error=null) {
  return load('../src/app/aceptar-terminos/page.tsx',{
    'react/jsx-runtime':jsx,'next/link':{default:props=>jsx.jsx('a',props)},'next/navigation':{redirect},
    '@/lib/auth':{getCurrentProfile:async()=>({id:'own'})},
    '@/lib/supabase/server':{createClient:async()=>({rpc:async()=>({data,error})})},
    '@/lib/legal':legal,'./actions':{acceptTerms:'/accept'},'@/app/actions':{logout:'/logout'},
  }).default({searchParams:Promise.resolve({})});
}
test('escenario activado: casilla desmarcada y obligatoria; botón habilitado para versión coincidente',async()=>{
  const html=renderToStaticMarkup(await acceptancePage({version:legal.LEGAL_VERSION,aceptada:false}));
  const checkbox=html.match(/<input[^>]*type="checkbox"[^>]*>/)[0];
  assert.ok(checkbox.includes('required'));assert.ok(!checkbox.includes('checked'));
  assert.match(html,/<button class="btn-primary">Aceptar y continuar/);
  assert.ok(!html.includes('La aceptación no está disponible'));
});
test('versión ya aceptada entra al panel sin nueva aceptación',async()=>{
  await assert.rejects(acceptancePage({version:legal.LEGAL_VERSION,aceptada:true}),{message:'/panel'});
});
test('versión distinta o servicio ausente no redirigen como si existiera aceptación',async()=>{
  for(const [data,error] of [[{version:'otra',aceptada:true},null],[null,{code:'42883'}]]) {
    const html=renderToStaticMarkup(await acceptancePage(data,error));
    assert.match(html,/<button class="btn-primary" disabled="">Aceptar y continuar/);
    assert.ok(html.includes('Reintentar'));
  }
});
test('protección privada contrasta versión y aceptación, sin confiar en metadata',async()=>{
  for(const data of [{version:'otra',aceptada:true},{aceptada:true},{version:legal.LEGAL_VERSION,aceptada:false}]) {
    const client={auth:{getClaims:async()=>({data:{claims:{sub:'own',user_metadata:{aceptada:true,rol:'administrador'}}}})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{id:'own',rol:'jugador',nombre_completo:'Propio'}})})})}),rpc:async()=>({data})};
    const auth=load('../src/lib/auth.ts',{'next/navigation':{redirect},'@/lib/supabase/server':{createClient:async()=>client},'@/lib/config':{supabaseConfigured:()=>true},'@/lib/roles':{isRole:()=>true},'@/lib/legal':legal});
    await assert.rejects(auth.requireProfile(),{message:'/aceptar-terminos'});
  }
});
