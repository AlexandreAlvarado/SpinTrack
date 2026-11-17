import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
 const filename = fileURLToPath(new URL(path, import.meta.url)), m = new Module(filename);
 m.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
 m._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
 return m.exports;
}
const catalogs = load('../src/lib/catalogos.ts');
const players = load('../src/lib/jugadores.ts',{'@/lib/catalogos':catalogs});
const imports = load('../src/lib/importacion-jugadores.ts',{'@/lib/catalogos':catalogs,'@/lib/jugadores':players});
const excel = load('../src/lib/excel-jugadores.ts');
const E = require('exceljs');
const row = (name='Ana Pérez', extra={}) => ({source:'Hoja · fila 2',id:'',nombre_completo:name,fecha_nacimiento:'',club_id:'',localidad_procedencia_id:'',selected:true,...extra});
const record = (name='Ana Pérez',id=1) => ({...players.validatePlayer(new FormData()).payload,nombre_completo:name,id,activo:true});
test('validación de cientos de fichas sin cuenta ni datos inferidos',()=>{
 const rows=Array.from({length:350},(_,i)=>row(`Participante ${i}`));
 const reviewed=imports.reviewRows(rows,[],[],[]);
 assert.equal(reviewed.length,350);
 for(const r of reviewed){assert.deepEqual(r.errors,[]);assert.equal(r.payload.perfil_id,null);assert.equal(r.payload.fecha_nacimiento,null);}
});
test('nombres iguales y variantes se señalan sin fusionar IDs de homónimos',()=>{
 const original=[record('Ana Pérez',1),record('Ana Pérez',2)];
 const reviewed=imports.reviewRows([row(),row('ANA PEREZ'),row('Ana Peres')],original,[],[]);
 assert.deepEqual(reviewed[0].matches.map(r=>r.id),[1,2]);
 assert.equal(reviewed[1].repeated,true);assert.equal(reviewed[2].repeated,true);
 assert.equal(original.length,2);
});
test('ID inequívoco, fechas inexistentes, filas incompletas y catálogo no autorizado',()=>{
 const reviewed=imports.reviewRows([row('',{id:'999',fecha_nacimiento:'2026-02-30',club_id:'23'}),row('Otro nombre',{id:'1'})],[record()],[],[]);
 assert.ok(reviewed[0].errors.length>=4);assert.equal(reviewed[1].matches[0].id,1);
});
test('relaciones se resuelven solo por catálogo existente inequívoco',()=>{
 const options=[{id:2,nombre:'Club Real',activo:true}];
 assert.equal(imports.reviewRows([row('Ana',{club_id:'Club Real'})],[],options,[])[0].payload.club_id,2);
 const duplicate=[...options,{id:3,nombre:'Club Real',activo:true}];
 assert.ok(imports.reviewRows([row('Ana',{club_id:'Club Real'})],[],duplicate,[])[0].errors.length);
});
test('excluir una fila no bloquea la siguiente repetida',()=>{
 const r=imports.reviewRows([row('Ana Pérez',{selected:false}),row()],[],[],[]);
 assert.equal(r[1].repeated,false);
});
test('contenido no confiable y fechas inválidas no se interpretan',()=>{
 for(const value of ['=SUM(1,2)','@malo','[Contenido no admitido]']) assert.ok(imports.reviewRows([row(value)],[],[],[])[0].errors.length);
 assert.equal(imports.reviewRows([row('Ana',{fecha_nacimiento:'02/03/2010'})],[],[],[])[0].payload.fecha_nacimiento,'2010-03-02');
 assert.ok(imports.reviewRows([row('Ana',{fecha_nacimiento:'31/02/2010'})],[],[],[])[0].errors.length);
});
test('autodetecta fecha_nacimiento y valida las 20 fechas de la vista previa',async()=>{
 const w=new E.Workbook(),s=w.addWorksheet('Jugadores'); s.addRow(['nombre_completo','fecha_nacimiento','categoria']); const expected=[];
 for(let i=0;i<20;i++){const date=new Date(Date.UTC(2010+i%7,i%12,i+1)); expected.push(date.toISOString().slice(0,10)); s.addRow([`PRUEBA ${i+1}`,date,'Peneca']);}
 const result=await excel.readExcel(Buffer.from(await w.xlsx.writeBuffer())); const mapping=imports.inferColumnMapping(result[0].rows[0]);
 assert.equal(mapping.fecha_nacimiento,'1'); const rows=result[0].rows.slice(1).map(cells=>row(cells[0],{fecha_nacimiento:cells[Number(mapping.fecha_nacimiento)]})); const reviewed=imports.reviewRows(rows,[],[],[]);
 assert.deepEqual(reviewed.map(r=>r.payload.fecha_nacimiento),expected); assert.deepEqual(reviewed.map(r=>r.errors),Array.from({length:20},()=>[]));
});
test('Excel válido: varias hojas, blancos, texto enriquecido, fecha y fórmulas',async()=>{
 const w=new E.Workbook(),s=w.addWorksheet('Datos');s.addRow(['nombre','fecha']);s.addRow(['Ana',new Date('2010-03-02T00:00:00Z')]);s.addRow([{formula:'1+1',result:2}]);w.addWorksheet('Otra').addRow(['Otra persona']);
 const result=await excel.readExcel(Buffer.from(await w.xlsx.writeBuffer()));
 assert.equal(result.length,2);assert.equal(result[0].rows[1][1],'2010-03-02');assert.equal(result[0].rows[2][0],'[Contenido no admitido]');
});
test('Excel real de referencia se lee con sus bloques sin inferir asociaciones',async()=>{
 const sheets=await excel.readExcel(readFileSync(new URL('../documentacion/referencias/Grupos 4ra Fecha LR 2026.xlsx',import.meta.url)));
 assert.equal(sheets[0].name,'Grupos');assert.equal(sheets[0].rows[6][1],'Amanda Pozas');
 let count=0;for(const cells of sheets[0].rows)for(const c of [1,5,9,13])if(/^[1-4]$/.test(cells[c-1]??'')&&cells[c])count++;
 assert.equal(count,343);
});
test('archivos malformados, truncados, sobredimensionados y columnas excesivas',async()=>{
 for(const b of [Buffer.alloc(0),Buffer.from('no soy excel'),Buffer.alloc(excel.MAX_FILE+1)])await assert.rejects(()=>excel.readExcel(b));
 const w=new E.Workbook(),s=w.addWorksheet('Datos');s.getCell('AY1').value='51 columnas';
 await assert.rejects(async()=>excel.readExcel(Buffer.from(await w.xlsx.writeBuffer())));
});
function harness({denied=false, rpcError=false, partial=false}={}){
 const state={players:[],writes:0,rpcs:0};
 const db={from:table=>{assert.equal(table,'jugadores');const b={select:()=>b,order:()=>b,range:async()=>({data:state.players,error:null})};return b;},rpc:async(name,{filas})=>{
  assert.equal(name,'importar_fichas_jugadores');state.rpcs++;
  if(rpcError)return {data:null,error:{code:'PGRST202'}};
  return {error:null,data:filas.map((p,i)=>{if(partial&&i===1)return {fila:i+1,estado:'error'};const exists=state.players.find(r=>imports.nameKey(r.nombre_completo)===imports.nameKey(p.nombre_completo));if(exists)return {fila:i+1,estado:'duplicado',id:exists.id};state.writes++;const id=state.players.length+1;state.players.push({...p,id});return {fila:i+1,estado:'creado',id};})};
 }};
 const actions=load('../src/app/panel/administrador/jugadores/import-actions.ts',{
  '@/lib/auth':{requireRole:async r=>{assert.equal(r,'administrador');if(denied)throw Error('denegado');}},
  '@/lib/supabase/server':{createClient:async()=>db},'@/lib/admin-options':{getCatalogOptions:async()=>({data:[],error:false})},
  '@/lib/jugadores':players,'@/lib/importacion-jugadores':imports,'@/lib/excel-jugadores':excel,'next/cache':{revalidatePath:()=>{}},
 });return {...actions,state};
}
test('confirmación explícita, permisos y límites impiden escrituras',async()=>{
 const h=harness();assert.ok((await h.confirmPlayers([row()],false)).error);assert.equal(h.state.writes,0);
 const no=harness({denied:true});await assert.rejects(()=>no.confirmPlayers([row()],true));await assert.rejects(()=>no.previewPlayers([row()]));await assert.rejects(()=>no.uploadPlayers(new FormData()));assert.equal(no.state.rpcs,0);
 assert.ok((await h.confirmPlayers(Array.from({length:2001},()=>row()),true)).error);
});
test('guardado parcial y reintento conservan resultados por fila sin duplicar',async()=>{
 const h=harness({partial:true});const rows=[row('Ana Pérez'),row('Carlos González')];
 const first=await h.confirmPlayers(rows,true);assert.equal(first.results.filter(r=>r.estado==='creado').length,1);assert.equal(first.results.filter(r=>r.estado==='error').length,1);
 const retry=await h.confirmPlayers(rows,true);assert.equal(retry.results.filter(r=>r.estado==='duplicado').length,1);assert.equal(h.state.players.length,2);
 await h.confirmPlayers(rows,true);assert.equal(h.state.players.length,2);
});
test('filas excluidas, incompletas e ID existente nunca se escriben',async()=>{
 const h=harness();h.state.players.push(record());const r=await h.confirmPlayers([row('Ignorado',{selected:false}),row(''),row('Ana Pérez',{id:'1'}),row('Carlos González')],true);
 assert.deepEqual(r.results.map(r=>r.estado),['omitido','error','duplicado','creado']);assert.equal(h.state.writes,1);
});
test('RPC ausente o error no anuncia éxito y permite revisión segura',async()=>{
 const h=harness({rpcError:true});const r=await h.confirmPlayers([row()],true);assert.ok(r.error);assert.equal(h.state.writes,0);
});
test('008 conserva RLS, serializa concurrencia, no actualiza fichas ni crea cuentas/tablas',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/008_importar_fichas_jugadores.sql',import.meta.url),'utf8');
 assert.match(sql,/security invoker/i);assert.match(sql,/es_administrador/);assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/exception when/);assert.match(sql,/revoke all.*from public, anon/i);
 assert.doesNotMatch(sql,/create table|update public\.|auth\.users|service_role|alter policy/i);
});


