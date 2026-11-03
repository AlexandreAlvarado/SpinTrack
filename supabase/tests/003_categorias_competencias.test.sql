-- Solo BD AISLADA DE PRUEBAS con 001, 002 y 003 aplicadas y temporadas 2026/2027 libres.
-- psql -X -v ON_ERROR_STOP=1 -f supabase/tests/003_categorias_competencias.test.sql
-- Los registros siguientes son fixtures transaccionales, NO semillas para Supabase.
-- ROLLBACK revierte todo; los contadores identity pueden avanzar.
begin;
set local timezone = 'America/Santiago';

create temporary table resultados_003 (prueba text not null);
create temporary table ids_003 (clave text primary key, id bigint not null);
grant select, insert on resultados_003, ids_003 to authenticated;

create function pg_temp.id003(k text) returns bigint language sql as $$
  select id from pg_temp.ids_003 where clave = k;
$$;
create function pg_temp.comprobar003(condicion boolean, etiqueta text) returns void language plpgsql as $$
begin
  if condicion is distinct from true then raise exception 'FALLO: %', etiqueta; end if;
  insert into pg_temp.resultados_003 values (etiqueta);
end;
$$;
create function pg_temp.rechazar003(orden text, estados text[], etiqueta text) returns void language plpgsql as $$
declare rechazado boolean := false;
begin
  begin execute orden;
  exception when others then
    if not (sqlstate = any(estados)) then
      raise exception 'FALLO %: SQLSTATE inesperado %, %', etiqueta, sqlstate, sqlerrm;
    end if;
    rechazado := true;
  end;
  perform pg_temp.comprobar003(rechazado, etiqueta);
end;
$$;

do $$
begin
  if exists (select 1 from auth.users where id in (
    'e0030000-0000-0000-0000-000000000001','e0030000-0000-0000-0000-000000000002',
    'e0030000-0000-0000-0000-000000000003','e0030000-0000-0000-0000-000000000004'))
    or exists (select 1 from public.temporadas where anio in (2026,2027)) then
    raise exception 'Fixtures ocupados. Ejecutar únicamente en una base de pruebas vacía';
  end if;
end;
$$;

insert into auth.users(id,email,raw_user_meta_data) values
 ('e0030000-0000-0000-0000-000000000001','admin-003@example.invalid','{"full_name":"Admin 003"}'),
 ('e0030000-0000-0000-0000-000000000002','juez-003@example.invalid','{"full_name":"Juez 003"}'),
 ('e0030000-0000-0000-0000-000000000003','arbitro-003@example.invalid','{"full_name":"Arbitro 003"}'),
 ('e0030000-0000-0000-0000-000000000004','jugador-003@example.invalid','{"full_name":"Jugador 003"}');
update public.perfiles set rol='administrador' where id='e0030000-0000-0000-0000-000000000001';
update public.perfiles set rol='juez_general' where id='e0030000-0000-0000-0000-000000000002';
update public.perfiles set rol='arbitro' where id='e0030000-0000-0000-0000-000000000003';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e0030000-0000-0000-0000-000000000001","role":"authenticated"}',true);
with x as (insert into public.temporadas(nombre,anio) values('Prueba 003 2026',2026) returning id)
  insert into ids_003 select 't26',id from x;
with x as (insert into public.temporadas(nombre,anio) values('Prueba 003 2027',2027) returning id)
  insert into ids_003 select 't27',id from x;
insert into public.categorias(codigo,nombre) values ('peneca','Peneca'),('preinfantil','Preinfantil'),('infantil','Infantil'),('juvenil','Juvenil'),('tc','Todo Competidor');
insert into ids_003 select 'cat_'||codigo,id from public.categorias;
insert into public.niveles(codigo,nombre) values ('inicial','Inicial'),('aficionado','Aficionado'),('federado','Federado'),('unica','Única');
insert into ids_003 select 'nivel_'||codigo,id from public.niveles;
with x as (insert into public.reglamentos_temporada(temporada_id,version,titulo,referencia_documental)
  values(pg_temp.id003('t26'),'prueba','Fixture normativo','Solo prueba') returning id)
  insert into ids_003 select 'r26',id from x;
