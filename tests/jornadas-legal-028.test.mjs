import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
function load(file,mocks={}) {
  const mod=new Module(file);mod.require=name=>{if(name==="@/lib/legal" && !(name in mocks))return legal;assert.ok(name in mocks,name);return mocks[name];};
  mod._compile(ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);return mod.exports;
}
const legal=load('../src/lib/legal.ts'),catalogs=load('../src/lib/catalogos.ts');
const redirect=path=>{throw Error('redirect:'+path);};
function form(fields) {const f=new FormData();for(const [k,v] of Object.entries(fields))f.set(k,String(v));return f;}
function dates({denied=false,error=null,data=null}={}) {
  const calls=[];
  const {manageDate}=load('../src/app/panel/administrador/jornadas/actions.ts',{
    '@/lib/auth':{requireRole:async role=>{calls.push(['role',role]);if(denied)throw Error('Denegado');}},
    '@/lib/catalogos':catalogs,'next/cache':{revalidatePath:path=>calls.push(['refresh',path])},
    '@/lib/supabase/server':{createClient:async()=>({rpc:async(...args)=>{calls.push(args);return {data,error};}})},
  });return {run:fields=>manageDate({},form({fecha_id:1,...fields})),calls};
}
const token='00000000-0000-4000-8000-000000000001';
test('jornadas: solo Administrador y ningún cambio sin revisión previa',async()=>{
  const denied=dates({denied:true});await assert.rejects(denied.run({operacion:'revisar'}));assert.deepEqual(denied.calls,[['role','administrador']]);
  for(const fields of [{operacion:'eliminar',frase:'ELIMINAR JORNADA 1'},{operacion:'eliminar',token,revisada:'on',frase:'eliminar jornada 1'},{operacion:'archivar',token},{operacion:'desconocida'}]) {
    const s=dates();assert.ok((await s.run(fields)).error);assert.equal(s.calls.filter(c=>!['role','refresh'].includes(c[0])).length,0);
  }
});
test('jornadas: revisión devuelve dependencias sin ejecutar eliminación',async()=>{
  const data={token,protegida:true,dependencias:{partidos:6}};const s=dates({data});assert.deepEqual((await s.run({operacion:'revisar'})).review,data);assert.deepEqual(s.calls[1],['revisar_jornada_028',{p_fecha:1}]);
});
test('jornadas: confirmación usa RPC atómica; conflictos no anuncian éxito',async()=>{
  const fields={operacion:'eliminar',token,revisada:'on',frase:'ELIMINAR JORNADA 1'};
  const s=dates();assert.ok((await s.run(fields)).success);assert.deepEqual(s.calls[1],['gestionar_jornada_028',{p_token:token,p_operacion:'eliminar',p_frase:fields.frase}]);
  for(const code of ['55000','40001','22023']){const fail=dates({error:{code}});const result=await fail.run(fields);assert.ok(result.error);assert.equal(result.success,undefined);assert.equal(fail.calls.length,2);}
});
function registration(signUp) {
  return load('../src/app/actions.ts',{'next/navigation':{redirect},'next/cache':{revalidatePath(){}},'@/lib/auth':{},'@/lib/config':{supabaseConfigured:()=>true},'@/lib/legal':legal,'@/lib/auth-flow':load('../src/lib/auth-flow.ts'),'@/lib/supabase/server':{createClient:async()=>({auth:{signUp}})}});
}
test('registro sin casilla o con versión antigua nunca llama al proveedor',async()=>{
  let calls=0;const a=registration(async()=>{calls++;});
  for(const fields of [{},{acepta_terminos:'on'},{acepta_terminos:'on',terminos_version:'antigua'},{acepta_terminos:'false',terminos_version:legal.LEGAL_VERSION}])await assert.rejects(a.register(form(fields)),/redirect:\/registro\?error=terminos/);
  assert.equal(calls,0);
});
test('usuarios existentes pueden aceptar sin pasar por el bloqueo de panel; fallo permite reintentar',async()=>{
  for(const error of [null,{code:'42883'}]) {
    const calls=[];const a=load('../src/app/aceptar-terminos/actions.ts',{'next/navigation':{redirect},'next/cache':{revalidatePath(){}},'@/lib/auth':{getCurrentProfile:async()=>({id:'own'})},'@/lib/legal':legal,'@/lib/supabase/server':{createClient:async()=>({rpc:async(...args)=>{calls.push(args);return {error};}})}});
    await assert.rejects(a.acceptTerms(form({acepta_terminos:'on',terminos_version:legal.LEGAL_VERSION})),error?/redirect:\/aceptar-terminos\?error=servicio/:/redirect:\/panel/);
    assert.deepEqual(calls,[['aceptar_terminos_028',{p_version:legal.LEGAL_VERSION,p_acepta:true}]]);
  }
});
test('panel requiere aceptación vigente; identidad pública sigue accesible y no entra en bucle',async()=>{
  for(const accepted of [true,false]) {
    let checks=0;const client={auth:{getClaims:async()=>({data:{claims:{sub:'own'}}})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{id:'own',rol:'jugador',nombre_completo:'Local'}})})})}),rpc:async()=>{checks++;return {data:{aceptada:accepted,version:legal.LEGAL_VERSION}};}};
    const auth=load('../src/lib/auth.ts',{'next/navigation':{redirect},'@/lib/supabase/server':{createClient:async()=>client},'@/lib/config':{supabaseConfigured:()=>true},'@/lib/roles':load('../src/lib/roles.ts')});
    assert.equal((await auth.getCurrentIdentity()).authenticated,true);assert.equal(checks,0);
    if(accepted)assert.equal((await auth.requireProfile()).id,'own');else await assert.rejects(auth.requireProfile(),/redirect:\/aceptar-terminos/);
    assert.equal(checks,1);
  }
});
test('registro muestra casilla obligatoria inicialmente desmarcada y enlaces públicos',()=>{
  const {AuthForm}=load('../src/components/auth-form.tsx',{'react/jsx-runtime':jsx,'next/link':{default:props=>jsx.jsx('a',props)},'next/image':{default:()=>null},'@/app/actions':{register:'/register'},'@/app/recovery-actions':{},'@/lib/legal':legal,'@/components/auth-controls':{PasswordField:()=>null,AuthSubmit:({children})=>jsx.jsx('button',{children})}});
  const html=renderToStaticMarkup(React.createElement(AuthForm,{mode:'register'}));
  const checkbox=html.match(/<input[^>]*type="checkbox"[^>]*>/)[0];assert.match(checkbox,/required/);assert.doesNotMatch(checkbox,/checked/);assert.match(html,/href="\/terminos"/);assert.match(html,/href="\/privacidad"/);
});
test('producción requiere origen HTTPS explícito para confirmación y recuperación',()=>{
  const oldNode=process.env.NODE_ENV,oldSite=process.env.NEXT_PUBLIC_SITE_URL;const flow=load('../src/lib/auth-flow.ts');
  try {process.env.NODE_ENV='production';delete process.env.NEXT_PUBLIC_SITE_URL;assert.throws(()=>flow.authOrigin());process.env.NEXT_PUBLIC_SITE_URL='http://localhost:3000';assert.throws(()=>flow.authOrigin());process.env.NEXT_PUBLIC_SITE_URL='https://spintrack.example.org';assert.equal(flow.authOrigin(),'https://spintrack.example.org');}
  finally {if(oldNode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldNode;if(oldSite===undefined)delete process.env.NEXT_PUBLIC_SITE_URL;else process.env.NEXT_PUBLIC_SITE_URL=oldSite;}
});
test('gestión muestra recuentos vacíos y exige segunda pantalla; historial protegido oculta eliminar',()=>{
  for(const protectedDate of [false,true])for(const second of [false,true]) {
    const review={token,protegida:protectedDate,dependencias:{fechas:1},jornada:{id:1,numero:9,fecha:'2026-11-20',estado:'publicada',archivada:false}};
    const {DateManagement}=load('../src/components/date-management.tsx',{'react/jsx-runtime':jsx,react:{useActionState:()=>[{review},'/test',false],useState:()=>[second,()=>{}]},'@/app/panel/administrador/jornadas/actions':{manageDate:()=>{}}});
    const html=renderToStaticMarkup(React.createElement(DateManagement,{id:1}));
    assert.match(html,/Competencias:/);assert.match(html,/Participantes:/);assert.match(html,/Archivar conservando historial/);
    assert.equal(html.includes('name="frase"'),!protectedDate&&second);
    assert.equal(html.includes('Eliminar definitivamente'),!protectedDate&&second);
  }
});
