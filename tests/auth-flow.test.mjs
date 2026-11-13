import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import ts from "typescript";
import { fileURLToPath } from "node:url";
import * as jsx from "react/jsx-runtime";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
function load(path, mocks = {}) {
 const filename = fileURLToPath(new URL(path, import.meta.url)); const m = new Module(filename);
 m.require = n => { assert.ok(Object.hasOwn(mocks,n), n); return mocks[n]; };
 m._compile(ts.transpileModule(readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename); return m.exports;
}
const flow = load("../src/lib/auth-flow.ts");
const redirect = path => { throw Error(path); };
function form(values) { const data = new FormData(); for (const [k,v] of Object.entries(values)) data.set(k,v); return data; }
function actions(auth, recovery = false) { return load(recovery ? "../src/app/recovery-actions.ts" : "../src/app/actions.ts", {
 "next/navigation":{redirect}, "next/cache":{revalidatePath(){}}, "@/lib/config":{supabaseConfigured:()=>true}, "@/lib/auth-flow":flow,
 "@/lib/auth":{}, "@/lib/recovery":{beginRecovery:async()=>"intent",hasRecovery:async()=>auth.allowed ?? true,clearRecovery:async()=>{}}, "@/lib/supabase/server":{createClient:async()=>({auth})}
}); }
test("origen explícito rechaza esquemas, credenciales, rutas y nunca utiliza next",()=>{
 const previous=process.env.NEXT_PUBLIC_SITE_URL;
 try { for(const value of ["javascript:alert(1)","https://user:pass@example.com","https://example.com/path","https://example.com/?next=evil"]) {process.env.NEXT_PUBLIC_SITE_URL=value; assert.throws(()=>flow.authOrigin());}
 process.env.NEXT_PUBLIC_SITE_URL="http://localhost:3000";assert.equal(flow.authOrigin(),"http://localhost:3000");
 }finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_SITE_URL;else process.env.NEXT_PUBLIC_SITE_URL=previous;}
});
for(const [error,expected] of [[null,"/panel"],[{code:"invalid_credentials"},"/login?error=credenciales"],[{code:"email_not_confirmed"},"/login?error=pendiente"],[{status:429},"/login?error=limite"]]) test(`login ${expected}`,async()=>{
 const a=actions({signInWithPassword:async input=>{assert.equal(input.password,"  clave  ");return {error};}});
 await assert.rejects(()=>a.login(form({email:"test@example.org",password:"  clave  "})),{message:expected});
});
test("registro solo envía nombre, ignora rol suministrado",async()=>{
 const a=actions({signUp:async input=>{assert.deepEqual(input.options.data,{full_name:"Prueba"});return {data:{session:null},error:null};}});
 await assert.rejects(()=>a.register(form({nombre:"Prueba",email:"test@example.org",password:"Password123!",confirmation:"Password123!",rol:"administrador"})),{message:"/login?info=confirmacion"});
});
for(const error of [null,{status:429},{code:"user_not_found"}]) test(`recuperación respuesta uniforme ${JSON.stringify(error)}`,async()=>{
 process.env.AUTH_RECOVERY_SECRET="a".repeat(64);
 const a=actions({resetPasswordForEmail:async(email,options)=>{assert.equal(email,"test@example.org");const url=new URL(options.redirectTo);assert.equal(url.pathname,"/auth/recovery");assert.equal(url.searchParams.get("state"),"intent");return {error};}},true);
 await assert.rejects(()=>a.requestRecovery(form({email:"test@example.org"})),{message:"/recuperar-contrasena?info=enviado"});
});
for(const [allowed,password,confirmation,error,expected] of [[false,"Password123!","Password123!",null,"enlace"],[true,"short","short",null,"datos"],[true,"Password123!","different",null,"datos"],[true,"Password123!","Password123!",{code:"weak_password"},"politica"],[true,"Password123!","Password123!",{code:"other"},"actualizacion"],[true,"Password123!","Password123!",null,null]]) test(`actualización ${expected}`,async()=>{
 let updates=0;
 const a=actions({allowed,getUser:async()=>({data:{user:{id:"user"}}}),getClaims:async()=>({data:{claims:{sub:"user",session_id:"session"}}}),updateUser:async()=>{updates++;return {error};},signOut:async()=>({error:null})},true);
 await assert.rejects(()=>a.resetPassword(form({password,confirmation})),{message:expected?`/restablecer-contrasena?error=${expected}`:"/login?info=restablecida"});
 assert.equal(updates,!allowed||expected==="datos"?0:1);
});
test("formularios accesibles, compactos, responsivos y recuperación visible",()=>{
 const {AuthForm}=load("../src/components/auth-form.tsx",{"react/jsx-runtime":jsx,"next/link":{default:props=>jsx.jsx("a",props)},"next/image":{default:()=>null},"@/app/actions":{login:"/login",register:"/registro"},"@/app/recovery-actions":{requestRecovery:"/recover",resetPassword:"/reset"},"@/components/auth-controls":{PasswordField:()=>jsx.jsx("input",{type:"password"}),AuthSubmit:({children})=>jsx.jsx("button",{children})}});
 for(const mode of ["login","register","recover","reset"]){const html=renderToStaticMarkup(React.createElement(AuthForm,{mode}));assert.match(html,/mx-auto w-full max-w-md/);assert.match(html,/aria-labelledby="auth-title"/);if(mode==="login")assert.match(html,/href="\/recuperar-contrasena"/);}
});