select pg_temp.comprobar003((select registrado_por=auth.uid() from public.reglamentos_temporada where id=pg_temp.id003('r26')), 'Auditoría deriva del actor autenticado');
select pg_temp.rechazar003($q$update public.reglamentos_temporada set estado_revision='validado' where id=pg_temp.id003('r26')$q$,array['23514'],'Validar reglamento exige referencia de aprobación');
update public.reglamentos_temporada set estado_revision='validado',referencia_aprobacion='Fixture aprobado' where id=pg_temp.id003('r26');
with x as (insert into public.reglamentos_temporada(temporada_id,version,titulo,referencia_documental,estado_revision,referencia_aprobacion)
  values(pg_temp.id003('t27'),'prueba','Fixture 2027','Solo prueba','validado','Fixture aprobado') returning id)
  insert into ids_003 select 'r27',id from x;

-- Las diez combinaciones se verifican en fixtures, sin importación de Excel.
insert into public.categorias_temporada(temporada_id,categoria_id,nivel_id,reglamento_id)
select pg_temp.id003('t26'),c.id,n.id,pg_temp.id003('r26') from public.categorias c cross join public.niveles n
where (c.codigo='peneca' and n.codigo='inicial')
 or (c.codigo in ('preinfantil','infantil','juvenil') and n.codigo in ('inicial','federado'))
 or (c.codigo='tc' and n.codigo in ('aficionado','federado','unica'));
insert into ids_003 select 'ct_'||codigo,id from public.categorias_temporada;
select pg_temp.comprobar003((select count(*)=10 from public.categorias_temporada), 'Se admiten las diez combinaciones individuales');
select pg_temp.rechazar003($q$insert into public.categorias(codigo,nombre) values('dobles','Dobles')$q$,array['23514'],'Modalidad excluida no existe en el catálogo');
select pg_temp.rechazar003($q$insert into public.categorias(codigo,nombre) values('peneca','Repetida')$q$,array['23505'],'Código de categoría único');
select pg_temp.rechazar003($q$insert into public.niveles(codigo,nombre) values('inicial','Repetido')$q$,array['23505'],'Código de nivel único');
select pg_temp.rechazar003($q$insert into public.reglamentos_temporada(temporada_id,version,titulo,referencia_documental) values(pg_temp.id003('t26'),'prueba','Duplicado','Prueba')$q$,array['23505'],'Versión única por temporada');
select pg_temp.rechazar003($q$insert into public.categorias_temporada(temporada_id,categoria_id,nivel_id) values(pg_temp.id003('t26'),pg_temp.id003('cat_peneca'),pg_temp.id003('nivel_federado'))$q$,array['23514'],'Peneca Federado no se inventa como combinación');
select pg_temp.rechazar003($q$insert into public.categorias_temporada(temporada_id,categoria_id,nivel_id) values(pg_temp.id003('t26'),pg_temp.id003('cat_peneca'),pg_temp.id003('nivel_inicial'))$q$,array['23505'],'No duplicar combinación aunque rama sea NULL');
select pg_temp.rechazar003($q$update public.categorias_temporada set rama='varones' where codigo='tc_damas'$q$,array['23514'],'TC Única no se transforma en Varones');
select pg_temp.rechazar003($q$update public.categorias_temporada set reglamento_id=pg_temp.id003('r27') where id=pg_temp.id003('ct_peneca_inicial')$q$,array['23503'],'Reglamento de otra temporada rechazado');
select pg_temp.rechazar003($q$update public.categorias_temporada set criterio_nacimiento='rango_anios' where id=pg_temp.id003('ct_peneca_inicial')$q$,array['23514'],'Rango exige ambos años');
select pg_temp.rechazar003($q$update public.categorias_temporada set criterio_nacimiento='rango_anios',anio_nacimiento_desde=2017,anio_nacimiento_hasta=2015 where id=pg_temp.id003('ct_peneca_inicial')$q$,array['23514'],'Rango invertido rechazado');
select pg_temp.rechazar003($q$update public.categorias_temporada set criterio_nacimiento='rango_anios',anio_nacimiento_desde=2027,anio_nacimiento_hasta=2027 where id=pg_temp.id003('ct_peneca_inicial')$q$,array['23514'],'Nacimiento posterior a temporada rechazado');
select pg_temp.rechazar003($q$update public.categorias_temporada set anio_nacimiento_desde=2015 where id=pg_temp.id003('ct_peneca_inicial')$q$,array['23514'],'Pendiente no admite rango oculto');
update public.categorias_temporada set rama='mixta',criterio_nacimiento='rango_anios',anio_nacimiento_desde=2015,anio_nacimiento_hasta=2017 where id=pg_temp.id003('ct_peneca_inicial');
with x as (insert into public.categorias_temporada(temporada_id,categoria_id,nivel_id,reglamento_id)
  values(pg_temp.id003('t27'),pg_temp.id003('cat_peneca'),pg_temp.id003('nivel_inicial'),pg_temp.id003('r27')) returning id)
  insert into ids_003 select 'ct27',id from x;
