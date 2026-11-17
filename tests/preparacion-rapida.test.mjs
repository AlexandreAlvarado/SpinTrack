import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Module from "node:module";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const mod = new Module(filename);
  mod.require = name => { assert.ok(Object.hasOwn(mocks,name),name); return mocks[name]; };
  mod._compile(ts.transpileModule(readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
  return mod.exports;
}
const catalogs = load("../src/lib/catalogos.ts");
const competitions = load("../src/lib/competencias.ts",{"./catalogos":catalogs});
const domain = load("../src/lib/preparacion-deportiva.ts",{"./competencias":competitions});
const quick = load("../src/lib/preparacion-rapida.ts",{"./preparacion-deportiva":domain});
const competition = {id:5,temporada_id:1,fecha_id:2,categoria_temporada_id:3,activo:true,publicada:false,inscripciones_habilitadas:false,inscripcion_cierra_en:null};
const control = {competencia_id:5,temporada_id:1,configuracion_aprobada:false,estado_deportivo:"pendiente",inicio_programado:null,minimo_participantes:null,grupo_minimo:null,grupo_maximo:null,formato_competencia:null,reglamento_id:4,motivo_resolucion:null,referencia_resolucion:null,actualizado_en:"revision-1",actualizado_por:"juez",aprobado_por:null,aprobado_en:null};
const completeControl = {...control,inicio_programado:"2026-11-07T13:00:00Z",minimo_participantes:4,grupo_minimo:3,grupo_maximo:4,formato_competencia:"grupos_eliminacion_simple"};
const sets = (id=5) => domain.STAGES.map(etapa=>({competencia_id:id,etapa,mejor_de:etapa==="final"?5:3,referencia_resolucion:"Respaldo de sets",actualizado_en:"revision-sets",actualizado_por:"juez"}));
const template = {competition:{...competition,id:9,fecha_id:8},control:{...completeControl,competencia_id:9,configuracion_aprobada:true,estado_deportivo:"preparada",aprobado_por:"juez",aprobado_en:"2026-11-01T12:00:00Z"},formats:sets(9),label:"Fuente"};
const category = {id:3,temporada_id:1,categoria_id:1,nivel_id:1,reglamento_id:4,activo:true,rama:"mixta",criterio_nacimiento:"sin_limite"};
const regulation = {id:4,temporada_id:1,estado_revision:"validado",referencia_aprobacion:"Bases aplicables verificadas"};

// Cliente con estado persistente simulado: se ejecutan las acciones reales, incluidas
// las comprobaciones y revisiones de savePreparation/saveStageFormat/approvePreparation.
function harness(options={}) {
  const rows = structuredClone({competencias:[competition,{...competition,id:6},template.competition],fechas:[{id:2,temporada_id:1,fecha:"2026-11-07"}],competencia_control_deportivo:[control,{...control,competencia_id:6},template.control],competencia_formatos_sets:template.formats,categorias_temporada:[category],reglamentos_temporada:[regulation],categorias:[{id:1,activo:true}],niveles:[{id:1,activo:true}],...options.rows});
  const calls={writes:[],clients:0,roles:0};let revision=10;
  const requireRole=async role=>{calls.roles++;assert.equal(role,"administrador");if(options.role && options.role!==role)throw Error("denegado");return {id:"juez",rol:role};};
  const createClient=async()=>{calls.clients++;return {rpc(name,args){if(name!=="configurar_formato_final_021")return Promise.resolve({data:null,error:{code:"42883"}});if(options.failStage==="final")return Promise.resolve({data:null,error:{code:"23514"}});const row=rows.competencia_formatos_sets.find(s=>s.competencia_id===args.p_competencia_id&&s.etapa==="final");if(row){row.mejor_de=5;row.referencia_resolucion=args.p_referencia;}else rows.competencia_formatos_sets.push({competencia_id:args.p_competencia_id,etapa:"final",mejor_de:5,referencia_resolucion:args.p_referencia,actualizado_en:`revision-${revision++}`,actualizado_por:"juez"});return Promise.resolve({data:true,error:null});},from(table){
    let payload,mode="read";const filters=[];
    const request={select(){return request;},eq(k,v){filters.push([k,v]);return request;},insert(v){mode="insert";payload=v;return request;},update(v){mode="update";payload=v;return request;},
      async run(single=false){
        if(options.nullRead===table)return {data:null,error:null};
        if(options.readError===table)return {data:null,error:{code:"42501"}};
        const selected=rows[table].filter(r=>filters.every(([k,v])=>r[k]===v));
        if(mode==="read")return {data:single ? selected[0]??null : structuredClone(selected),error:null};
        const id=payload.competencia_id ?? selected[0]?.competencia_id;
        calls.writes.push({table,id,payload:{...payload},mode});
        if(options.failId===id || (options.failStage && payload.etapa===options.failStage))return {data:null,error:{code:"23514"}};
        if(options.throwId===id)throw Error("detalle privado");
        if(mode==="update" && !selected.length)return {data:null,error:null};
        const defaults = table === "competencia_control_deportivo" && mode === "insert" ? {configuracion_aprobada:false,estado_deportivo:"pendiente",aprobado_por:null,aprobado_en:null} : {};
        const saved={...defaults,...(selected[0]??{}),...payload,actualizado_en:`revision-${revision++}`,actualizado_por:"juez"};
        if(payload.configuracion_aprobada && !options.missingAudit)Object.assign(saved,{aprobado_por:"juez",aprobado_en:"2026-11-05T12:00:00Z"});
        if(mode==="insert")rows[table].push(saved);else Object.assign(selected[0],saved);
        return {data:single?saved:[saved],error:null};
      },maybeSingle(){return request.run(true);},then(ok,fail){return request.run().then(ok,fail);}};return request;
  }};};
  const shared={"next/cache":{revalidatePath(){}},"@/lib/auth":{requireRole},"@/lib/supabase/server":{createClient},"@/lib/catalogos":catalogs,"@/lib/competencias":competitions,"@/lib/preparacion-deportiva":domain};
  const actions=load("../src/app/panel/juez-general/preparacion/actions.ts",shared);
  const batch=load("../src/app/panel/juez-general/preparacion/quick-actions.ts",{...shared,"@/lib/preparacion-rapida":quick,"./actions":actions});
  return {rows,calls,batch};
}
function form(ids=[5,6],extra={}) {
  const f=new FormData();for(const id of ids){f.append("competencia",String(id));f.set(`${id}.revision`,"revision-1");f.set(`${id}.inicio_programado`,"2026-11-07T10:00");f.set(`${id}.formato_competencia`,"grupos_eliminacion_simple");}
  for(const [k,v] of Object.entries(extra))f.set(k,v);return f;
}
const common=Object.fromEntries(domain.STAGES.map(stage=>[`comun.${stage}`,stage==="final"?"5":"3"]));common["comun.final.referencia_resolucion"]="Referencia final al mejor de 5";
const save=(h,f=form())=>h.batch.saveQuickPreparations(1,2,{},f);
function approval(h,ids=[5,6]){const f=new FormData();f.set("confirmacion","revisada");for(const id of ids){f.append("competencia",String(id));f.set(`${id}.revision`,h.rows.competencia_control_deportivo.find(p=>p.competencia_id===id)?.actualizado_en??"");f.set(`${id}.sets_revision`,quick.formatsRevision(h.rows.competencia_formatos_sets.filter(s=>s.competencia_id===id)));}return f;}
const approve=(h,f=approval(h))=>h.batch.approveQuickPreparations(1,2,{},f);

test("flujo completo: guardar dos borradores, diez etapas y aprobar explícitamente por separado",async()=>{
  const h=harness();const result=await save(h,form([5,6],{habituales:"documentados",...common}));
  assert.equal(result.results.length,2);assert.ok(result.results.every(r=>r.steps.length===6 && r.steps.every(s=>s.success && !s.error)));
  assert.equal(h.calls.writes.length,10);assert.ok(h.rows.competencia_control_deportivo.filter(p=>p.competencia_id!==9).every(p=>!p.configuracion_aprobada));
  const confirmed=await approve(h);assert.ok(confirmed.results.every(r=>r.steps[0].success));
  assert.ok(h.rows.competencia_control_deportivo.filter(p=>p.competencia_id!==9).every(p=>p.configuracion_aprobada && p.aprobado_por));
});
test("jornada completa con diez categorías: 60 guardados y diez aprobaciones independientes",async()=>{
  const ids=Array.from({length:10},(_,i)=>11+i);
  const h=harness({rows:{competencias:ids.map(id=>({...competition,id,categoria_temporada_id:id+30})),categorias_temporada:ids.map(id=>({...category,id:id+30})),competencia_control_deportivo:[],competencia_formatos_sets:[]}});
  const input=form(ids,{habituales:"documentados",...common,"comun.formato":"grupos_eliminacion_simple"});for(const id of ids){input.set(`${id}.revision`,"");input.set(`${id}.formato_competencia`,"");}
  const saved=await save(h,input);assert.equal(saved.results.length,10);assert.ok(saved.results.every(r=>r.steps.length===6 && r.steps.every(s=>s.success)));assert.equal(h.calls.writes.length,50);
  const approved=await approve(h,approval(h,ids));assert.equal(approved.results.length,10);assert.ok(approved.results.every(r=>r.steps[0].success));assert.equal(h.calls.writes.length,60);
});
test("borradores incompletos se conservan, etapas faltantes y aprobación rechazada",async()=>{const h=harness();const result=await save(h);assert.ok(result.results.every(r=>r.steps[0].success && r.steps.slice(1).every(s=>s.error)));assert.ok((await approve(h)).results.every(r=>r.steps[0].error));assert.equal(h.calls.writes.length,2);});
test("fallo en una fila no revierte la otra ni anuncia éxito global",async()=>{const h=harness({failId:5});const result=await save(h,form([5,6],{habituales:"documentados",...common}));assert.ok(result.results[0].steps[0].error);assert.ok(result.results[1].steps.every(s=>s.success));assert.equal(result.success,undefined);});
test("fallo en una etapa conserva borrador y demás etapas e impide aprobar",async()=>{const h=harness({failStage:"cuartos"});const result=await save(h,form([5],{habituales:"documentados",...common}));assert.equal(result.results[0].steps.filter(s=>s.error).length,1);assert.equal(h.rows.competencia_formatos_sets.filter(s=>s.competencia_id===5).length,4);assert.ok((await approve(h,approval(h,[5]))).results[0].steps[0].error);});
test("plantilla aprobada compatible copia los cinco sets y sus referencias",async()=>{const h=harness();const result=await save(h,form([5],{habituales:"documentados",reutilizacion:"revisada","5.plantilla":"9"}));assert.ok(result.results[0].steps.every(s=>s.success));assert.ok(h.rows.competencia_formatos_sets.filter(s=>s.competencia_id===5).every(s=>s.referencia_resolucion==="Respaldo de sets"));assert.equal(h.rows.competencia_formatos_sets.find(s=>s.competencia_id===5&&s.etapa==="final").mejor_de,5);});
test("no sobrescribe etapas existentes ni excepciones documentadas con valores comunes",async()=>{const p={...completeControl,minimo_participantes:3,grupo_minimo:4,grupo_maximo:4,motivo_resolucion:"Excepción",referencia_resolucion:"Resolución"};const h=harness({rows:{competencia_control_deportivo:[p],competencia_formatos_sets:[{...sets()[0],mejor_de:5}]}});await save(h,form([5],{habituales:"documentados",...common}));assert.equal(h.rows.competencia_formatos_sets.find(s=>s.competencia_id===5 && s.etapa==="grupos").mejor_de,5);const saved=h.rows.competencia_control_deportivo[0];assert.equal(saved.minimo_participantes,3);assert.equal(saved.grupo_minimo,4);assert.equal(saved.motivo_resolucion,"Excepción");});
for(const role of ["juez_general","jugador","arbitro"])test(`${role} no guarda ni aprueba lotes`,async()=>{const h=harness({role});await assert.rejects(()=>save(h),/denegado/);await assert.rejects(()=>approve(h),/denegado/);assert.equal(h.calls.clients,0);});
test("no aplica valores habituales sin confirmación o con reglamento pendiente",async()=>{const h=harness();await save(h,form([5],common));assert.equal(h.rows.competencia_control_deportivo.find(p=>p.competencia_id===5).minimo_participantes,null);const pending=harness({rows:{reglamentos_temporada:[{...regulation,estado_revision:"pendiente"}]}});assert.ok((await save(pending,form([5],{habituales:"documentados"}))).results[0].steps[0].error);assert.equal(pending.calls.writes.length,0);});
test("rechaza reutilización sin revisión o fuente incompleta/no compatible",async()=>{
  for(const source of [{...template,control:{...template.control,configuracion_aprobada:false}},{...template,competition:{...template.competition,categoria_temporada_id:99}},{...template,control:{...template.control,reglamento_id:99}},{...template,formats:sets(9).slice(1)}]){
    const h=harness({rows:{competencias:[competition,source.competition],competencia_control_deportivo:[control,source.control],competencia_formatos_sets:source.formats}});const result=await save(h,form([5],{reutilizacion:"revisada","5.plantilla":"9"}));assert.ok(result.results[0].steps[0].error);assert.equal(h.calls.writes.length,0);
  }
  const h=harness();assert.ok((await save(h,form([5],{"5.plantilla":"9"}))).results[0].steps[0].error);assert.equal(h.calls.writes.length,0);
});
test("aprobación sin confirmación y revisiones concurrentes no escriben",async()=>{const h=harness();const f=approval(h);f.delete("confirmacion");assert.ok((await approve(h,f)).error);assert.equal(h.calls.clients,0);assert.ok((await save(h,form([5],{"5.revision":"antigua"}))).results[0].steps[0].error);const changed=approval(h,[5]);changed.set("5.sets_revision","antigua");assert.ok((await approve(h,changed)).results[0].steps[0].error);assert.equal(h.calls.writes.length,0);});
test("aprobación parcial y ausencia de auditoría producen resultados individuales",async()=>{
  const h=harness({failId:5,rows:{competencia_control_deportivo:[completeControl,{...completeControl,competencia_id:6}],competencia_formatos_sets:[...sets(5),...sets(6)]}});const result=await approve(h);assert.ok(result.results[0].steps[0].error);assert.ok(result.results[1].steps[0].success);
  const noAudit=harness({missingAudit:true,rows:{competencia_control_deportivo:[completeControl],competencia_formatos_sets:sets()}});assert.ok((await approve(noAudit,approval(noAudit,[5]))).results[0].steps[0].error);
});
test("respuestas nulas, errores y ámbitos ajenos no anuncian guardado",async()=>{for(const options of [{nullRead:"competencia_formatos_sets"},{readError:"competencias"},{throwId:5},{rows:{competencias:[{...competition,fecha_id:99}]}}]){const h=harness(options);const result=await save(h,form([5]));assert.ok(result.results[0].steps.some(s=>s.error));assert.ok(!JSON.stringify(result).includes("detalle privado"));}});
test("selecciones inválidas, duplicadas y vacías no consultan la base",async()=>{for(const ids of [[],[5,5],["-1"],["1.2"],["9007199254740992"]]){const h=harness();assert.ok((await save(h,form(ids))).error);assert.equal(h.calls.clients,0);}});
test("horarios oficiales exactos para diez combinaciones, sin traslados al 14",()=>{const schedule=[["juvenil","inicial","10:00"],["juvenil","federado","10:00"],["infantil","inicial","11:00"],["infantil","federado","11:00"],["preinfantil","inicial","11:30"],["preinfantil","federado","11:30"],["peneca","inicial","13:00"],["tc","federado","13:30"],["tc","aficionado","15:30"],["tc","unica","15:30"]];for(const [c,l,time] of schedule){assert.equal(quick.officialStart("2026-11-07",c,l,l==="unica"?"damas":"mixta"),`2026-11-07T${time}`);assert.equal(quick.officialStart("2026-11-14",c,l,"damas"),"");}assert.equal(quick.officialStart("2026-11-07","dobles","inicial",null),"");});

function renderTable({day="2026-11-07",record=control,formats=[],blockers=["Faltan sets"],state={},pending=false}={}) {
  const ui=load("../src/components/quick-preparation-table.tsx",{"react/jsx-runtime":jsx,react:{useActionState:()=>[state,undefined,pending],useState:initial=>[initial,()=>{}]},"next/link":{default:({children,...props})=>React.createElement("a",props,children)},"next/navigation":{useRouter:()=>({refresh(){}})},"@/app/panel/juez-general/preparacion/quick-actions":{saveQuickPreparations(){},approveQuickPreparations(){}},"@/lib/competencias":competitions,"@/lib/preparacion-deportiva":domain,"@/lib/preparacion-rapida":quick});
  return renderToStaticMarkup(React.createElement(ui.QuickPreparationTable,{seasonId:1,dateId:2,day,templates:[template],rows:[{competition,label:"Juvenil",record,formats,blockers,ruleId:4,ruleLabel:"Reglamento validado",proposedStart:"2026-11-07T10:00",advancedHref:"/avanzada"}]}));
}
test("tabla conserva revisión separada, explica parcialidad y oculta ocurrencia normal",()=>{const html=renderTable();assert.match(html,/no es una operación atómica/);assert.match(html,/Configuración avanzada/);assert.match(html,/Requisitos pendientes/);assert.match(html,/Reutilizar sets aprobados/);assert.ok(!html.includes('name="5.ocurrencia"'));assert.ok(!renderTable({day:"2026-11-14"}).includes("Proponer horarios oficiales"));});
test("tabla distingue lista, aprobada, hora ambigua y carga",()=>{
  assert.match(renderTable({record:completeControl,formats:sets(),blockers:[]}),/Lista para revisar y aprobar/);
  assert.match(renderTable({record:{...completeControl,configuracion_aprobada:true,estado_deportivo:"preparada"}}),/Aprobada/);
  assert.match(renderTable({record:{...control,inicio_programado:"2026-04-05T02:30:00Z"}}),/name="5.ocurrencia"/);
  assert.match(renderTable({pending:true}),/Guardando configuraciones/);
});
test("resultados parciales se muestran sin éxito global",()=>{const html=renderTable({state:{results:[{id:5,steps:[{label:"Borrador",success:"Guardado"},{label:"Cuartos",error:"No confirmado"}]}]}});assert.match(html,/Guardado/);assert.match(html,/No confirmado/);assert.match(html,/Competencia #5/);});
