import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as jsx from 'react/jsx-runtime';

function load(file,mocks={}) {
  const mod=new Module(file);
  mod.require=name=>{assert.ok(name in mocks,name);return mocks[name];};
  mod._compile(ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
  return mod.exports;
}
const catalogs=load('../src/lib/catalogos.ts');
function setup(response={data:2,error:null},deny=false) {
  const calls=[];
  const {confirmParticipants}=load('../src/app/panel/juez-general/participantes/actions.ts',{
    '@/lib/catalogos':catalogs,
    '@/lib/auth':{requireRole:async role=>{calls.push(['role',role]);if(deny)throw Error('Sin permiso');}},
    '@/lib/supabase/server':{createClient:async()=>({rpc:async(...args)=>{calls.push(args);return response;}})},
    'next/cache':{revalidatePath:path=>calls.push(['refresh',path])},
  });
  return {run:confirmParticipants,calls};
}
function form(ids,reason='') {
  const data=new FormData();data.set('competencia_id','1');data.set('motivo_retiro',reason);
  for(const id of ids)data.append('jugador_id',id);
  return data;
}
test('nómina exige Juez General antes de procesar datos',async()=>{
  const s=setup(undefined,true);await assert.rejects(s.run({},form(['1'])));assert.deepEqual(s.calls,[['role','juez_general']]);
});
test('solicitud mixta inválida se rechaza íntegramente incluso con motivo de retiro',async()=>{
  for(const invalid of ['0','-1','1.5','abc','9007199254740992',new Blob(['1'])]) {
    const s=setup();assert.ok((await s.run({},form(['1',invalid],'Corrección'))).error);assert.equal(s.calls.length,1);
  }
});
test('duplicados se rechazan sin llamar a PostgreSQL',async()=>{
  const s=setup();assert.ok((await s.run({},form(['1','1']))).error);assert.equal(s.calls.length,1);
});
test('nómina completa se envía a la RPC existente sin datos financieros',async()=>{
  const s=setup();assert.ok((await s.run({},form(['1','2']))).success);
  assert.deepEqual(s.calls[1],['confirmar_participantes_competencia',{p_competencia_id:1,p_jugadores:[1,2],p_fuente:'manual',p_referencia_trazabilidad:'Nómina confirmada desde Panel Juez General',p_motivo_retiro:null}]);
});
test('retiro total exige motivo y rechazo deportivo nunca informa éxito',async()=>{
  const s=setup();assert.ok((await s.run({},form([]))).error);assert.equal(s.calls.length,1);
  assert.ok((await s.run({},form([],'Retiro documentado'))).success);assert.deepEqual(s.calls.find(c=>c[0]==='confirmar_participantes_competencia')[1].p_jugadores,[]);
  const rejected=setup({error:{code:'55000'}});const result=await rejected.run({},form(['1']));assert.ok(result.error);assert.equal(result.success,undefined);
});
test('buscar o corregir conserva toda la selección y envía cada jugador una sola vez',()=>{
  for(const corrections of [false,true]) {
    // Simular búsqueda que oculta al jugador 1 y selección nueva del jugador 3.
    const states=['Visible',[1,2,3],corrections];let index=0;
    const {ParticipantRosterForm}=load('../src/components/participant-roster-form.tsx',{
      react:{...React,useState:()=>[states[index++],()=>{}]},'react/jsx-runtime':jsx,
      '@/app/panel/juez-general/participantes/actions':{confirmParticipants:async()=>({})},
    });
    const players=[{id:1,nombre_completo:'Oculto',confirmado:true},{id:2,nombre_completo:'Visible confirmado',confirmado:true},{id:3,nombre_completo:'Visible nuevo',confirmado:false}].map(p=>({...p,fecha_nacimiento:null,activo:true,habilitado:true,motivo:''}));
    const html=renderToStaticMarkup(React.createElement(ParticipantRosterForm,{competitionId:1,players,selected:[1,2]}));
    const fields=[...html.matchAll(/<input\b[^>]*>/g)].map(m=>m[0]).filter(tag=>/name="jugador_id"/.test(tag));
    assert.equal(fields.length,3);assert.ok(fields.every(tag=>/type="hidden"/.test(tag)&&!tag.includes('disabled')));
    assert.deepEqual(fields.map(tag=>tag.match(/value="(\d+)"/)[1]),['1','2','3']);
    assert.ok(!html.includes('Oculto'));assert.ok(html.includes('Visible nuevo'));
  }
});
