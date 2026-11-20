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
  mod.require = name => { if(name === "@/lib/legal") return {LEGAL_VERSION:"2026-11-19.1"}; assert.ok(Object.hasOwn(mocks, name), name); return mocks[name]; };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const roles = load("../src/lib/roles.ts");
const redirect = path => { throw Error(`redirect:${path}`); };
async function header(profile, authenticated = !!profile) {
  const { Header } = load("../src/components/header.tsx", {
    "react/jsx-runtime": jsx,
    "next/link": { default: ({ children, ...props }) => jsx.jsx("a", { ...props, children }) },
    "next/image": { default: props => jsx.jsx("img", { ...props, priority: undefined }) },
    "@/lib/auth": { getCurrentIdentity: async () => ({ authenticated, profile }) },
    "@/lib/roles": roles,
    "@/app/actions": { logout: "/test-logout" },
    "@/components/auth-refresh": { AuthRefresh: () => null },
  });
  return renderToStaticMarkup(await Header());
}
test("visitante: navegación pública y un solo ingreso, sin registro duplicado", async () => {
  const html = await header(null);
  assert.match(html, /Ingresar/);
  for (const path of ["/", "/calendario", "/ranking", "/login"]) assert.ok(html.includes(`href="${path}"`));
  assert.equal((html.match(/href="\/login"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Cerrar sesión|Mi panel|Registrarse|href="\/registro"/);
  assert.match(html, /logo-liga-los-rios.png/);
});
test("sesión válida sin perfil no muestra acceso ni inventa un rol", async () => {
  const html = await header(null, true);
  assert.match(html, /No se pudo verificar tu perfil/);
  assert.match(html, /href="\/panel"/);
  assert.match(html, /Cerrar sesión/);
  assert.doesNotMatch(html, /Ingresar|Registrarse|Administrador/);
});
for (const rol of roles.ROLES) test(`encabezado autenticado: ${rol}`, async () => {
  const html = await header({ nombre: "Persona <segura>", rol });
  assert.match(html, /Persona &lt;segura&gt;/);
  assert.ok(html.includes(`href="${roles.ROLE_PATHS[rol]}"`));
  assert.match(html, /Mi panel/); assert.match(html, /Cerrar sesión/);
  assert.ok(html.includes('href="/ranking"'));
  assert.doesNotMatch(html, /Ingresar|Registrarse/);
  assert.match(html, /action="\/test-logout"/);
});
function authHarness({ claims = { sub: "real", user_metadata: { rol: "administrador" } }, claimError = null, profile = { id: "real", nombre_completo: "Nombre real", rol: "jugador" }, profileError = null } = {}) {
  const filters = [];
  const client = { rpc: async () => ({ data: { aceptada: true, version: "2026-11-19.1" }, error: null }), auth: { getClaims: async () => ({ data: { claims }, error: claimError }) }, from(table) {
    assert.equal(table, "perfiles");
    return { select(cols) { assert.equal(cols, "id, nombre_completo, rol, arbitraje_habilitado"); return this; }, eq(k,v) { filters.push([k,v]); return this; }, single: async () => ({ data: profile, error: profileError }) };
  } };
  return { filters, auth: load("../src/lib/auth.ts", { "next/navigation": { redirect }, "@/lib/supabase/server": { createClient: async () => client }, "@/lib/roles": roles, "@/lib/config": { supabaseConfigured: () => true } }) };
}
test("rol proviene de perfiles, ignora metadatos manipulables", async () => {
  const h = authHarness(); assert.equal((await h.auth.getCurrentProfile()).rol, "jugador"); assert.deepEqual(h.filters, [["id", "real"]]);
});

test("Jugador habilitado abre arbitraje sin cambiar su rol ni sesión", async () => {
  const h = authHarness({ profile: { id: "real", nombre_completo: "Titular", rol: "jugador", arbitraje_habilitado: true } });
  assert.equal((await h.auth.requireRole("jugador")).rol, "jugador");
  assert.equal((await h.auth.requireRole("arbitro")).rol, "jugador");
  await assert.rejects(() => h.auth.requireRole("juez_general"), /redirect:\/panel\/jugador/);
  await assert.rejects(() => h.auth.requireRole("administrador"), /redirect:\/panel\/jugador/);
});

for (const rol of ["jugador", "arbitro"]) test(`habilitación revocada bloquea URL arbitral: ${rol}`, async () => {
  const h = authHarness({ profile: { id: "real", nombre_completo: "Titular", rol, arbitraje_habilitado: false } });
  await assert.rejects(() => h.auth.requireRole("arbitro"), /redirect:\/panel\/jugador/);
});

test("metadatos no permiten habilitar arbitraje", async () => {
  const h = authHarness({ claims: { sub: "real", user_metadata: { arbitraje_habilitado: true } } });
  assert.equal((await h.auth.getCurrentProfile()).arbitrajeHabilitado, false);
  await assert.rejects(() => h.auth.requireRole("arbitro"), /redirect:\/panel\/jugador/);
});
for (const opts of [{ claims: null }, { claimError: {} }, { profile: null }, { profileError: {} }, { profile: { rol: "inventado" } }]) test(`sesión/perfil inválido falla cerrado ${JSON.stringify(opts)}`, async () => assert.equal(await authHarness(opts).auth.getCurrentProfile(), null));
for (const rol of roles.ROLES) test(`autorización servidor redirige al panel real de ${rol}`, async () => {
  const { auth } = authHarness({ profile: { id: "real", nombre_completo: "Nombre", rol, arbitraje_habilitado: rol === "arbitro" } });
  assert.equal((await auth.requireRole(rol)).rol, rol);
  const other = roles.ROLES.find(r => r !== rol);
  await assert.rejects(() => auth.requireRole(other), { message: `redirect:${roles.ROLE_PATHS[rol]}` });
});
function actionsHarness(error) {
  const calls = [];
  return { calls, actions: load("../src/app/actions.ts", {
    "next/navigation": { redirect }, "next/cache": { revalidatePath: (...args) => calls.push(args) },
    "@/lib/auth": {}, "@/lib/auth-flow": {}, "@/lib/config": { supabaseConfigured: () => true },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { signOut: async () => { calls.push("signOut"); return { error }; } } }) },
  }) };
}
test("salida invalida sesión real antes de revalidar y redirigir", async () => {
  const h = actionsHarness(null); await assert.rejects(() => h.actions.logout(), { message: "redirect:/" });
  assert.deepEqual(h.calls, ["signOut", ["/", "layout"]]);
  assert.doesNotMatch(await header(null), /Cerrar sesión/);
});
test("fallo de cierre no anuncia salida exitosa", async () => {
  const h = actionsHarness({ message: "error privado" });
  await assert.rejects(() => h.actions.logout(), { message: "redirect:/login?error=cierre" }); assert.deepEqual(h.calls, ["signOut"]);
});
test("eventos Auth refrescan servidor y limpian suscripción", () => {
  let callback, cleanup, focus; const calls = [];
  const oldWindow = globalThis.window;
  globalThis.window = { addEventListener: (event, fn) => { assert.equal(event, "focus"); focus = fn; }, removeEventListener: (event, fn) => { assert.equal(event, "focus"); assert.equal(fn, focus); calls.push("remove"); } };
  try {
    const { AuthRefresh } = load("../src/components/auth-refresh.tsx", {
      react: { useEffect: fn => { cleanup = fn(); } }, "next/navigation": { useRouter: () => ({ refresh: () => calls.push("refresh") }) },
      "@/lib/config": { supabaseConfigured: () => true },
      "@/lib/supabase/client": { createClient: () => ({ auth: { onAuthStateChange: fn => { callback = fn; return { data: { subscription: { unsubscribe: () => calls.push("unsubscribe") } } }; } } }) },
    });
    assert.equal(AuthRefresh(), null); callback("INITIAL_SESSION"); assert.deepEqual(calls, []);
    for (const event of ["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"]) callback(event);
    focus(); cleanup(); assert.deepEqual(calls, ["refresh", "refresh", "refresh", "refresh", "unsubscribe", "remove"]);
  } finally { globalThis.window = oldWindow; }
});