test("autorización firmada: sesión ajena, manipulación, caducidad y eliminación", async()=>{
 const crypto=await import("node:crypto"); let cookie;
 process.env.AUTH_RECOVERY_SECRET="b".repeat(64);
 const recovery=load("../src/lib/recovery.ts",{"node:crypto":crypto,"next/headers":{cookies:async()=>({get:()=>cookie?{value:cookie}:undefined,set:(name,value,options)=>{assert.equal(options.httpOnly,true);cookie=value;},delete:()=>{cookie=undefined;}})}});
 await recovery.grantRecovery("u","s"); assert.equal(await recovery.hasRecovery("u","s"),true);
 assert.equal(await recovery.hasRecovery("u","another"),false);
 const original=cookie;cookie=cookie.slice(0,-1)+(cookie.endsWith("a")?"b":"a");assert.equal(await recovery.hasRecovery("u","s"),false);
 cookie=original;const now=Date.now;Date.now=()=>now()+16*60*1000;
 try{assert.equal(await recovery.hasRecovery("u","s"),false);}finally{Date.now=now;}
 cookie=original;await recovery.clearRecovery();assert.equal(await recovery.hasRecovery("u","s"),false);
});
for(const rol of ["administrador","juez_general","arbitro","jugador"])test(`login con sesión ${rol} redirige`,async()=>{
 const paths={administrador:"/panel/administrador",juez_general:"/panel/juez-general",arbitro:"/panel/arbitro",jugador:"/panel/jugador"};
 const page=load("../src/app/login/page.tsx",{"react/jsx-runtime":jsx,"next/navigation":{redirect},"@/components/auth-form":{},"@/lib/auth":{getCurrentProfile:async()=>({rol})},"@/lib/roles":{ROLE_PATHS:paths},"@/lib/auth-flow":flow});
 await assert.rejects(()=>page.default({searchParams:Promise.resolve({})}),{message:paths[rol]});
});for (const scenario of ["valid","expired","reused","missing-intent","missing-code","signup","no-session","claims-error","wrong-user","provider-error","legacy-token","network"]) test('callback PKCE '+scenario,async()=>{
 let granted=0,exchanges=0,cleared=0,notify;
 const route=load("../src/app/auth/recovery/route.ts",{
 "next/server":{NextResponse:{redirect:(url,options)=>{assert.equal(options.headers["Cache-Control"],"no-store");assert.equal(options.headers["Referrer-Policy"],"no-referrer");return url.toString();}}},
 "@/lib/auth-flow":flow,
 "@/lib/recovery":{clearRecovery:async()=>{cleared++;},consumeRecoveryIntent:async state=>state==="intent"&&scenario!=="missing-intent",grantRecovery:async(u,s)=>{assert.equal(u,"u");assert.equal(s,"sid");granted++;}},
 "@/lib/supabase/server":{createClient:async()=>({auth:{onAuthStateChange:fn=>{notify=fn;return {data:{subscription:{unsubscribe(){}}}};},exchangeCodeForSession:async(code,options)=>{exchanges++;assert.equal(code,"synthetic-code");assert.deepEqual(options,{flowId:"synthetic-flow"});if(scenario==="network")throw Error("unavailable");notify(scenario==="signup"?"SIGNED_IN":"PASSWORD_RECOVERY");return {error:["expired","reused"].includes(scenario)?{}:null,data:{redirectType:scenario==="signup"?null:"recovery",user:{id:"u"},session:scenario==="no-session"?null:{}}};},getClaims:async()=>({error:scenario==="claims-error"?{}:null,data:{claims:{sub:scenario==="wrong-user"?"other":"u",session_id:"sid"}}})}})}
 });
 const url=new URL("https://untrusted.example/auth/recovery?state=intent&code=synthetic-code&sb_flow_id=synthetic-flow&type=recovery&next=https://untrusted.example");
 if(scenario==="missing-code")url.searchParams.delete("code");
 if(scenario==="provider-error")url.searchParams.set("error_code","otp_expired");
 if(scenario==="legacy-token")url.searchParams.set("token_hash","synthetic");
 const result=await route.GET({nextUrl:url});
 assert.equal(result,flow.authOrigin()+"/restablecer-contrasena"+(scenario==="valid"?"":"?error=enlace"));
 assert.equal(granted,scenario==="valid"?1:0);assert.equal(cleared,1);
 if(["missing-intent","missing-code","provider-error","legacy-token"].includes(scenario))assert.equal(exchanges,0);
});

