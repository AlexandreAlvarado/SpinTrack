import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

function harness({ denied=false, error=null }={}) {
  const filename=fileURLToPath(new URL('../src/app/panel/administrador/arbitraje/actions.ts',import.meta.url));
  const mod=new Module(filename), calls=[], invalidated=[];
  const mocks={
    '@/lib/auth':{requireRole:async role=>{assert.equal(role,'administrador');if(denied)throw Error('denegado');}},
    '@/lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {error};}})},
    'next/cache':{revalidatePath:(...args)=>invalidated.push(args)},
  };
  mod.require=name=>{assert.ok(Object.hasOwn(mocks,name));return mocks[name];};
  mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
  const run=(expected='false',id='e0040000-0000-0000-0000-000000000003')=>{const form=new FormData();form.set('perfil_id',id);form.set('esperado',expected);form.set('rol','administrador');return mod.exports.setRefereeEnabled({},form);};
  return {run,calls,invalidated};
}

for(const expected of ['true','false']) test(`Administrador cambia habilitación desde ${expected}, con revisión esperada`,async()=>{
  const h=harness(); assert.ok((await h.run(expected)).success);
  assert.deepEqual(h.calls,[{name:'habilitar_arbitraje_023',args:{p_perfil_id:'e0040000-0000-0000-0000-000000000003',p_habilitado:expected!=='true',p_esperado:expected==='true'}}]);
  assert.deepEqual(h.invalidated,[['/panel','layout']]);
});
test('Jugador no puede invocar la acción administrativa ni elegir su propio rol',async()=>{
  const h=harness({denied:true});await assert.rejects(()=>h.run(),/denegado/);assert.equal(h.calls.length,0);
});
test('estado o UUID manipulado no llama RPC',async()=>{
  const h=harness();assert.ok((await h.run('otro')).error);assert.ok((await h.run('false','otra-cuenta')).error);assert.equal(h.calls.length,0);
});
for(const code of ['40001','42501','42703']) test(`rechazo PostgreSQL ${code} no anuncia éxito`,async()=>{
  const h=harness({error:{code}});const response=await h.run();assert.ok(response.error);assert.equal(response.success,undefined);assert.equal(h.invalidated.length,0);
});
