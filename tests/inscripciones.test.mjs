import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Module from "node:module";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const mod = new Module(filename);
  mod.require = name => { assert.ok(Object.hasOwn(mocks,name),name); return mocks[name]; };
  mod._compile(ts.transpileModule(readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
  return mod.exports;
}
const domain = load("../src/lib/inscripciones.ts");
const catalogs = load("../src/lib/catalogos.ts");
const values = {estado:"aceptada",motivo:"Elegibilidad revisada",referencia:"Resolución documentada"};
const form = (extra = {}) => { const f = new FormData(); for (const [k,v] of Object.entries({...values,confirmacion:"revisada",...extra})) f.set(k,v); return f; };
const registration = {id:1,jugador_id:2,competencia_id:3,estado:"aceptada",creado_en:"2026-01-01T12:00:00Z",actualizado_en:"2026-01-02T12:00:00Z",antecedentes:{}};
const event = {id:4,inscripcion_id:1,estado_anterior:"pendiente",estado_nuevo:"aceptada",actor:"juez",ocurrido_en:registration.actualizado_en,motivo:values.motivo,referencia_resolucion:values.referencia,antecedentes:{}};
function harness(options = {}) {
  const calls = {rpc:[],reads:[],clients:0}; let invoked = false;
  const requireRole = async role => { assert.equal(role,"juez_general"); if(options.role && options.role !== role) throw Error("denegado"); return {id:"juez",rol:role,nombre:"Juez"}; };
  const createClient = async () => { calls.clients++; return {
    from(table) {
      let cols; const filters=[];
      const query = {select(c){cols=c; assert.ok(!c.includes("*"));return query;},eq(k,v){filters.push([k,v]);return query;},order(){return query;},limit(){return query;},range(){return query;},
        async run(single) {
          calls.reads.push({table,cols,filters});
          if(options.offline) return {data:null,error:{code:"42501"}};
          let data;
          if(table === "inscripciones") data = options.missing ? null : {...registration,estado:invoked ? options.savedState ?? "aceptada" : options.oldState ?? "pendiente"};
          else if(table === "inscripciones_historial") data = options.noHistory ? null : {...event,...options.history};
          else data = null;
          return {data:single ? data : options.nullList ? null : [],error:null};
        },maybeSingle(){return query.run(true);},then(ok,fail){return query.run(false).then(ok,fail);}};
      return query;
    },async rpc(name,args){calls.rpc.push({name,args});invoked=true;if(options.throw) throw Error("detalle secreto");return {data:null,error:options.rpcError ? {code:options.rpcError,message:"detalle secreto"}:null};}
  }; };
  const action = load("../src/app/panel/juez-general/inscripciones/actions.ts",{"next/cache":{revalidatePath(){}},"@/lib/auth":{requireRole},"@/lib/supabase/server":{createClient},"@/lib/catalogos":catalogs,"@/lib/inscripciones":domain});
  return {calls,action,requireRole,createClient};
}
const save = (h, extra={}) => h.action.resolveRegistration(1,3,{},form(extra));

test("validación cerrada exige decisión, motivo, referencia y revisión",()=>{
  assert.equal(domain.validateDecision(form()).valid,true);
  for(const extra of [{estado:"cancelada"},{estado:"pendiente"},{motivo:" "},{referencia:""},{motivo:"x".repeat(2001)},{referencia:"x".repeat(1001)},{confirmacion:""}]) assert.equal(domain.validateDecision(form(extra)).valid,false);
  const f=form();f.set("motivo",new Blob(["x"]));assert.equal(domain.validateDecision(f).valid,false);
});
for(const role of ["administrador","jugador","arbitro"]) test(`${role} no accede a la acción`,async()=>{const h=harness({role});await assert.rejects(()=>save(h),/denegado/);assert.equal(h.calls.clients,0);});
test("usa únicamente RPC con parámetros cerrados y confirma historial",async()=>{const h=harness();assert.ok((await save(h,{actor:"falso",jugador_id:"99"})).success);assert.deepEqual(h.calls.rpc,[{name:"resolver_inscripcion",args:{p_inscripcion_id:1,p_estado:"aceptada",p_motivo:values.motivo,p_referencia:values.referencia}}]);assert.ok(h.calls.reads.every(r=>r.table!=="inscripciones" || r.cols===domain.REGISTRATION_COLUMNS));});
for(const options of [{missing:true},{oldState:"rechazada"},{offline:true}]) test(`no resuelve solicitud ausente, terminal o ilegible ${JSON.stringify(options)}`,async()=>{const h=harness(options);assert.ok((await save(h)).error);assert.equal(h.calls.rpc.length,0);});
for(const options of [{rpcError:"42501"},{rpcError:"23514"},{throw:true},{noHistory:true},{savedState:"pendiente"},{history:{actor:"otro"}},{history:{motivo:"distinto"}},{history:{referencia_resolucion:null}},{history:{ocurrido_en:null}}]) test(`no anuncia éxito con error o confirmación incompleta ${JSON.stringify(options)}`,async()=>{const h=harness(options);const result=await save(h);assert.ok(result.error);assert.equal(result.success,undefined);assert.ok(!result.error.includes("detalle secreto"));});
test("confirmación exige identidad, competencia y transición exactas",()=>{
  assert.equal(domain.decisionConfirmed(registration,event,1,3,"juez",values),true);
  for(const changed of [{id:9},{competencia_id:8},{actualizado_en:"inválida"}]) assert.equal(domain.decisionConfirmed({...registration,...changed},event,1,3,"juez",values),false);
  assert.equal(domain.decisionConfirmed(registration,{...event,estado_anterior:"aceptada"},1,3,"juez",values),false);
});
test("página protege rol y falla cerrada ante listas nulas",async()=>{
  const h=harness({nullList:true});
  const page=load("../src/app/panel/juez-general/inscripciones/page.tsx",{"react/jsx-runtime":jsx,"next/link":{default:({children})=>children},"next/form":{default:({children})=>children},"@/components/dashboard-shell":{DashboardShell:({children})=>children},"@/components/judge-navigation":{JudgeNavigation:()=>null},"@/components/registration-decision-form":{RegistrationDecisionForm:()=>{throw Error("formulario expuesto");}},"@/lib/auth":{requireRole:h.requireRole},"@/lib/supabase/server":{createClient:h.createClient},"@/lib/catalogos":catalogs,"@/lib/competencias":{},"@/lib/jugadores":{},"@/lib/habilitaciones":{},"@/lib/inscripciones":domain});
  const html=renderToStaticMarkup(await page.default({searchParams:Promise.resolve({})}));assert.match(html,/No se pudieron comprobar todos los datos/);assert.match(html,/Resoluciones deshabilitadas/);
});

async function renderPage(query = {}, options = {}) {
  const rows = {temporadas:[{id:10,nombre:"Temporada prueba"}],fechas:[{id:20,temporada_id:10,numero:1,fecha:"2026-11-07",recinto:"Recinto prueba",estado:"publicada"}],categorias_temporada:[{id:30,temporada_id:10,codigo:"juvenil",categoria_id:1,nivel_id:1,reglamento_id:5}],competencias:[{id:3,temporada_id:10,fecha_id:20,categoria_temporada_id:30,activo:true,publicada:true,inscripciones_habilitadas:false,tarifa_clp:1000}],competencia_control_deportivo:[],inscripciones:[registration],jugadores:[{id:2,nombre_completo:"Jugador de prueba",club_id:1,activo:true}],clubes:[{id:1,nombre:"Club prueba"}],inscripciones_historial:[event],habilitaciones_jugador_categoria:[],reglamentos_temporada:[],categorias:[],niveles:[],...options.rows};
  const createClient=async()=>({from(table){const filters=[];let start=0,end=499;const request={select(c){assert.ok(!c.includes("*"));return request;},order(){return request;},eq(k,v){filters.push([k,v]);return request;},range(a,b){start=a;end=b;return request;},then(ok,fail){return Promise.resolve(options.failTable===table ? {data:null,error:{code:"42501"}} : {data:rows[table].filter(r=>filters.every(([k,v])=>r[k]===v)).slice(start,end+1),error:null}).then(ok,fail);}};return request;}});
  const page=load("../src/app/panel/juez-general/inscripciones/page.tsx",{"react/jsx-runtime":jsx,"next/link":{default:({children})=>children},"next/form":{default:({children})=>children},"@/components/dashboard-shell":{DashboardShell:({children})=>children},"@/components/judge-navigation":{JudgeNavigation:()=>null},"@/components/registration-decision-form":{RegistrationDecisionForm:()=>jsx.jsx("p",{children:"FORMULARIO DE DECISIÓN"}),RegistrationRefresh:()=>null},"@/lib/auth":{requireRole:async role=>{assert.equal(role,"juez_general");if(options.denied)throw Error("denegado");return {rol:role,nombre:"Juez"};}},"@/lib/supabase/server":{createClient},"@/lib/catalogos":catalogs,"@/lib/competencias":{displayLeagueTime:x=>x ?? "Pendiente",COMPETITION_COLUMNS:"id,fecha_id,temporada_id,categoria_temporada_id"},"@/lib/jugadores":{PLAYER_COLUMNS:"id,nombre_completo,club_id"},"@/lib/habilitaciones":{HABILITATION_COLUMNS:"id,estado",eligibilityIssues:()=>["Revisión documental requerida"]},"@/lib/inscripciones":domain});
  return renderToStaticMarkup(await page.default({searchParams:Promise.resolve({temporada:"10",jornada:"20",competencia:"3",...query})}));
}
test("consulta presenta jugador, categoría, club, aceptados y falta de preparación",async()=>{
  const html=await renderPage();for(const text of ["Jugador de prueba","juvenil","Club prueba","Aceptada","Participantes aceptados: 1","aún no está preparada","deshabilitadas"])assert.ok(html.includes(text),text);
  assert.ok(!(await renderPage({estado:"pendiente"})).includes("Revisar #1"));
  assert.ok(!(await renderPage({q:"inexistente"})).includes("Revisar #1"));
  assert.ok((await renderPage({q:"#2"})).includes("Revisar #1"));
});
test("selección cruzada no muestra solicitudes de otra temporada o jornada",async()=>{for(const query of [{temporada:"99"},{jornada:"99"},{competencia:"99"}])assert.ok(!(await renderPage(query)).includes("Jugador de prueba"));});
test("historial privado y formulario solo para pendiente con antecedentes disponibles",async()=>{
  const options={rows:{inscripciones:[{...registration,estado:"pendiente"}]}};
  const html=await renderPage({solicitud:"1"},options);assert.match(html,/FORMULARIO DE DECISIÓN/);assert.match(html,/Resolución documentada/);assert.match(html,/Revisión documental requerida/);
  assert.ok(!(await renderPage({solicitud:"1"})).includes("FORMULARIO DE DECISIÓN"));
  assert.ok(!(await renderPage({solicitud:"1"},{...options,failTable:"inscripciones_historial"})).includes("FORMULARIO DE DECISIÓN"));
  assert.ok(!(await renderPage({solicitud:"1"},{rows:{...options.rows,inscripciones_historial:[]}})).includes("FORMULARIO DE DECISIÓN"));
  await assert.rejects(()=>renderPage({},{denied:true}),/denegado/);
});


test("antecedentes deportivos ocultan importes anidados sin modificar evidencia", async () => {
  const evidence = { tarifa_clp: 7654321, competencia: { tarifa_clp: 7654321, id: 3 }, eventos: [{ tarifa_clp: 7654321, categoria: "Juvenil" }] };
  const before = JSON.stringify(evidence);
  assert.deepEqual(domain.sportsEvidence(evidence), { competencia: { id: 3 }, eventos: [{ categoria: "Juvenil" }] });assert.equal(JSON.stringify(evidence), before);
  const html = await renderPage({ solicitud: "1" }, { rows: { inscripciones: [{ ...registration, antecedentes: evidence }], inscripciones_historial: [{ ...event, antecedentes: { evidencia: evidence } }] } });
  assert.ok(!html.includes("tarifa_clp"));assert.ok(!html.includes("7654321"));assert.ok(html.includes("Juvenil"));
});

test("vista operativa explica bloqueo heredado sin mostrar importes", async () => {
  const html = await renderPage({}, { rows: { competencias: [{ id: 3, temporada_id: 10, fecha_id: 20, categoria_temporada_id: 30, activo: true, publicada: true, tarifa_clp: null }] } });
  assert.ok(html.includes("requisito heredado pendiente de actualización del esquema"));assert.ok(!html.includes("tarifa"));
});

test("resolución conserva rechazo disponible y bloquea Aceptar por dependencia heredada", () => {
  const { RegistrationDecisionForm } = load("../src/components/registration-decision-form.tsx", { "react/jsx-runtime": jsx, react: { useActionState: () => [{}, "/simulada", false] }, "next/navigation": { useRouter: () => ({ refresh() {} }) }, "@/app/panel/juez-general/inscripciones/actions": { resolveRegistration() {} } });
  const blocked = renderToStaticMarkup(jsx.jsx(RegistrationDecisionForm, { id: 1, competition: 3, canAccept: false }));
  assert.ok(blocked.includes('<option value="aceptada" disabled="">'));assert.ok(blocked.includes('<option value="rechazada">'));assert.ok(blocked.includes("actualizar el requisito heredado"));assert.ok(!/tarifa|pago|cobro/i.test(blocked));
  const allowed = renderToStaticMarkup(jsx.jsx(RegistrationDecisionForm, { id: 1, competition: 3, canAccept: true }));assert.ok(!allowed.includes('<option value="aceptada" disabled="">'));
});