with x as (insert into public.fechas(temporada_id,numero,fecha,comuna,recinto,estado)
  values(pg_temp.id003('t26'),4,'2026-08-08','Prueba','Prueba','publicada') returning id)
  insert into ids_003 select 'f26',id from x;
with x as (insert into public.fechas(temporada_id,numero,fecha,comuna,recinto,estado)
  values(pg_temp.id003('t27'),4,'2027-08-08','Prueba','Prueba','publicada') returning id)
  insert into ids_003 select 'f27',id from x;
with x as (insert into public.competencias(temporada_id,fecha_id,categoria_temporada_id)
  values(pg_temp.id003('t26'),pg_temp.id003('f26'),pg_temp.id003('ct_peneca_inicial')) returning id)
  insert into ids_003 select 'comp',id from x;
select pg_temp.comprobar003((select tarifa_clp is null and inscripcion_abre_en is null and not publicada and not inscripciones_habilitadas from public.competencias where id=pg_temp.id003('comp')), 'Borrador no inventa tarifas ni abre inscripciones');
select pg_temp.rechazar003($q$insert into public.competencias(temporada_id,fecha_id,categoria_temporada_id) values(pg_temp.id003('t26'),pg_temp.id003('f27'),pg_temp.id003('ct_peneca_inicial'))$q$,array['23503'],'Fecha de otra temporada rechazada');
select pg_temp.rechazar003($q$insert into public.competencias(temporada_id,fecha_id,categoria_temporada_id) values(pg_temp.id003('t26'),pg_temp.id003('f26'),pg_temp.id003('ct27'))$q$,array['23503'],'Categoría de otra temporada rechazada');
select pg_temp.rechazar003($q$insert into public.competencias(temporada_id,fecha_id,categoria_temporada_id) values(pg_temp.id003('t26'),pg_temp.id003('f26'),pg_temp.id003('ct_peneca_inicial'))$q$,array['23505'],'Competencia única por fecha y categoría');
select pg_temp.rechazar003($q$update public.competencias set tarifa_clp=-1 where id=pg_temp.id003('comp')$q$,array['23514'],'Tarifa negativa rechazada');
select pg_temp.rechazar003($q$update public.competencias set cupo_maximo=0 where id=pg_temp.id003('comp')$q$,array['23514'],'Cupo cero rechazado');
select pg_temp.rechazar003($q$update public.competencias set inscripcion_abre_en='2026-08-07',inscripcion_cierra_en='2026-08-06' where id=pg_temp.id003('comp')$q$,array['23514'],'Período invertido rechazado');
select pg_temp.rechazar003($q$update public.competencias set inscripcion_abre_en='infinity' where id=pg_temp.id003('comp')$q$,array['23514'],'Instantes infinitos rechazados');
select pg_temp.rechazar003($q$update public.competencias set publicada=true,inscripciones_habilitadas=true where id=pg_temp.id003('comp')$q$,array['23514'],'No abrir ni publicar sin control deportivo');
select pg_temp.rechazar003($q$insert into public.competencia_control_deportivo(competencia_id,temporada_id) values(pg_temp.id003('comp'),pg_temp.id003('t26'))$q$,array['42501'],'Administrador no configura decisiones del juez');
select pg_temp.rechazar003($q$update public.reglamentos_temporada set registrado_por='e0030000-0000-0000-0000-000000000002' where id=pg_temp.id003('r26')$q$,array['42501'],'Cliente no suplanta auditoría');