test('ZIP expansivo, entidades XML, macros y vínculos externos son rechazados antes del lector', async () => {
  const Zip = require('jszip');
  for (const [name, content] of [['xl/big.xml','x'.repeat(9*1024*1024)],['xl/test.xml','<!DOCTYPE x [<!ENTITY a "texto">]>'],['xl/vbaProject.bin','macro'],['xl/externalLinks/link.xml','externo']]) {
    const zip = new Zip();zip.file(name,content);
    const bytes = await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
    assert.throws(()=>excel.checkArchive(bytes));
  }
});
test('filas excesivas y celdas inesperadamente largas se rechazan completas', async () => {
  for(const setup of [s=>{s.getCell('A2001').value='Nombre';},s=>s.addRow(['x'.repeat(301)])]){
    const w=new E.Workbook();setup(w.addWorksheet('Datos'));
    const bytes=Buffer.from(await w.xlsx.writeBuffer());
    await assert.rejects(()=>excel.readExcel(bytes));
  }
});
test('lote con forma manipulada y archivo que no es Excel no llegan a la RPC', async () => {
  const h=harness();
  for(const value of [null,{},[{}],[row('Ana',{selected:'true'})],[row('Ana',{club_id:5})]]) assert.ok((await h.confirmPlayers(value,true)).error);
  const f=new FormData();f.set('archivo',new File(['contenido'],'mal.csv'));
  assert.ok((await h.uploadPlayers(f)).error);assert.equal(h.state.rpcs,0);
});

test('índices dispersos y merges gigantes se rechazan antes de reservar celdas', async () => {
  const Zip=require('jszip');
  for(const xml of ['<worksheet><row r="999999999"/></worksheet>','<worksheet><mergeCell ref="A1:XFD1048576"/></worksheet>']) {
    const z=new Zip();z.file('xl/worksheets/sheet1.xml',xml);
    const bytes=await z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
    assert.throws(()=>excel.checkArchive(bytes));
  }
});