test("intenci?n firmada: coincidencia, consumo, manipulaci?n, caducidad y nueva solicitud",async()=>{
 const crypto=await import("node:crypto");const jar=new Map();process.env.AUTH_RECOVERY_SECRET="c".repeat(64);
 const recovery=load("../src/lib/recovery.ts",{"node:crypto":crypto,"next/headers":{cookies:async()=>({get:n=>jar.has(n)?{value:jar.get(n)}:undefined,set:(n,v,o)=>{assert.equal(o.httpOnly,true);jar.set(n,v);},delete:n=>jar.delete(n)})}});
 const nonce=await recovery.beginRecovery();assert.equal(await recovery.consumeRecoveryIntent(nonce),true);assert.equal(await recovery.consumeRecoveryIntent(nonce),false);
 const old=await recovery.beginRecovery();await recovery.beginRecovery();assert.equal(await recovery.consumeRecoveryIntent(old),false);
 const altered=await recovery.beginRecovery();jar.set("liga-recovery-intent",jar.get("liga-recovery-intent")+"x");assert.equal(await recovery.consumeRecoveryIntent(altered),false);
 const expired=await recovery.beginRecovery();const now=Date.now;Date.now=()=>now()+3600001;try{assert.equal(await recovery.consumeRecoveryIntent(expired),false);}finally{Date.now=now;}
 await recovery.grantRecovery("u","s");await recovery.beginRecovery();assert.equal(await recovery.hasRecovery("u","s"),false);
});