with x as (insert into public.jugadores(nombre_completo,fecha_nacimiento) values('Fixture dentro de rango','2016-02-29') returning id) insert into ids_003 select 'j_dentro',id from x;
with x as (insert into public.jugadores(nombre_completo,fecha_nacimiento) values('Fixture fuera de rango','2013-01-01') returning id) insert into ids_003 select 'j_fuera',id from x;
with x as (insert into public.jugadores(nombre_completo) values('Fixture sin nacimiento') returning id) insert into ids_003 select 'j_sin',id from x;
select pg_temp.rechazar003($q$insert into public.jugadores(nombre_completo,fecha_nacimiento) values('Fecha imposible','2015-02-29')$q$,array['22008'],'Nacimiento imposible rechazado por PostgreSQL');
select pg_temp.rechazar003($q$insert into public.jugadores(nombre_completo,fecha_nacimiento) values('Futuro',current_date+1)$q$,array['23514'],'002 sigue rechazando nacimientos futuros');
update public.competencias set tarifa_clp=4000,inscripcion_abre_en='2026-08-01 00:00:00-04',inscripcion_cierra_en='2026-08-06 20:00:00-04' where id=pg_temp.id003('comp');

select set_config('request.jwt.claims','{"sub":"e0030000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select pg_temp.comprobar003((select count(*)=11 from public.categorias_temporada),'Juez consulta configuración administrativa');
select pg_temp.rechazar003($q$insert into public.niveles(codigo,nombre) values('inicial','No autorizado')$q$,array['42501'],'Juez no crea catálogos administrativos');
select pg_temp.rechazar003($q$insert into public.competencias(temporada_id,fecha_id,categoria_temporada_id) values(pg_temp.id003('t27'),pg_temp.id003('f27'),pg_temp.id003('ct27'))$q$,array['42501'],'Juez no crea competencia administrativa');
with x as (update public.competencias set tarifa_clp=0 where id=pg_temp.id003('comp') returning id)
  select pg_temp.comprobar003((select count(*)=0 from x),'RLS impide al juez editar tarifa');
select pg_temp.rechazar003($q$insert into public.competencia_control_deportivo(competencia_id,temporada_id) values(pg_temp.id003('comp'),pg_temp.id003('t27'))$q$,array['23503'],'Control deportivo no cruza temporadas');
insert into public.competencia_control_deportivo(competencia_id,temporada_id) values(pg_temp.id003('comp'),pg_temp.id003('t26'));
select pg_temp.rechazar003($q$update public.competencia_control_deportivo set configuracion_aprobada=true where competencia_id=pg_temp.id003('comp')$q$,array['23514'],'Control incompleto no se aprueba');
select pg_temp.rechazar003($q$update public.competencia_control_deportivo set reglamento_id=pg_temp.id003('r27') where competencia_id=pg_temp.id003('comp')$q$,array['23503'],'Control no usa reglamento de otro año');
select pg_temp.rechazar003($q$update public.competencia_control_deportivo set grupo_minimo=2 where competencia_id=pg_temp.id003('comp')$q$,array['23514'],'No inferir grupos de dos desde Excel');
select pg_temp.rechazar003($q$update public.competencia_control_deportivo set minimo_participantes=3 where competencia_id=pg_temp.id003('comp')$q$,array['23514'],'Excepción al mínimo exige resolución');
select pg_temp.rechazar003($q$insert into public.competencia_formatos_sets(competencia_id,etapa,mejor_de) values(pg_temp.id003('comp'),'grupos',7)$q$,array['23514'],'No inventar siete sets');
insert into public.competencia_formatos_sets(competencia_id,etapa,mejor_de)
  select pg_temp.id003('comp'),etapa,3 from unnest(array['grupos','previa_cuartos','cuartos','semifinal','final']) etapa;
select pg_temp.rechazar003($q$insert into public.competencia_formatos_sets(competencia_id,etapa,mejor_de) values(pg_temp.id003('comp'),'grupos',3)$q$,array['23505'],'Formato único por competencia y etapa');
update public.competencia_control_deportivo set inicio_programado='2026-08-08 13:00:00-04',minimo_participantes=4,
 grupo_minimo=3,grupo_maximo=4,formato_competencia='grupos_eliminacion_simple',reglamento_id=pg_temp.id003('r26'),
 configuracion_aprobada=true,estado_deportivo='preparada' where competencia_id=pg_temp.id003('comp');
select pg_temp.comprobar003((select configuracion_aprobada and aprobado_por=auth.uid() from public.competencia_control_deportivo where competencia_id=pg_temp.id003('comp')),'Juez aprueba configuración completa y auditoría real');
select pg_temp.rechazar003($q$update public.competencia_formatos_sets set mejor_de=5 where competencia_id=pg_temp.id003('comp') and etapa='grupos'$q$,array['23514'],'No alterar sets después de aprobar');
select pg_temp.rechazar003($q$insert into public.habilitaciones_jugador_categoria(jugador_id,categoria_temporada_id,estado,motivo,referencia_evidencia) values(pg_temp.id003('j_fuera'),pg_temp.id003('ct_peneca_inicial'),'habilitado','Prueba','Prueba')$q$,array['23514'],'Fuera de rango no se habilita ordinariamente');
select pg_temp.rechazar003($q$insert into public.habilitaciones_jugador_categoria(jugador_id,categoria_temporada_id,estado,motivo,referencia_evidencia) values(pg_temp.id003('j_sin'),pg_temp.id003('ct_peneca_inicial'),'habilitado','Prueba','Prueba')$q$,array['23514'],'Nacimiento desconocido no se habilita automáticamente por edad');
insert into public.habilitaciones_jugador_categoria(jugador_id,categoria_temporada_id,estado,motivo,referencia_evidencia)
 values(pg_temp.id003('j_dentro'),pg_temp.id003('ct_peneca_inicial'),'habilitado','Evaluación fixture','Prueba');
select pg_temp.rechazar003($q$insert into public.habilitaciones_jugador_categoria(jugador_id,categoria_temporada_id) values(pg_temp.id003('j_dentro'),pg_temp.id003('ct_peneca_inicial'))$q$,array['23505'],'Habilitación única por jugador y categoría de temporada');
insert into public.habilitaciones_jugador_categoria(jugador_id,categoria_temporada_id,estado,tipo_resolucion,motivo,referencia_evidencia)
 values(pg_temp.id003('j_fuera'),pg_temp.id003('ct_peneca_inicial'),'habilitado','excepcion_documentada','Resolución fixture, no regla general','Prueba');
select pg_temp.comprobar003((select count(*)=2 from public.habilitaciones_jugador_categoria where estado='habilitado'),'Excepción documentada se separa de elegibilidad ordinaria');

select set_config('request.jwt.claims','{"sub":"e0030000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select pg_temp.rechazar003($q$update public.categorias_temporada set anio_nacimiento_hasta=2018 where id=pg_temp.id003('ct_peneca_inicial')$q$,array['23514'],'Administrador no altera decisiones deportivas vigentes');
select pg_temp.rechazar003($q$update public.reglamentos_temporada set titulo='Reescritura' where id=pg_temp.id003('r26')$q$,array['23514'],'Normativa usada no se sobrescribe');
select pg_temp.rechazar003($q$update public.competencias set inscripcion_cierra_en='2026-08-09' where id=pg_temp.id003('comp')$q$,array['23514'],'Cierre posterior al inicio rechazado');
select pg_temp.rechazar003($q$update public.competencias set publicada=true,inscripciones_habilitadas=true,cupo_maximo=2 where id=pg_temp.id003('comp')$q$,array['23514'],'No habilitar cupo inferior al mínimo deportivo');
select pg_temp.rechazar003($q$update public.temporadas set anio=2025 where id=pg_temp.id003('t26')$q$,array['23514'],'Año de temporada usado no se reinterpreta');
update public.competencias set publicada=true,inscripciones_habilitadas=true where id=pg_temp.id003('comp');
select pg_temp.comprobar003((select publicada and inscripciones_habilitadas from public.competencias where id=pg_temp.id003('comp')),'Administrador publica y habilita solo tras preparación del juez');
select pg_temp.rechazar003($q$update public.competencias set tarifa_clp=5000 where id=pg_temp.id003('comp')$q$,array['23514'],'No cambiar tarifa de condiciones publicadas');
select pg_temp.rechazar003($q$update public.fechas set estado='borrador' where id=pg_temp.id003('f26')$q$,array['23514'],'No ocultar fecha con inscripciones habilitadas');
select pg_temp.rechazar003($q$update public.fechas set temporada_id=pg_temp.id003('t27') where id=pg_temp.id003('f26')$q$,array['23503','23505'],'No mover fecha referenciada a otra temporada');
select pg_temp.rechazar003($q$insert into public.habilitaciones_jugador_categoria(jugador_id,categoria_temporada_id) values(pg_temp.id003('j_sin'),pg_temp.id003('ct_peneca_inicial'))$q$,array['42501'],'Administrador no suplanta decisiones de habilitación');
select pg_temp.rechazar003($q$delete from public.competencias where id=pg_temp.id003('comp')$q$,array['42501'],'Cliente administrador no borra configuraciones');

select set_config('request.jwt.claims','{"sub":"e0030000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select pg_temp.rechazar003($q$update public.competencia_control_deportivo set configuracion_aprobada=false,estado_deportivo='pendiente' where competencia_id=pg_temp.id003('comp')$q$,array['23514'],'Juez no retira aprobación mientras sigue publicada');
select pg_temp.rechazar003($q$update public.competencia_control_deportivo set estado_deportivo='en_curso' where competencia_id=pg_temp.id003('comp')$q$,array['23514'],'Cerrar inscripciones antes del inicio deportivo');

-- Recorrido de revisión válido: retirar condiciones, liberar aprobación y volver a aprobar.
select set_config('request.jwt.claims','{"sub":"e0030000-0000-0000-0000-000000000001","role":"authenticated"}',true);
update public.competencias set publicada=false,inscripciones_habilitadas=false where id=pg_temp.id003('comp');
select set_config('request.jwt.claims','{"sub":"e0030000-0000-0000-0000-000000000002","role":"authenticated"}',true);
update public.competencia_control_deportivo set configuracion_aprobada=false,estado_deportivo='pendiente' where competencia_id=pg_temp.id003('comp');
update public.competencia_formatos_sets set mejor_de=5,referencia_resolucion='Resolución fixture de revisión' where competencia_id=pg_temp.id003('comp') and etapa='final';
select pg_temp.comprobar003((select not configuracion_aprobada and aprobado_por is null and aprobado_en is null from public.competencia_control_deportivo where competencia_id=pg_temp.id003('comp')),'Retirar aprobación borra sello vigente, no habilita apertura');
select set_config('request.jwt.claims','{"sub":"e0030000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select pg_temp.rechazar003($q$update public.competencias set publicada=true,inscripciones_habilitadas=true where id=pg_temp.id003('comp')$q$,array['23514'],'Revisión requiere nueva aprobación antes de publicar');
-- Una fuente pendiente puede completarse aun si una categoría en borrador la referencia.
with x as (insert into public.reglamentos_temporada(temporada_id,version,titulo,referencia_documental)
  values(pg_temp.id003('t26'),'pendiente-fixture','Pendiente','Solo prueba') returning id)
  insert into ids_003 select 'r_pendiente',id from x;
update public.categorias_temporada set reglamento_id=pg_temp.id003('r_pendiente') where id=pg_temp.id003('ct_juvenil_inicial');
update public.reglamentos_temporada set estado_revision='validado',referencia_aprobacion='Resolución fixture' where id=pg_temp.id003('r_pendiente');
select pg_temp.comprobar003((select estado_revision='validado' from public.reglamentos_temporada where id=pg_temp.id003('r_pendiente')),'Normativa pendiente puede completarse antes de utilizarse oficialmente');
select set_config('request.jwt.claims','{"sub":"e0030000-0000-0000-0000-000000000002","role":"authenticated"}',true);
update public.competencia_control_deportivo set configuracion_aprobada=true,estado_deportivo='preparada' where competencia_id=pg_temp.id003('comp');
select pg_temp.comprobar003((select configuracion_aprobada and aprobado_por=auth.uid() from public.competencia_control_deportivo where competencia_id=pg_temp.id003('comp')),'Reaprobación del juez funciona después de revisión');

-- Roles sin facultades: lectura RLS vacía y ninguna escritura de configuración.
do $$
declare actor text; tabla text;
begin
  foreach actor in array array['e0030000-0000-0000-0000-000000000003','e0030000-0000-0000-0000-000000000004'] loop
    perform set_config('request.jwt.claims',json_build_object('sub',actor,'role','authenticated')::text,true);
    foreach tabla in array array['categorias','niveles','reglamentos_temporada','categorias_temporada','competencias','competencia_control_deportivo','competencia_formatos_sets','habilitaciones_jugador_categoria'] loop
      perform pg_temp.rechazar003(format('insert into public.%I default values',tabla),array['42501'],'Escritura denegada '||actor||' '||tabla);
      execute format('select pg_temp.comprobar003(count(*)=0,%L) from public.%I','Lectura RLS aislada '||actor||' '||tabla,tabla);
    end loop;
  end loop;
end;
$$;
reset role;
set local role anon;
do $$
declare tabla text;
begin
  foreach tabla in array array['categorias','niveles','reglamentos_temporada','categorias_temporada','competencias','competencia_control_deportivo','competencia_formatos_sets','habilitaciones_jugador_categoria'] loop
    -- No usa helpers con INSERT de resultados porque anon no tiene esos privilegios.
    begin execute format('select * from public.%I',tabla);
      raise exception 'Anon obtuvo acceso a %',tabla;
    exception when insufficient_privilege then null; end;
  end loop;
end;
$$;
reset role;
select pg_temp.comprobar003((select count(*)=8 from pg_class where relnamespace='public'::regnamespace and relname in
 ('categorias','niveles','reglamentos_temporada','categorias_temporada','competencias','competencia_control_deportivo','competencia_formatos_sets','habilitaciones_jugador_categoria') and relrowsecurity),'RLS habilitado en las ocho tablas');
select pg_temp.comprobar003(not has_function_privilege('authenticated','public.autorizar_configuracion_003()','execute'),'Funciones internas no expuestas como RPC');
select count(*) as aserciones_aprobadas from resultados_003;
rollback;
