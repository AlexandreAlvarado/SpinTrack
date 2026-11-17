import test from 'node:test';
import { standings } from './fixtures/dos-clasificados.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
function load(path, mocks = {}) {
  const filename = new URL(path, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const mod = new Module(filename);
  mod.require = name => { assert.ok(Object.hasOwn(mocks, name), name); return mocks[name]; };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const lib = load('../src/lib/eliminatorias.ts');
for (const count of [1,2,3,4,5,8,12,16,30,31,32,33,40,50,64,100,129,257]) test(`${count} grupos: dos plazas, cuadro mínimo y distribución íntegra`,()=>{
  const groups=standings(count), before=JSON.stringify(groups);
  const input=lib.competitionInput('55',groups), proposal=lib.proposeBracket(input);
  assert.equal(input.participantes.length,count*2);
  assert.equal(JSON.stringify(groups),before); assert.deepEqual(lib.proposeBracket(input),proposal);
  assert.deepEqual(input.clasificaciones.map(g=>g.ids),groups.map(g=>g.filas.slice(0,2).map(r=>String(r.jugador_id))));
  assert.equal(proposal.posiciones,2**Math.ceil(Math.log2(count*2)));
  assert.equal(proposal.confirmable,false);
  if(count===1) {assert.deepEqual(proposal.rondas,[]);assert.match(proposal.advertencias.join(' '),/reencuentro/);return;}
  const initial=proposal.rondas[0], nodes=proposal.rondas.flat();
  assert.equal(nodes.filter(n=>n.tipo==='encuentro').length,count*2-1);
  assert.equal(nodes.filter(n=>n.tipo==='pase').length,proposal.posiciones-count*2);
  const ids=initial.flatMap(n=>n.entradas.map(s=>s.jugador.id));
  assert.equal(new Set(ids).size,count*2);assert.deepEqual([...ids].sort(),input.participantes.map(p=>p.id).sort());
  const ranks=new Map(input.clasificaciones.flatMap(g=>g.ids.map((id,i)=>[id,i+1])));
  const halves=new Map();
  initial.forEach((n,i)=>{
    if(n.tipo==='encuentro') {assert.notEqual(n.entradas[0].jugador.grupo,n.entradas[1].jugador.grupo);assert.notEqual(ranks.get(n.entradas[0].jugador.id),ranks.get(n.entradas[1].jugador.id));}
    n.entradas.forEach(s=>halves.set(s.jugador.id,i<initial.length/2?0:1));
  });
  input.clasificaciones.forEach(g=>assert.notEqual(halves.get(g.ids[0]),halves.get(g.ids[1])));
  const byId=new Map(nodes.map(n=>[n.id,n]));
  for(const node of nodes) {
    assert.equal(node.entradas.length,node.tipo==='pase'?1:2);
    if(node.tipo==='pase') assert.deepEqual(node.salida,node.entradas[0]);
    node.entradas.filter(s=>s.tipo==='ganador').forEach(s=>assert.ok(byId.get(s.cruce)?.ronda<node.ronda));
  }
  const saved=lib.persistableProposal(input,proposal);
  assert.equal(saved.clasificados,count*2);assert.equal(saved.pases_automaticos,proposal.posiciones-count*2);
  assert.equal(saved.clasificaciones.length,count*2);
  assert.deepEqual(saved.clasificaciones.slice(0,2).map(e=>e.posicion),[1,2]);
  assert.equal(saved.rondas.flatMap(r=>r.enfrentamientos).length,count*2-1);
});
test('bloquea segundo empatado, incompletos, snapshots no vigentes, duplicados y datos ajenos',()=>{
  const mutations=[g=>g[0].pendientes=1,g=>g[0].confirmados=2,g=>g[0].total=0,g=>g[0].empate=true,g=>g[0].filas[1].empate=true,g=>g[0].aprobacion.vigente=false,g=>g[0].aprobacion.referencia='',g=>g[0].filas.splice(1),g=>g[0].filas[1].jugador_id=g[0].filas[0].jugador_id,g=>g[1].filas[1].jugador_id=g[0].filas[0].jugador_id,g=>g.push(g[0])];
  for(const mutate of mutations){const g=standings(2);mutate(g);assert.throws(()=>lib.proposeBracket(lib.competitionInput('55',g)));}
  const changes=[i=>i.participantes[0].autorizado=false,i=>i.participantes[0].competencia='otra',i=>i.participantes[0].ranking=1,i=>i.participantes.push(i.participantes[0]),i=>i.clasificaciones[0].ids.pop(),i=>i.clasificaciones[0].ids.push('ajeno'),i=>i.clasificaciones[0].ids[1]=i.clasificaciones[1].ids[1]];
  for(const mutate of changes){const i=lib.simulatedInput(8);mutate(i);assert.throws(()=>lib.proposeBracket(i));}
});
test('simulación sin techo deportivo y nombres de rondas dinámicos',()=>{
  for(const n of [0,1,3,NaN,4.5]) assert.throws(()=>lib.simulatedInput(n));
  assert.equal(lib.proposeBracket(lib.simulatedInput(200)).posiciones,256);
  for(const n of [64,128,256,512,1024])assert.match(lib.roundName(n),new RegExp(String(n)));
  assert.equal(lib.roundName(2),'Final');
  const c=component(), blocked=renderToStaticMarkup(c.BracketView({proposal:lib.proposeBracket(lib.simulatedInput(2))}));
  assert.match(blocked,/No hay rondas disputables|reencuentro/);
});
const component=()=>load('../src/components/knockout-preview.tsx',{'react/jsx-runtime':jsx,'react':{useState:value=>[value,()=>{}],useMemo:factory=>factory(),useActionState:()=>[{},()=>{},false],useEffect:()=>{}},'next/navigation':{useRouter:()=>({refresh:()=>{}})},'@/app/panel/juez-general/clasificacion/eliminatorias-actions':{saveEliminationDraft:()=>{}},'@/lib/eliminatorias':lib});
test('interfaz pagina cuadros grandes y solo monta una ronda',()=>{
  const c=component();const proposal=lib.proposeBracket(lib.simulatedInput(200));
  const html=renderToStaticMarkup(c.BracketView({proposal}));
  assert.match(html,/Ronda de 256/);assert.match(html,/Páginas de ronda/);assert.match(html,/R1-C32/);
  assert.doesNotMatch(html,/>R1-C33<|>R2-C1<|Todas las rondas/);
  assert.equal((html.match(/Pendiente de disputar|Pase automático/g)||[]).length,32);
});
test('vista automática, borrador reemplazable y confirmada histórica sin recalcular',()=>{
  const c=component(), groups=standings(3);
  let html=renderToStaticMarkup(c.KnockoutPreview({groups,competitionId:55}));
  assert.match(html,/Cuadro actual/);assert.match(html,/8 posiciones · 2 pases/);assert.match(html,/<form/);
  html=renderToStaticMarkup(c.KnockoutPreview({groups,competitionId:55,persisted:{id:1,estado:'borrador',posiciones:4,clasificados:3,pases_automaticos:1}}));
  assert.doesNotMatch(html,/laboratorio|A1-H2/);
  html=renderToStaticMarkup(c.KnockoutPreview({groups,competitionId:55,persisted:{id:1,estado:'confirmada',posiciones:4,clasificados:3,pases_automaticos:1}}));
  assert.doesNotMatch(html,/<form/);
  html=renderToStaticMarkup(c.KnockoutPreview({groups:standings(1)}));
  assert.match(html,/Final/);assert.match(html,/Guardar final/);
});
test('un borrador histórico no bloquea Guardar final y solo la llave 019 habilita confirmación',()=>{
  const c=component(), groups=standings(1), historical={id:1,estado:'borrador',posiciones:1,clasificados:1,pases_automaticos:0,propuesta:{version_regla:16}};
  let html=renderToStaticMarkup(c.KnockoutPreview({groups, persisted:historical, historicalDrafts:[historical]}));
  assert.match(html,/Guardar final/); assert.doesNotMatch(html,/Final guardada como propuesta/);
  const proposal={...historical,id:2,posiciones:2,clasificados:2,propuesta:{version_regla:19}};
  html=renderToStaticMarkup(c.KnockoutPreview({groups, currentProposal:proposal, historicalDrafts:[historical]}));
  assert.match(html,/Final guardada como propuesta/); assert.match(html,/Activar final/);
});
test('acciones: solo Juez guarda mediante 017 y confirmación bloqueada sin llamar RPC',async()=>{
  for(const role of ['juez_general','administrador','arbitro','jugador']) {
    const calls=[];
    const actions=load('../src/app/panel/juez-general/clasificacion/eliminatorias-actions.ts',{
      '@/lib/auth':{requireProfile:async()=>({rol:role})},'@/lib/catalogos':{validId:id=>/^\d+$/.test(id)},
      '@/lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:1,error:null};}})},
      'next/cache':{revalidatePath:()=>{}},
    });
    const form=new FormData();form.set('competencia_id','55');form.set('propuesta','{}');form.set('referencia','Acta local');
    assert.ok((await actions.confirmElimination({},form)).error);assert.equal(calls.length,0);
    const result=await actions.saveEliminationDraft({},form);
    if(role==='juez_general'){assert.ok(result.success);assert.equal(calls[0].name,'guardar_propuesta_eliminatoria_017');}
    else {assert.ok(result.error);assert.equal(calls.length,0);}
  }
});
test('acción informa 017 pendiente y snapshot vencido sin anunciar éxito',async()=>{
  for(const code of ['PGRST202','40001','42501','23514']) {
    const actions=load('../src/app/panel/juez-general/clasificacion/eliminatorias-actions.ts',{
      '@/lib/auth':{requireProfile:async()=>({rol:'juez_general'})},'@/lib/catalogos':{validId:()=>true},
      '@/lib/supabase/server':{createClient:async()=>({rpc:async()=>({error:{code}})})},
      'next/cache':{revalidatePath:()=>{throw Error('No debe anunciar éxito');}},
    });
    const form=new FormData();form.set('competencia_id','55');form.set('propuesta','{}');form.set('referencia','Acta');
    const result=await actions.saveEliminationDraft({},form);assert.ok(result.error);assert.equal(result.success,undefined);
    if(code==='PGRST202')assert.match(result.error,/019/);
  }
});
test('límites de representación se informan sin desbordar ni reservar cuadros enormes',()=>{
  assert.equal(lib.minimumBracketSize(200),256);
  assert.equal(lib.minimumBracketSize(2**30),2**30);
  assert.throws(()=>lib.minimumBracketSize(2**30+1),/infraestructura/);
  assert.throws(()=>lib.simulatedInput(2**31),/infraestructura/);
});
test('la vista explica el límite técnico de transporte sin recortar clasificados',()=>{
  const groups=standings(2);groups.forEach(g=>g.snapshot={fixture:'x'.repeat(900000)});
  const html=renderToStaticMarkup(component().KnockoutPreview({groups,competitionId:55}));
  assert.doesNotMatch(html,/Herramientas avanzadas|laboratorio/);
  assert.match(html,/4 posiciones · 0 pases/);
});