for(const scenario of ["ordinary-session","valid","claims-error","wrong-user","no-user"])test('pantalla de cambio '+scenario,async()=>{
 const page=load("../src/app/restablecer-contrasena/page.tsx",{"react/jsx-runtime":jsx,"next/link":{default:props=>jsx.jsx("a",props)},"@/components/auth-form":{AuthForm:()=>jsx.jsx("form",{id:"reset-form"})},"@/lib/auth-flow":flow,"@/lib/recovery":{hasRecovery:async()=>scenario!=="ordinary-session"},"@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({data:{user:scenario==="no-user"?null:{id:"u"}},error:null}),getClaims:async()=>({error:scenario==="claims-error"?{}:null,data:{claims:{sub:scenario==="wrong-user"?"other":"u",session_id:"sid"}}})}})}});
 const html=renderToStaticMarkup(await page.default({searchParams:Promise.resolve({})}));assert.equal(html.includes('id="reset-form"'),scenario==="valid");
});


test("SDK SSR real: correo predeterminado PKCE, cookies, evento y updateUser sin red",async()=>{
 const {createServerClient}=await import("@supabase/ssr");
 const {createHash}=await import("node:crypto");
 const jar=new Map();let challenge,redirectTo,consumed=false,updated=false;
 const user={id:"00000000-0000-0000-0000-000000000001",aud:"authenticated",role:"authenticated",email:"synthetic@example.org",app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
 const payload={sub:user.id,session_id:"synthetic-session",aud:"authenticated",exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)};
 const token=[{alg:"HS256",typ:"JWT"},payload].map(v=>Buffer.from(JSON.stringify(v)).toString("base64url")).join(".")+"."+Buffer.from("synthetic-signature").toString("base64url");
 const make=()=>createServerClient("https://synthetic.supabase.co","synthetic-anon",{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>value?jar.set(name,value):jar.delete(name))},global:{fetch:async(input,options)=>{
 const url=new URL(input);const body=JSON.parse(options.body||"{}");
 if(url.pathname.endsWith("/recover")){challenge=body.code_challenge;redirectTo=new URL(url.searchParams.get("redirect_to"));assert.equal(body.code_challenge_method,"s256");return Response.json({});}
 if(url.pathname.endsWith("/token")){
 assert.equal(url.searchParams.get("grant_type"),"pkce");assert.equal(body.auth_code,"synthetic-code");assert.equal(createHash("sha256").update(body.code_verifier).digest("base64url"),challenge);
 if(consumed)return Response.json({code:"otp_expired",msg:"Invalid code"},{status:400});consumed=true;
 return Response.json({user,access_token:token,refresh_token:"synthetic-refresh",token_type:"bearer",expires_in:3600});}
 if(url.pathname.endsWith("/user")){if(options.method==="PUT"){assert.equal(body.password,"SyntheticPassword123!");updated=true;}return Response.json(user);}
 throw Error("Unexpected synthetic endpoint");
 }}});
 const first=make();assert.equal((await first.auth.resetPasswordForEmail(user.email,{redirectTo:"https://app.example/auth/recovery?state=synthetic-intent"})).error,null);
 assert.equal(redirectTo.pathname,"/auth/recovery");assert.equal(redirectTo.searchParams.get("state"),"synthetic-intent");assert.ok([...jar.keys()].some(k=>k.includes("code-verifier")));
 // ConfirmationURL verification is Supabase's job; simulate its code redirect.
 const callback=make();const events=[];const {data:listener}=callback.auth.onAuthStateChange(e=>{events.push(e);});
 const flowId=redirectTo.searchParams.get("sb_flow_id");const result=await callback.auth.exchangeCodeForSession("synthetic-code",flowId?{flowId}:undefined);
 assert.equal(result.error,null);assert.ok(events.includes("PASSWORD_RECOVERY"));listener.subscription.unsubscribe();
 assert.ok([...jar.keys()].some(k=>k.includes("auth-token")&&!k.includes("code-verifier")));
 const page=make();assert.equal((await page.auth.getUser()).data.user.id,user.id);assert.equal((await page.auth.updateUser({password:"SyntheticPassword123!"})).error,null);assert.equal(updated,true);
 assert.ok((await make().auth.exchangeCodeForSession("synthetic-code",flowId?{flowId}:undefined)).error);
});
