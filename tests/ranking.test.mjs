import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
const file=new URL('../src/lib/ranking.ts',import.meta.url);
const mod=new Module(file.pathname);
mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file.pathname);
export const {calculateRanking,pointsForPlace}=mod.exports;
export const scope=(results=[])=>({id:1,seasonId:1,seasonLabel:'Temporada sintética',label:'Categoría autorizada de prueba',dates:Array.from({length:7},(_,i)=>({id:i+1,number:i+1,label:`Fecha ${i+1}`,complete:true})),results});
const results=(id,places,name=`Jugador ${id}`)=>places.map((place,i)=>({playerId:id,name,date:i+1,place,points:pointsForPlace(place),state:'confirmado'}));
test('escala oficial completa sin valores después del 32',()=>{
 assert.deepEqual(Array.from({length:8},(_,i)=>pointsForPlace(i+1)),[100,97,95,93,90,88,86,84]);
 for(let i=9;i<=32;i++) assert.equal(pointsForPlace(i),i<=16?81:78);
 for(const i of [0,-1,33,100,1.5,NaN]) assert.equal(pointsForPlace(i),null);
});
test('mejores seis, total siete y primeros lugares sobre toda la temporada',()=>{
 const {rows}=calculateRanking(scope(results(1,[1,2,3,4,5,6,7])));
 assert.equal(rows[0].valid,563); assert.equal(rows[0].total,649); assert.equal(rows[0].wins,1);
});
test('ausencias y pendientes no inventan puntos ni victoria',()=>{
 const s=scope([...results(1,[1]),{playerId:1,name:'Jugador 1',date:3,place:null,points:null,state:'resolucion_pendiente'}]);
 const r=calculateRanking(s);assert.equal(r.rows[0].total,100);assert.equal(r.rows[0].dates[1],null);assert.equal(r.provisional,true);
});
test('identidad estable entre jornadas; homónimos no se fusionan',()=>{
 const s=scope([...results(1,[1,2],'Igual'),...results(2,[2],'Igual')]);
 assert.equal(calculateRanking(s).rows.length,2);assert.equal(calculateRanking(s).rows[0].total,197);
});
test('podio: primero total siete, empate restante no se resuelve por nombre',()=>{
 const s=scope([...results(1,[1,1,1,1,1,1,32],'Z'),...results(2,[1,1,1,1,1,1,16],'B'),...results(3,[1,1,1,1,1,1,16],'A')]);
 const {rows}=calculateRanking(s); assert.deepEqual(rows.map(r=>[r.playerId,r.position]),[[3,1],[2,1],[1,3]]);
 assert.match(rows[0].tie,/partido de definición/);assert.match(rows[2].tie,/total de siete/);
});
test('podio: iguales totales y mejores seis se resuelven por victorias',()=>{
 // 100+88 = 97+91 no existe: combinación válida 100+88+86 = 97+93+84 = 274.
 const {rows}=calculateRanking(scope([...results(1,[1,6,7,32,32,32,32]),...results(2,[2,4,8,32,32,32,32])]));
 assert.equal(rows[0].valid,rows[1].valid);assert.equal(rows[0].total,rows[1].total);
 assert.equal(rows[0].playerId,1);assert.match(rows[0].tie,/primeros lugares/);assert.equal(rows[1].position,2);
});
test('fuera de los tres primeros, no aplicar desempates de podio',()=>{
 const s=scope([...results(1,[1,1]),...results(2,[2,2]),...results(3,[3,3]),...results(4,[6,7]),...results(5,[7,6])]);
 const r=calculateRanking(s).rows;assert.equal(r[3].position,4);assert.equal(r[4].position,4);assert.match(r[3].tie,/sin criterio autorizado/);
});
test('grupo empatado que cruza tercero: aplica criterios a todo el grupo',()=>{
 const s=scope([...results(1,[1,1,1,1,1,2]),...results(2,[1,1,1,1,1,3]),...results(3,[4,4,4,4,4,4,32]),...results(4,[4,4,4,4,4,4,16])]);
 const r=calculateRanking(s).rows;assert.deepEqual(r.map(x=>x.playerId),[1,2,4,3]);assert.deepEqual(r.map(x=>x.position),[1,2,3,4]);
});
test('rechaza fecha 8, fechas duplicadas, resultados duplicados y puntos pendientes',()=>{
 const s=scope(results(1,[1]));
 assert.throws(()=>calculateRanking({...s,dates:[...s.dates.slice(0,6),{id:8,number:8}]}));
 assert.throws(()=>calculateRanking({...s,results:[...s.results,{...s.results[0],date:8}]}));
 assert.throws(()=>calculateRanking({...s,results:[...s.results,...s.results]}));
 assert.throws(()=>calculateRanking(scope([{...s.results[0],state:'resultado_pendiente'}])));
 assert.throws(()=>calculateRanking(scope([{...s.results[0],points:101}])));
});
test('sin puntuación confirmada no asigna posición de temporada',()=>{
 const r=calculateRanking(scope([{playerId:1,name:'Pendiente',date:1,place:null,points:null,state:'resultado_pendiente'}]));
 assert.equal(r.rows[0].position,null);assert.equal(r.rows[0].valid,0);assert.match(r.rows[0].tie,/Sin puntuación confirmada/);
});
