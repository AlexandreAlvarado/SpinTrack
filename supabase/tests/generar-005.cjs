// Generador reproducible desde la revisión histórica instalada; no usa red.
const fs = require('node:fs');
const cp = require('node:child_process');
const old = cp.execFileSync('git',['show','829a9c6:supabase/migrations/004_inscripciones.sql'],{encoding:'utf8'});
const read = name => fs.readFileSync(`supabase/migrations/${name}`,'utf8').replace(/\r\n/g,'\n');
const extract = (sql, name) => {
  const start = sql.search(new RegExp(`create (?:or replace )?function ${name.replaceAll('.','\\.')}\\(`,'i'));
  if(start<0) throw Error(name);
  return sql.slice(start,sql.indexOf('$$;',start)+3);
};
const names=['public.validar_competencia_003','privado_inscripciones.validar_inscripcion_004','privado_inscripciones.proteger_cupo_004'];
const before=[extract(read('003_categorias_competencias.sql'),names[0]),extract(old,names[1]),extract(old,names[2])];
const current=read('004_inscripciones.sql');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const rows=before.map((s,i)=>`(${quote(names[i]+'()')},$esperado$${s.split('$$')[1]}$esperado$)`).join(',\n');
let sql=`-- Corrección incremental para 004 histórica del commit 829a9c6.
-- NO reaplicar 004. Sin DML ni limpieza de cupo_maximo. 006: programación deportiva.
-- Comparación deliberadamente estricta: ante deriva, revisar; nunca quitar el guard.
begin;
set local lock_timeout = '5s';
lock table public.competencias, public.inscripciones in access exclusive mode;
do $guard$
declare esperado record; actual record;
begin
  for esperado in select * from (values
${rows}
  ) as v(firma,cuerpo) loop
    select p.*, l.lanname into actual from pg_catalog.pg_proc p
    join pg_catalog.pg_language l on l.oid=p.prolang
    where p.oid=pg_catalog.to_regprocedure(esperado.firma);
    if not found then raise exception '005: falta %', esperado.firma; end if;
    if actual.prosrc is distinct from esperado.cuerpo
      or actual.lanname <> 'plpgsql' or not actual.prosecdef
      or actual.proconfig is distinct from array['search_path=""']::text[]
      or actual.prorettype <> 'pg_catalog.trigger'::regtype
      or actual.provolatile <> 'v' or actual.proisstrict or actual.proleakproof
      or actual.proretset or actual.pronargs <> 0
      or actual.proowner <> (select relowner from pg_catalog.pg_class where oid='public.competencias'::regclass)
      or exists (select 1 from pg_catalog.pg_roles r where r.rolname in ('anon','authenticated','service_role')
         and pg_catalog.has_function_privilege(r.oid,actual.oid,'EXECUTE'))
    then raise exception '005: definición/seguridad inesperada en %. Detener y revisar.', esperado.firma; end if;
  end loop;
  if (select pg_catalog.pg_get_triggerdef(oid) from pg_catalog.pg_trigger
      where tgrelid='public.competencias'::regclass and tgname='c_proteger_cupo')
      is distinct from 'CREATE TRIGGER c_proteger_cupo BEFORE UPDATE ON public.competencias FOR EACH ROW EXECUTE FUNCTION privado_inscripciones.proteger_cupo_004()'
     or not exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.competencias'::regclass
        and tgname='c_proteger_cupo' and tgenabled='O') then
    raise exception '005: trigger de cupo inesperado';
  end if;
end;
$guard$;
`;
for(let i=0;i<2;i++) sql+='\n'+extract(current,names[i]).replace(/^create (?:or replace )?function/,'create or replace function')+'\n';
sql+=`\ndrop trigger c_proteger_cupo on public.competencias;
drop function privado_inscripciones.proteger_cupo_004(); -- RESTRICT implícito, nunca CASCADE.
comment on column public.competencias.cupo_maximo is 'Columna heredada sin efecto deportivo ni límite de inscripción. No configurar ni limpiar automáticamente sus valores.';
comment on table public.inscripciones is 'Sin máximo general de participantes ni pago implícito. Rechazada/cancelada son terminales. Una fila histórica por jugador/competencia.';
commit;
`;
fs.writeFileSync('supabase/migrations/005_eliminar_cupo_maximo.sql',sql);
if(process.argv.includes('--fixture')) fs.writeFileSync('supabase/tests/004_historica.fixture.sql','-- FIXTURE HISTORICO 829a9c6: solo PostgreSQL temporal. NO ejecutar en Supabase.\n'+old);
