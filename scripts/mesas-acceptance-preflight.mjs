// Inspección local de solo lectura: no conecta a Supabase, no escribe archivos,
// no crea cuentas y no ejecuta SQL. Nunca imprime claves ni credenciales.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));

export function inspectAcceptanceEnvironment({url='',key='',localConfigPresent=false}) {
  const report={backend:'sin_configurar',hostname:null,appAcceptsBackend:false,localConfigPresent,remoteWritesAuthorized:false,blockers:[],manualChecks:[
    'Comprobar que el backend y las tres sesiones pertenecen al entorno de aceptación.',
    'Verificar migraciones instaladas y cuentas Auth con sus perfiles y habilitaciones.',
    'No usar jornada 8 ni Peneca Inicial finalizada como escenario de escritura.',
  ]};
  if(!url || url.includes('TU-PROYECTO') || !key || key==='TU_CLAVE_PUBLICA') {
    report.blockers.push('Falta una configuración pública válida del backend.');return report;
  }
  let target;
  try {target=new URL(url);} catch {report.blockers.push('La URL del backend no es válida.');return report;}
  if(!['http:','https:'].includes(target.protocol) || target.username || target.password) {
    report.blockers.push('La URL debe ser HTTP/HTTPS y no incluir credenciales.');return report;
  }
  report.hostname=target.hostname;
  report.backend=['localhost','127.0.0.1','[::1]'].includes(target.hostname)?'local':'remoto';
  // Ejecuta únicamente el validador puro existente, con un entorno acotado.
  // No cambia process.env ni importa clientes de Supabase.
  const code=ts.transpileModule(fs.readFileSync(path.join(root,'src/lib/config.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const sandbox={exports:{},process:{env:{NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key}}};
  vm.runInNewContext(code,sandbox,{timeout:1000});
  report.appAcceptsBackend=sandbox.exports.supabaseConfigured();
  if(report.backend==='remoto') report.blockers.push('El backend es remoto aunque la aplicación abra en localhost. Las escrituras de aceptación requieren autorización explícita y un proyecto de pruebas identificado.');
  if(!report.appAcceptsBackend) report.blockers.push('El validador actual de la aplicación rechaza esta URL; no se puede completar el inicio de sesión con este backend.');
  if(report.backend==='local' && !localConfigPresent) report.blockers.push('No existe supabase/config.toml en este checkout: falta preparar la pila local completa de Supabase/Auth.');
  return report;
}

export function readPublicSettings(text) {
  const values={};
  for(const line of text.split(/\r?\n/)) {
    const match=line.match(/^\s*(?:export\s+)?(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)\s*=\s*(.*?)\s*$/);
    if(!match) continue;
    let value=match[2];
    if(value.startsWith('"') || value.startsWith("'")) {const quote=value[0],end=value.indexOf(quote,1);value=end<0?'':value.slice(1,end);}
    else value=value.replace(/\s+#.*$/,'').trim();
    values[match[1]]=value;
  }
  return values;
}

if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  const filename=path.join(root,'.env.local');
  const settings=fs.existsSync(filename)?readPublicSettings(fs.readFileSync(filename,'utf8')):{};
  const report=inspectAcceptanceEnvironment({
    url:process.env.NEXT_PUBLIC_SUPABASE_URL??settings.NEXT_PUBLIC_SUPABASE_URL,
    key:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??settings.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    localConfigPresent:fs.existsSync(path.join(root,'supabase/config.toml')),
  });
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(report.blockers.length) process.exitCode=2;
}
