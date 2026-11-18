import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Module from 'node:module';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup as html } from 'react-dom/server';

function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const mod = new Module(filename);
  mod.require = name => { assert.ok(Object.hasOwn(mocks,name),name); return mocks[name]; };
  mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{ compilerOptions: { module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX } }).outputText,filename);
  return mod.exports;
}
const library = load('../src/lib/public-tournaments.ts', { '@/lib/config': { supabaseConfigured: () => false }, '@/lib/supabase/server': {} });
const common = { 'react/jsx-runtime':jsx, 'next/link':{default:({children,...props})=>jsx.jsx('a',{...props,children})}, '@/lib/public-tournaments':library };
const components = load('../src/components/public-tournament.tsx',common);
const match = { numero:1,a:'Deportista A',b:'Deportista B',estado:'pendiente',sets_a:3,sets_b:0,sets:[{a:11,b:0}],ganador:'a' };
const data = { temporadas:[{id:1,nombre:'Temporada real',anio:2026}],jornadas:[{id:2,temporada_id:1,numero:2,fecha:'2026-11-18',recinto:'Recinto',comuna:'Comuna',estado:'publicada'}],competencias:[{id:3,fecha_id:2,nombre:'Categoría',estado:'en_curso',inicio:null,campeon:null,subcampeon:null}],detalle:{grupos:[],rondas:[]} };

test('hora civil de Santiago y jornadas próximas sin incluir finalizadas',()=>{
  assert.equal(library.todayInSantiago(new Date('2026-11-19T01:30:00Z')),'2026-11-18');
  const schedule=library.homeSchedule({...data,jornadas:[...data.jornadas,{...data.jornadas[0],id:4,fecha:'2026-11-19',estado:'finalizada'}]},'2026-11-18');
  assert.equal(schedule.season.id,1);assert.equal(schedule.latest.id,2);assert.equal(schedule.upcoming.length,1);
  assert.equal(library.homeSchedule(data,'2027-01-01').season,null);
});
test('partido sin confirmación nunca revela marcador, sets ni ganador',()=>{
  const markup=html(jsx.jsx(components.PublicMatchCard,{match}));
  assert.match(markup,/Pendiente de resultado/);assert.doesNotMatch(markup,/✓ Ganador|11–0|Sets:|>3<|>0</);
});
test('resultado confirmado identifica ganador y sets',()=>{
  const markup=html(jsx.jsx(components.PublicMatchCard,{match:{...match,estado:'confirmado'}}));
  assert.match(markup,/✓ Ganador/);assert.match(markup,/11–0/);
});
test('final única y cuadro con múltiples rondas sin avance posterior ni tercer lugar',()=>{
  for(const rounds of [[{numero:1,nombre:'Final',partidos:[match]}],[{numero:1,nombre:'Semifinales',partidos:[match,{...match,numero:2}]},{numero:2,nombre:'Final',partidos:[{...match,a:null,origen_a:'R1-C1'}]}]]) {
    const markup=html(jsx.jsx(components.PublicBracket,{rounds}));
    assert.match(markup,/>Final</);assert.doesNotMatch(markup,/avanza a la siguiente|tercer lugar|UUID/);
  }
});
const page = (path,response) => load(path,{...common,'next/navigation':{notFound(){throw new Error('404');}},'@/components/public-live-refresh':{PublicLiveRefresh:()=>null},'@/lib/format':{formatDate:v=>v},'@/components/public-tournament':components,'@/lib/public-tournaments':{...library,getPublicTournaments:async()=>response}}).default;
test('competencia pública sin grupos ni resultados tiene estados vacíos',async()=>{
  const markup=html(await page('../src/app/competencias/[id]/page.tsx',{data,unavailable:false})({params:Promise.resolve({id:'3'})}));
  assert.match(markup,/Los grupos aparecerán/);assert.match(markup,/cuando se confirme la llave/);assert.doesNotMatch(markup,/login|Campeón:/);
});
test('clasificación aprobada y campeón se muestran sin campos internos',async()=>{
  const published={...data,competencias:[{...data.competencias[0],estado:'finalizada',campeon:'Deportista A',subcampeon:'Deportista B'}],detalle:{grupos:[{numero:1,jugadores:['Deportista A','Deportista B'],clasificacion:[{nombre:'Deportista A',pj:3,pg:3,pp:0,sf:6,sc:0}],partidos:[{...match,estado:'confirmado'}]}],rondas:[{numero:1,nombre:'Final',partidos:[{...match,estado:'confirmado'}]}]}};
  const markup=html(await page('../src/app/competencias/[id]/page.tsx',{data:published,unavailable:false})({params:Promise.resolve({id:'3'})}));
  for(const text of ['Campeón: Deportista A','Subcampeón: Deportista B','Clasificación aprobada','Clasificado','overflow-x-auto']) assert.ok(markup.includes(text),text);
  assert.doesNotMatch(markup,/actor_id|referencia|perfil_id|@/);
});
test('URL oculta o inválida devuelve 404, error de lectura no simula jornada vacía',async()=>{
  const render=page('../src/app/competencias/[id]/page.tsx',{data,unavailable:false});
  for(const id of ['999','0','abc','9007199254740992']) await assert.rejects(()=>render({params:Promise.resolve({id})}),/404/);
  const markup=html(await page('../src/app/calendario/[id]/page.tsx',{data:{...data,jornadas:[]},unavailable:true})({params:Promise.resolve({id:'2'})}));
  assert.match(markup,/No pudimos cargar/);assert.doesNotMatch(markup,/Todavía no hay/);
});
test('RPC usa cliente normal, sin sesión obligatoria; error conserva estado no disponible',async()=>{
  const calls=[];
  const lib=load('../src/lib/public-tournaments.ts',{'@/lib/config':{supabaseConfigured:()=>true},'@/lib/supabase/server':{createClient:async()=>({rpc:async(...args)=>{calls.push(args);return {data:null,error:{code:'42883'}};}})}});
  assert.equal((await lib.getPublicTournaments(3)).unavailable,true);
  assert.deepEqual(calls,[['consultar_torneos_publicos_025',{p_competencia_id:3}]]);
});
