-- SOLO cluster temporal local, puerto 55404, BD liga_004_test con 001–004.
-- Fixtures sintéticos persistentes para probar dos conexiones reales con dblink.
-- No ejecutar en Supabase. Eliminar la BD temporal al finalizar, no reutilizarla.
-- Para comparar permisos, el runner captura permisos_previos004 antes de aplicar 004.
-- Requiere rol sintético service_role y la siguiente captura en la misma sesión psql:
-- create temp table permisos_previos004 as
-- select 'tabla'::text tipo,oid,relacl::text acl from pg_class where relnamespace in ('public'::regnamespace,'auth'::regnamespace)
-- union all select 'funcion',oid,proacl::text from pg_proc where pronamespace in ('public'::regnamespace,'auth'::regnamespace)
-- union all select 'esquema',oid,nspacl::text from pg_namespace where nspname in ('public','auth');
\set ON_ERROR_STOP on
do $$ begin
  if current_database()<>'liga_004_test' or current_setting('port')<>'55404'
    or inet_server_addr() <> '127.0.0.1'::inet then
    raise exception 'Prueba exclusiva de BD temporal local';
  end if;
end $$;
create extension dblink;
create function public.check004(ok boolean, etiqueta text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALLO: %',etiqueta; end if; end $$;
create function public.reject004(orden text, codigo text) returns void language plpgsql as $$
begin
  begin execute orden;
  exception when others then
    if sqlstate=codigo then return; end if;
    raise exception 'SQLSTATE esperado %, recibido %: %',codigo,sqlstate,sqlerrm;
  end;
  raise exception 'Se esperaba rechazo: %',orden;
end $$;
insert into auth.users(id,email,raw_user_meta_data) values
 ('e0040000-0000-0000-0000-000000000001','a004@example.invalid','{}'),
 ('e0040000-0000-0000-0000-000000000002','j004@example.invalid','{}'),
 ('e0040000-0000-0000-0000-000000000003','p004@example.invalid','{}'),
 ('e0040000-0000-0000-0000-000000000004','otro004@example.invalid','{}'),
 ('e0040000-0000-0000-0000-000000000005','arb004@example.invalid','{}');
update public.perfiles set rol='administrador' where id='e0040000-0000-0000-0000-000000000001';
update public.perfiles set rol='juez_general' where id='e0040000-0000-0000-0000-000000000002';
update public.perfiles set rol='arbitro' where id='e0040000-0000-0000-0000-000000000005';
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',false);
insert into public.temporadas(id,nombre,anio) values(4004,'Fixture 004',2026);
insert into public.fechas(id,temporada_id,numero,fecha,comuna,recinto,estado)
 values(4004,4004,1,(clock_timestamp() at time zone 'America/Santiago')::date+1,'Prueba','Prueba','publicada');
insert into public.categorias(id,codigo,nombre) overriding system value values(4004,'tc','TC');
insert into public.niveles(id,codigo,nombre) overriding system value values(4004,'aficionado','Aficionado'),(4005,'federado','Federado');
insert into public.reglamentos_temporada(id,temporada_id,version,titulo,referencia_documental,estado_revision,referencia_aprobacion)
 overriding system value values(4004,4004,'test','Fixture','PRIVADO_REGLAMENTO_004','validado','PRIVADO_APROBACION_004');
insert into public.categorias_temporada(id,temporada_id,categoria_id,nivel_id,rama,criterio_nacimiento,reglamento_id)
 overriding system value values(4004,4004,4004,4004,'varones','sin_limite',4004),(4005,4004,4004,4005,'varones','sin_limite',4004);
update public.categorias_temporada set criterio_nacimiento='rango_anios',anio_nacimiento_desde=1990,anio_nacimiento_hasta=2010 where id=4004;
insert into public.competencias(id,temporada_id,fecha_id,categoria_temporada_id,tarifa_clp,cupo_maximo,inscripcion_abre_en,inscripcion_cierra_en)
 overriding system value values(4004,4004,4004,4004,5000,2,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour'),
 (4005,4004,4004,4005,5000,null,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour');
insert into public.jugadores(id,nombre_completo,perfil_id,fecha_nacimiento) overriding system value values
 (4004,'Propio','e0040000-0000-0000-0000-000000000003','2000-01-01'),
 (4005,'Sin cuenta',null,'2000-01-01'),(4006,'Otro','e0040000-0000-0000-0000-000000000004','2000-01-01'),
 (4007,'Cupo A',null,'2000-01-01'),(4008,'Cupo B',null,'2000-01-01');
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',false);
insert into public.competencia_control_deportivo(competencia_id,temporada_id) values(4004,4004),(4005,4004);
insert into public.competencia_formatos_sets(competencia_id,etapa,mejor_de)
 select c,e,3 from unnest(array[4004,4005]) c cross join unnest(array['grupos','previa_cuartos','cuartos','semifinal','final']) e;
update public.competencia_control_deportivo set inicio_programado=
 ((clock_timestamp() at time zone 'America/Santiago')::date+1+time '23:59:59') at time zone 'America/Santiago',
 minimo_participantes=1,grupo_minimo=3,grupo_maximo=4,formato_competencia='grupos_eliminacion_simple',
 reglamento_id=4004,motivo_resolucion='Fixture mínimo excepcional',referencia_resolucion='Fixture',
 configuracion_aprobada=true,estado_deportivo='preparada';
insert into public.habilitaciones_jugador_categoria(jugador_id,categoria_temporada_id,estado,motivo,referencia_evidencia)
 select j,c,'habilitado','PRIVADO_MOTIVO_004','PRIVADO_EVIDENCIA_004' from unnest(array[4004,4005,4006,4007,4008]) j cross join unnest(array[4004,4005]) c;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',false);
update public.competencias set publicada=true,inscripciones_habilitadas=true;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000003"}',true);
select public.solicitar_inscripcion(4004,4004);
select public.solicitar_inscripcion(4004,4005);
select public.check004((select count(*)=2 from public.inscripciones),'Varias categorías individuales en una jornada');
select public.check004((select bool_and(antecedentes::text !~ 'PRIVADO_|e0040000') from public.inscripciones),'Resumen propio sin evidencia ni UUID administrativos');
select public.check004((select bool_and(
 antecedentes=jsonb_build_object('habilitacion',jsonb_build_object('id',antecedentes#>'{habilitacion,id}','estado','habilitado'),
 'categoria',jsonb_build_object('id',antecedentes#>'{categoria,id}','codigo',antecedentes#>'{categoria,codigo}','rama','varones'),
 'reglamento',jsonb_build_object('id',4004,'version','test'),'tarifa_clp',5000,'club_id',null,'localidad_procedencia_id',null)
 ) from public.inscripciones),'Lista cerrada de campos y claves anidadas visibles');
select public.check004((select count(*)=0 from public.inscripciones_historial),'Titular no lee respaldo administrativo propio');
select public.reject004('select * from public.inscripciones','42501');
select public.reject004('select referencia_representacion,referencia_resolucion,motivo,creado_por,actualizado_por from public.inscripciones','42501');
select public.reject004('select public.solicitar_inscripcion(4004,4004)','23505');
select public.reject004('select public.solicitar_inscripcion(4005,4004)','42501');
select public.reject004('select public.solicitar_inscripcion(999999,4004)','42501'); -- misma respuesta que identidad ajena
select public.reject004('select public.solicitar_inscripcion(4004,999999)','23503');
select public.reject004('insert into public.inscripciones(jugador_id,competencia_id) values(4004,4004)','42501');
select public.reject004('delete from public.inscripciones','42501');
select public.reject004('update public.inscripciones set estado=''aceptada''','42501');
select public.reject004('update public.inscripciones_historial set motivo=''alterado''','42501');
select public.check004(not has_function_privilege('anon','public.solicitar_inscripcion(bigint,bigint,text)','execute'),'Anónimo sin RPC');
select public.check004(not has_schema_privilege('authenticated','privado_inscripciones','usage'),'Esquema interno inaccesible');
select public.reject004('select privado_inscripciones.validar_inscripcion_004()','42501');
select public.reject004('select public.resolver_inscripcion(1,''aceptada'',''x'',''x'')','42501');
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000004"}',true);
select public.check004((select count(*)=0 from public.inscripciones),'RLS ajenas');
select public.check004((select count(*)=0 from public.inscripciones_historial),'RLS historial ajeno');
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000005"}',true);
select public.reject004('select public.solicitar_inscripcion(4004,4004)','42501');
select public.check004((select count(*)=0 from public.inscripciones),'Árbitro sin acceso global');
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',true);
select public.reject004('select public.solicitar_inscripcion(4005,4004)','23514');
select public.solicitar_inscripcion(4005,4004,'Solicitud documentada de participante sin cuenta');
select public.reject004('select public.solicitar_inscripcion(4006,4004,''Solicitud'')','23514');
select public.reject004($q$select public.resolver_inscripcion((select id from public.inscripciones where jugador_id=4004 and competencia_id=4004),'aceptada','x','x')$q$,'42501');
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',true);
select public.reject004($q$select public.resolver_inscripcion((select id from public.inscripciones where jugador_id=4004 and competencia_id=4004),'aceptada',null,null)$q$,'23514');
select public.resolver_inscripcion((select id from public.inscripciones where jugador_id=4004 and competencia_id=4004),'aceptada','Revisión combinaciones jornada y elegibilidad','Resolución fixture');
select public.resolver_inscripcion((select id from public.inscripciones where jugador_id=4005),'rechazada','Resolución fixture','Fixture');
select public.reject004($q$select public.resolver_inscripcion((select id from public.inscripciones where jugador_id=4005),'aceptada','x','x')$q$,'42501');
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',true);
select public.resolver_inscripcion((select id from public.inscripciones where jugador_id=4004 and competencia_id=4004),'cancelada','Decisión externa documentada','Resolución fixture');
select public.reject004('select public.solicitar_inscripcion(4004,4004,''Solicitud'')','23505');
select public.solicitar_inscripcion(4006,4004,'Solicitud fixture');
select public.check004((select count(*)=7 from public.inscripciones_historial),'Historial de solicitud y decisiones');
select public.check004(exists(select 1 from public.inscripciones_historial where antecedentes#>>'{reglamento,referencia_documental}'='PRIVADO_REGLAMENTO_004'
 and antecedentes#>>'{habilitacion,referencia_evidencia}'='PRIVADO_EVIDENCIA_004'), 'Administración conserva evidencia completa');
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',true);
select public.check004((select count(*)=7 from public.inscripciones_historial),'Juez conserva acceso a respaldo administrativo');
reset role;
select public.reject004('delete from public.jugadores where id=4004','23001');
select public.reject004('delete from public.competencias where id=4004','23001');
rollback;

-- La identidad deportiva es independiente del cargo: solo solicitudes propias.
begin;
update public.jugadores set perfil_id='e0040000-0000-0000-0000-000000000005' where id=4004;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000005"}',true);
select public.solicitar_inscripcion(4004,4004);
select public.check004((select count(*)=1 from public.inscripciones),'Árbitro vinculado solicita y lee inscripción propia');
select public.reject004('select public.solicitar_inscripcion(4005,4004,''Representación inventada'')','42501');
select public.reject004($q$select public.resolver_inscripcion((select id from public.inscripciones),'aceptada','x','x')$q$,'42501');
with intento as (update public.jugadores set perfil_id=auth.uid() where id=4005 returning id)
 select public.check004((select count(*)=0 from intento),'Árbitro no puede vincular identidad ajena mediante RLS');
rollback;
begin;
update public.jugadores set perfil_id='e0040000-0000-0000-0000-000000000002' where id=4004;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',true);
select public.solicitar_inscripcion(4004,4004);
select public.reject004('select public.solicitar_inscripcion(4005,4004,''Representación inventada'')','42501');
rollback;

-- Auditoría de todas las funciones privilegiadas de 001–004: los triggers no son RPC.
select public.check004(not exists(
 select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','privado_inscripciones') and p.prosecdef
 and not exists(select 1 from pg_depend dep where dep.classid='pg_proc'::regclass and dep.objid=p.oid and dep.deptype='e') -- excluir funciones de extensión dblink del fixture
 and not coalesce(p.proconfig @> array['search_path=""'],false)
),'SECURITY DEFINER con search_path vacío');
select public.check004(not exists(
 select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','privado_inscripciones') and p.prosecdef
 and p.prorettype='trigger'::regtype
 and (has_function_privilege('authenticated',p.oid,'execute') or has_function_privilege('anon',p.oid,'execute'))
),'Ningún trigger privilegiado invocable por clientes');
select public.check004(not exists(
 select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='privado_inscripciones' or (n.nspname='public' and p.proname in ('solicitar_inscripcion','resolver_inscripcion')))
 and (p.proowner <> (select relowner from pg_class where oid='public.inscripciones'::regclass)
 or p.provolatile<>'v' or has_function_privilege('anon',p.oid,'execute'))
),'Funciones 004 con propietario de confianza y sin acceso anónimo');
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  perform public.check004(not has_function_privilege('service_role','public.solicitar_inscripcion(bigint,bigint,text)','execute')
   and not has_function_privilege('service_role','public.resolver_inscripcion(bigint,text,text,text)','execute')
   and not has_table_privilege('service_role','public.inscripciones','insert'), 'Sin vía alternativa service_role');
 end if;
end $$;
-- Comparación exacta de ACL de objetos previos: 004 no toca Auth ni permisos 001–003.
do $$ begin
 if to_regclass('pg_temp.permisos_previos004') is null then
  raise exception 'Runner debe capturar permisos_previos004 antes de aplicar 004';
 end if;
 perform public.check004(not exists(
  select 1 from pg_temp.permisos_previos004 a left join (
   select 'tabla'::text tipo,oid,relacl::text acl from pg_class
   union all select 'funcion',oid,proacl::text from pg_proc
   union all select 'esquema',oid,nspacl::text from pg_namespace
  ) b on (a.tipo,a.oid)=(b.tipo,b.oid) where b.oid is null or a.acl is distinct from b.acl
 ), 'ACL anteriores intactas, incluidas las de service_role');
end $$;
begin;
set local role service_role;
select public.reject004('select public.solicitar_inscripcion(4004,4004)','42501');
select public.reject004('select public.resolver_inscripcion(1,''aceptada'',''x'',''x'')','42501');
select public.reject004('select antecedentes from public.inscripciones','42501');
select public.reject004('select antecedentes from public.inscripciones_historial','42501');
select public.reject004('select privado_inscripciones.historial_inscripcion_004()','42501');
rollback;
begin;
set local role anon;
select public.reject004('select public.solicitar_inscripcion(4004,4004)','42501');
select public.reject004('select public.resolver_inscripcion(1,''aceptada'',''x'',''x'')','42501');
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claims','{}',true);
select public.reject004('select public.solicitar_inscripcion(4004,4004)','42501');
select public.reject004('select public.resolver_inscripcion(1,''aceptada'',''x'',''x'')','42501');
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000003","role":"administrador","user_metadata":{"rol":"administrador"}}',true);
create temporary table jugadores(id bigint,perfil_id uuid);
insert into pg_temp.jugadores values(4005,auth.uid());
create function pg_temp.es_administrador() returns boolean language sql as 'select true';
set local search_path=pg_temp,public;
select public.reject004('select public.solicitar_inscripcion(4005,4004,''Falso'')','42501');
select public.reject004('select public.resolver_inscripcion(1,''aceptada'',''Falso'',''Falso'')','42501');
select public.reject004('update public.inscripciones set creado_en=clock_timestamp()-interval ''1 day''','42501');
rollback;
-- PostgREST ejecuta GET en transacción de solo lectura; estas RPC son VOLATILE.
begin read only;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000003"}',true);
select public.reject004('select public.solicitar_inscripcion(4004,4004)','25006');
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',true);
select public.reject004('select public.resolver_inscripcion(999999,''aceptada'',''Fixture'',''Fixture'')','25006');
rollback;

-- Casos independientes: modificar fixtures únicamente dentro de subtransacciones.
-- Solicitudes creadas antes del cierre REAL; ambas reservan el cupo completo.
begin;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',true);
update public.competencias set publicada=false,inscripciones_habilitadas=false where id=4004;
update public.competencias set inscripcion_cierra_en=clock_timestamp()+interval '1 second' where id=4004;
update public.competencias set publicada=true,inscripciones_habilitadas=true where id=4004;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000003"}',true);
select public.solicitar_inscripcion(4004,4004);
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000004"}',true);
select public.solicitar_inscripcion(4006,4004);
select pg_sleep(1.2);
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',true);
select public.reject004('select public.solicitar_inscripcion(4005,4004,''Solicitud tardía'')','23514');
update public.competencias set inscripciones_habilitadas=false where id=4004;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',true);
select public.reject004($q$select public.resolver_inscripcion((select id from public.inscripciones where jugador_id=4004),'aceptada',' ',null)$q$,'23514');
update public.habilitaciones_jugador_categoria set estado='pendiente' where jugador_id=4004;
select public.reject004($q$select public.resolver_inscripcion((select id from public.inscripciones where jugador_id=4004),'aceptada','Revisión','Fixture')$q$,'23514');
update public.habilitaciones_jugador_categoria set estado='habilitado' where jugador_id=4004;
select public.resolver_inscripcion((select id from public.inscripciones where jugador_id=4004),'aceptada','Revisión vigente posterior al cierre','Fixture');
select public.resolver_inscripcion((select id from public.inscripciones where jugador_id=4006),'rechazada','Revisión posterior al cierre','Fixture');
select public.check004((select creado_en>=solicitud_abre_en and creado_en<solicitud_cierra_en
 and actualizado_en>=solicitud_cierra_en and estado='aceptada' from public.inscripciones where jugador_id=4004),'Acepta después del cierre original con cupo reservado');
select public.reject004('select public.resolver_inscripcion(999999,''aceptada'',''Fixture'',''Fixture'')','23503');
select public.reject004('select public.resolver_inscripcion(999999,null,''Fixture'',''Fixture'')','42501');
select public.reject004('select public.resolver_inscripcion(999999,''cancelada'',''Fixture'',''Fixture'')','42501');
rollback;

-- El estado deportivo efectivo también bloquea la aceptación aunque el horario sea futuro.
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000003"}',true);
select public.solicitar_inscripcion(4004,4004);
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',true);
update public.competencias set inscripciones_habilitadas=false where id=4004;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',true);
update public.competencia_control_deportivo set estado_deportivo='en_curso' where competencia_id=4004;
select public.reject004($q$select public.resolver_inscripcion((select id from public.inscripciones),'aceptada','Fixture','Fixture')$q$,'23514');
update public.competencia_control_deportivo set estado_deportivo='finalizada' where competencia_id=4004;
select public.reject004($q$select public.resolver_inscripcion((select id from public.inscripciones),'aceptada','Fixture','Fixture')$q$,'23514');
rollback;

-- La hora alcanzada bloquea aun cuando el estado siga siendo preparada.
begin;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000003"}',true);
select public.solicitar_inscripcion(4004,4004);
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',true);
update public.competencias set publicada=false,inscripciones_habilitadas=false where id=4004;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',true);
update public.competencia_control_deportivo set configuracion_aprobada=false,estado_deportivo='pendiente' where competencia_id=4004;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',true);
-- La otra competencia mantiene aprobaciones; no cambiar su fecha. Usar jornada separada.
insert into public.fechas(id,temporada_id,numero,fecha,comuna,recinto,estado)
 values(4006,4004,2,(clock_timestamp() at time zone 'America/Santiago')::date,'Fixture','Fixture','publicada');
-- La identidad de competencia no es editable por clientes; simular configuración previa
-- en este fixture de propietario, manteniendo FK válidas y las reglas 003 activas.
update public.competencias set fecha_id=4006,inscripcion_abre_en=clock_timestamp()-interval '2 hours',inscripcion_cierra_en=clock_timestamp()-interval '1 hour' where id=4004;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',true);
update public.competencia_control_deportivo set inicio_programado=clock_timestamp()-interval '1 second',configuracion_aprobada=true,estado_deportivo='preparada' where competencia_id=4004;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',true);
update public.competencias set publicada=true where id=4004;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',true);
select public.reject004($q$select public.resolver_inscripcion((select id from public.inscripciones),'aceptada','Fixture','Fixture')$q$,'23514');
rollback;

create function public.caso004(cambio text, esperado text) returns void language plpgsql as $$
begin
  begin
    execute cambio;
    perform set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000003"}',true);
    perform public.reject004('select public.solicitar_inscripcion(4004,4004)',esperado);
    raise exception 'rollback fixture' using errcode='P0002';
  exception when no_data_found then null;
  end;
end $$;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',false);
select public.caso004('update public.competencias set inscripciones_habilitadas=false where id=4004','23514');
select public.caso004('update public.competencias set inscripciones_habilitadas=false,publicada=false,activo=false where id=4004','23514');
select public.caso004($q$update public.competencias set inscripciones_habilitadas=false,publicada=false where id=4004;
 select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',true);
 update public.competencia_control_deportivo set configuracion_aprobada=false,estado_deportivo='pendiente' where competencia_id=4004$q$,'23514');
select public.caso004('update public.jugadores set activo=false where id=4004','23514');
select public.caso004('update public.jugadores set perfil_id=null where id=4004','42501');
select public.caso004('update public.jugadores set fecha_nacimiento=''2015-01-01'' where id=4004','23514');
select public.caso004($q$update public.competencias set publicada=false,inscripciones_habilitadas=false where id=4004;
 update public.competencias set inscripcion_abre_en=clock_timestamp()+interval '10 minutes' where id=4004;
 update public.competencias set publicada=true,inscripciones_habilitadas=true where id=4004$q$,'23514');
select public.caso004($q$update public.competencias set publicada=false,inscripciones_habilitadas=false where id=4004;
 update public.competencias set inscripcion_cierra_en=clock_timestamp()-interval '1 second' where id=4004;
 update public.competencias set publicada=true,inscripciones_habilitadas=true where id=4004$q$,'23514');
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',false);
select public.caso004('update public.habilitaciones_jugador_categoria set estado=''pendiente'' where jugador_id=4004','23514');
select public.caso004('update public.habilitaciones_jugador_categoria set estado=''no_habilitado'' where jugador_id=4004','23514');
-- Excepción documentada vigente permite nacimiento fuera de rango, sin inventarlo.
begin;
update public.habilitaciones_jugador_categoria set tipo_resolucion='excepcion_documentada',motivo='Resolución fixture',referencia_evidencia='Fixture excepcional' where jugador_id=4004;
update public.jugadores set fecha_nacimiento='2015-01-01' where id=4004;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000003"}',true);
select public.solicitar_inscripcion(4004,4004);
select public.check004((select antecedentes#>>'{habilitacion,estado}'='habilitado' and not (antecedentes->'habilitacion' ? 'tipo_resolucion') from public.inscripciones),'Resumen no divulga tipo de excepción');
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000002"}',true);
select public.check004((select antecedentes#>>'{habilitacion,tipo_resolucion}'='excepcion_documentada' from public.inscripciones_historial),'Respaldo de excepción documentada solo para operador');
rollback;

begin isolation level repeatable read;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000003"}',true);
select public.reject004('select public.solicitar_inscripcion(4004,4004)','25000');
rollback;

-- Concurrencia real: la primera conexión conserva el bloqueo sin confirmar.
-- La segunda no debe terminar hasta commit; tras esperar debe contar el cupo nuevo.
select dblink_connect('a','host=127.0.0.1 port=55404 dbname=liga_004_test user=postgres');
select dblink_connect('b','host=127.0.0.1 port=55404 dbname=liga_004_test user=postgres');
select dblink_exec('a','begin');
select * from dblink('a',$q$select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',false)$q$) as x(v text);
select * from dblink('b',$q$select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',false)$q$) as x(v text);
-- Llenar uno de los dos cupos y disputar el último.
select set_config('request.jwt.claims','{"sub":"e0040000-0000-0000-0000-000000000001"}',false);
select public.solicitar_inscripcion(4005,4004,'Fixture');
select * from dblink('a',$q$select public.solicitar_inscripcion(4007,4004,'Fixture A')$q$) as x(id bigint);
select dblink_send_query('b',$q$select public.solicitar_inscripcion(4008,4004,'Fixture B')$q$);
select pg_sleep(0.2);
select public.check004(dblink_is_busy('b')=1,'Segundo escritor espera bloqueo');
select dblink_exec('a','commit');
select * from dblink_get_result('b',false) as x(id bigint);
select public.check004(dblink_error_message('b') like '%Cupo agotado%','Segundo escritor rechaza sobrecupo tras commit');
select public.check004((select count(*)=2 from public.inscripciones where competencia_id=4004),'Cupo exacto tras concurrencia');
select public.reject004($q$update public.competencias set publicada=false,inscripciones_habilitadas=false where id=4004;
 update public.competencias set cupo_maximo=1 where id=4004$q$,'23514');
-- Volver a usar las conexiones para probar cierre DURANTE la espera del bloqueo.
select * from dblink_get_result('b',false) as x(id bigint);
update public.competencias set publicada=false,inscripciones_habilitadas=false where id=4005;
update public.competencias set inscripcion_cierra_en=clock_timestamp()+interval '1 second' where id=4005;
update public.competencias set publicada=true,inscripciones_habilitadas=true where id=4005;
select dblink_exec('a','begin');
select * from dblink('a',$q$select public.solicitar_inscripcion(4007,4005,'Fixture plazo A')$q$) as x(id bigint);
select dblink_send_query('b',$q$select public.solicitar_inscripcion(4008,4005,'Fixture plazo B')$q$);
select pg_sleep(1.2);
select public.check004(dblink_is_busy('b')=1,'Inscripción espera hasta después del cierre');
select dblink_exec('a','commit');
select * from dblink_get_result('b',false) as x(id bigint);
select public.check004(dblink_error_message('b') like '%Fuera del período%','Reloj se evalúa después del bloqueo');
select public.check004((select count(*)=1 from public.inscripciones where competencia_id=4005),'Solicitud tardía no persiste');
select dblink_disconnect('a');
select dblink_disconnect('b');
select 'Pruebas 004 completadas' as resultado;
