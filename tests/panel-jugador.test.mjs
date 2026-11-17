import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
function load(path, mocks={}) {
 const filename=new URL(path,import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
 const mod=new Module(filename); mod.require=name=>{if(name==='@/components/player-registration-form') return {PlayerRegistrationForm:()=>null}; assert.ok(Object.hasOwn(mocks,name),name);return mocks[name];};
 mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);return mod.exports;
}
const domain=load('../src/lib/panel-jugador.ts',{'./jugadores':{PLAYER_COLUMNS:'id,perfil_id,nombre_completo,activo,club_id,localidad_procedencia_id'}});
function db(options={}) {
 const calls=[];
 const rows={jugadores:[{id:2,perfil_id:'own',nombre_completo:'Titular',activo:true,club_id:null,localidad_procedencia_id:null}],fechas:[],inscripciones:[],...options.rows};
 return {calls,rpc:async()=>({data:options.rpcData??[],error:options.error?{code:'42501'}:null}),from(table){const filters=[];let start=0,end=499;
 const q={select(columns){assert.ok(!columns.includes('*'));calls.push({table,columns,filters});return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},range(a,b){start=a;end=b;return q;},async run(single=false){const data=rows[table].filter(r=>filters.every(([k,v])=>r[k]===v)).slice(start,end+1);return {data:single?data[0]??null:data,error:options.error?{code:'42501'}:null};},maybeSingle(){return q.run(true);},then(ok,bad){return q.run().then(ok,bad);}};return q;}};
}
test('identidad por perfil_id, sin buscar nombres ni leer historial privado',async()=>{const client=db();const result=await domain.loadPlayerPanel(client,'own');assert.equal(result.player.id,2);assert.deepEqual(client.calls[0].filters,[['perfil_id','own']]);assert.ok(client.calls.every(c=>!['perfiles','inscripciones_historial','habilitaciones_jugador_categoria'].includes(c.table)));assert.deepEqual(client.calls.find(c=>c.table==='inscripciones').filters,[['jugador_id',2]]);});
test('sin vínculo no consulta solicitudes de otras personas',async()=>{const client=db({rows:{jugadores:[]}});assert.equal((await domain.loadPlayerPanel(client,'own')).player,null);assert.ok(!client.calls.some(c=>c.table==='inscripciones'));});
test('error de permisos falla cerrado',async()=>{await assert.rejects(()=>domain.loadPlayerPanel(db({error:true}),'own'));});
for(const estado of ['pendiente','aceptada','rechazada','cancelada']) test(`seguimiento conserva estado PostgreSQL ${estado}`,async()=>{const client=db({rows:{inscripciones:[{id:1,jugador_id:2,estado},{id:9,jugador_id:99,estado:'aceptada'}]}});assert.deepEqual((await domain.loadPlayerPanel(client,'own')).registrations,[{id:1,jugador_id:2,estado}]);});
test('paginación no oculta solicitudes tras límite de API',async()=>{const inscripciones=Array.from({length:501},(_,id)=>({id,jugador_id:2}));assert.equal((await domain.loadPlayerPanel(db({rows:{inscripciones}}),'own')).registrations.length,501);});
test('solo extrae código deportivo, nunca documentos ni evidencia privada',()=>{assert.equal(domain.registrationCategory({categoria:{codigo:'Juvenil'},motivo:'reservado'}),'Juvenil');for(const value of [null,{},'x',{categoria:null}])assert.equal(domain.registrationCategory(value),'Categoría no disponible');});
async function render(options={}) {
 const client=db(options);
 const page=load('../src/app/panel/jugador/page.tsx',{'react/jsx-runtime':jsx,'next/link':{default:({href,children})=>jsx.jsx('a',{href,children})},'@/lib/auth':{requireProfile:async ()=>{const role='jugador';if(options.denied)throw Error('denegado');return {id:'own',rol:role,nombre:'Cuenta'};}},'@/lib/supabase/server':{createClient:async()=>client},'@/components/dashboard-shell':{DashboardShell:({children})=>children},'@/components/player-refresh':{PlayerRefresh:()=>jsx.jsx('button',{children:'Actualizar estado'})},'@/lib/panel-jugador':domain,'@/lib/competencias':{displayLeagueTime:x=>x},'@/lib/inscripciones':{REGISTRATION_STATES:{pendiente:'Pendiente',aceptada:'Aceptada',rechazada:'Rechazada',cancelada:'Cancelada'}},'@/lib/jugadores':{todayInChile:()=> '2026-11-14'}});
 return renderToStaticMarkup(await page.default());
}
test('navegación corta y ranking real, sin solicitudes individuales',async()=>{const html=await render();for(const target of ['#perfil','#competencias','#participaciones','/ranking'])assert.ok(html.includes(`href="${target}"`));assert.ok(html.includes('participaciones confirmadas'));assert.ok(!html.includes('Solicitar inscripción'));assert.ok(!html.includes('Cancelar'));});
test('sin ficha explica vinculación administrativa',async()=>{assert.match(await render({rows:{jugadores:[]}}),/Solicita la vinculación al Administrador/);});
test('rol ajeno no carga panel',async()=>{await assert.rejects(()=>render({denied:true}),/denegado/);});
test('error comprensible y reintento sin datos incompletos',async()=>{assert.match(await render({error:true}),/No pudimos comprobar/);});
test('jornadas publicadas futuras, sin extrapolar horarios',async()=>{const html=await render({rows:{fechas:[{id:1,numero:1,fecha:'2026-11-13',estado:'publicada',recinto:'Pasada'},{id:2,numero:2,fecha:'2026-11-14',estado:'publicada',recinto:'Vigente'},{id:3,numero:3,fecha:'2026-11-20',estado:'borrador',recinto:'Reservada'}]}});assert.ok(html.includes('Vigente'));assert.ok(!html.includes('Pasada'));assert.ok(!html.includes('Reservada'));});
test('esquema vigente impide disponibilidad: solo operadores leen competencias',()=>{const sql=readFileSync(new URL('../supabase/migrations/003_categorias_competencias.sql',import.meta.url),'utf8');assert.match(sql,/create policy lectura_operadores/);assert.match(sql,/es_administrador.*es_juez_general/);});
