import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectAcceptanceEnvironment,readPublicSettings} from '../scripts/mesas-acceptance-preflight.mjs';

test('preflight distingue frontend local de backend remoto y no autoriza escrituras',()=>{
  const report=inspectAcceptanceEnvironment({url:'https://aceptacion-ejemplo.supabase.co',key:'publica-de-fixture'});
  assert.equal(report.backend,'remoto');assert.equal(report.appAcceptsBackend,true);assert.equal(report.remoteWritesAuthorized,false);
  assert.ok(report.blockers.some(b=>b.includes('remoto')));assert.ok(!JSON.stringify(report).includes('publica-de-fixture'));
});
test('preflight identifica el bloqueo real de Supabase local sin alterar la configuración',()=>{
  const before={...process.env};
  for(const host of ['127.0.0.1','localhost','[::1]']) {
    const report=inspectAcceptanceEnvironment({url:`http://${host}:54321`,key:'publica-de-fixture'});
    assert.equal(report.backend,'local');assert.equal(report.appAcceptsBackend,false);
    assert.ok(report.blockers.some(b=>b.includes('rechaza')));assert.ok(report.blockers.some(b=>b.includes('config.toml')));
  }
  assert.deepEqual({...process.env},before);
});
test('preflight no confunde localhost dentro de un nombre remoto con loopback',()=>{
  const report=inspectAcceptanceEnvironment({url:'https://localhost.ejemplo.supabase.co',key:'publica-de-fixture'});
  assert.equal(report.backend,'remoto');assert.equal(report.remoteWritesAuthorized,false);
});
test('preflight rechaza configuración ausente, URL inválida y credenciales en URL sin exponerlas',()=>{
  for(const values of [{},{url:'incorrecta',key:'fixture'},{url:'https://usuario:secreto@ejemplo.supabase.co',key:'fixture'},{url:'file:///tmp/fixture',key:'fixture'}]) {
    const report=inspectAcceptanceEnvironment(values);assert.ok(report.blockers.length);assert.ok(!JSON.stringify(report).includes('secreto'));assert.equal(report.remoteWritesAuthorized,false);
  }
});
test('lector admite solo URL y clave pública, sin evaluar ni devolver otros secretos',()=>{
  const settings=readPublicSettings('NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321" # local\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=publica # comentario\nSUPABASE_SERVICE_ROLE_KEY=secreto\nPASSWORD=secreto');
  assert.deepEqual(settings,{NEXT_PUBLIC_SUPABASE_URL:'http://localhost:54321',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'publica'});
  assert.ok(!JSON.stringify(settings).includes('secreto'));
});
