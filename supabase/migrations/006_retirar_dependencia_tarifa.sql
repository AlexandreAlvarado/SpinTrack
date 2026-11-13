-- 006: retirar solo la obligatoriedad de tarifa, compatible con 004 historica + 005.
-- Preparada para revision/aplicacion manual. No ejecutar 001-005 otra vez.
-- Sin DML: conserva columna, valores, snapshots, RPC, RLS y autorizaciones.
-- 007 queda reservada a programacion deportiva. Ante deriva, detener y revisar.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
lock table public.competencias, public.inscripciones in access exclusive mode;

do $guard$
declare expected record; actual record; constraint_name text; matches integer;
begin
  -- Comparacion de los cuerpos vigentes despues de 005, no de su guard historico.
  -- Unicamente se normalizan finales CRLF/LF; no se sustituyen cuerpos desconocidos.
  for expected in select * from (values
('public.validar_competencia_003()','trigger',$expected$
declare d public.competencia_control_deportivo;
begin
  if tg_op = 'UPDATE' and (old.publicada or old.inscripciones_habilitadas) and (
    new.tarifa_clp is distinct from old.tarifa_clp
    or new.inscripcion_abre_en is distinct from old.inscripcion_abre_en
    or new.inscripcion_cierra_en is distinct from old.inscripcion_cierra_en) then
    raise exception 'Retirar publicación y cerrar inscripciones antes de cambiar condiciones administrativas' using errcode = '23514';
  end if;
  select * into d from public.competencia_control_deportivo where competencia_id = new.id;
  if (new.publicada or new.inscripciones_habilitadas) and (d.competencia_id is null or not d.configuracion_aprobada) then
    raise exception 'No se puede publicar ni abrir una configuración deportiva pendiente' using errcode = '23514';
  end if;
  if d.configuracion_aprobada and new.inscripcion_cierra_en > d.inicio_programado then
    raise exception 'El cierre de inscripción es posterior al inicio' using errcode = '23514';
  end if;
  if new.inscripciones_habilitadas and (d.estado_deportivo <> 'preparada'
    or not exists (select 1 from public.fechas where id = new.fecha_id and estado = 'publicada')) then
    raise exception 'Para habilitar inscripciones se necesita fecha publicada y competencia preparada' using errcode = '23514';
  end if;
  return new;
end;
$expected$),
('privado_inscripciones.validar_inscripcion_004()','trigger',$expected$
declare c public.competencias; d public.competencia_control_deportivo;
  j public.jugadores; ct public.categorias_temporada; h public.habilitaciones_jugador_categoria;
  f public.fechas; r public.reglamentos_temporada; instante timestamptz;
begin
  if auth.uid() is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Inscripciones requiere READ COMMITTED' using errcode='25000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(2026003, 1);
  select * into c from public.competencias where id=new.competencia_id for update;
  if not found then raise exception 'Competencia inexistente' using errcode='23503'; end if;
  select * into j from public.jugadores where id=new.jugador_id for share;
  if not found then raise exception 'Jugador inexistente' using errcode='23503'; end if;
  instante := clock_timestamp(); -- después de adquirir los bloqueos, no now() de inicio de transacción
  if tg_op='INSERT' then
    if new.estado <> 'pendiente' then raise exception 'Solicitud inicial pendiente' using errcode='23514'; end if;
    if public.es_administrador() then
      if j.perfil_id is distinct from auth.uid() and nullif(btrim(new.referencia_representacion),'') is null then
        raise exception 'Falta evidencia de representación' using errcode='23514';
      end if;
    elsif j.perfil_id is distinct from auth.uid() then
      raise exception 'Solo identidad deportiva propia o Administración autorizada' using errcode='42501';
    end if;
    new.creado_por := auth.uid(); new.creado_en := instante;
    new.motivo := null; new.referencia_resolucion := null;
  else
    if (new.id,new.jugador_id,new.competencia_id,new.creado_por,new.creado_en,new.referencia_representacion,new.solicitud_abre_en,new.solicitud_cierra_en)
      is distinct from (old.id,old.jugador_id,old.competencia_id,old.creado_por,old.creado_en,old.referencia_representacion,old.solicitud_abre_en,old.solicitud_cierra_en) then
      raise exception 'Identidad y solicitud inmutables' using errcode='23514';
    end if;
    if not ((old.estado='pendiente' and new.estado in ('aceptada','rechazada') and public.es_juez_general())
      or (old.estado in ('pendiente','aceptada') and new.estado='cancelada' and public.es_administrador())) then
      raise exception 'Transición o rol no autorizado' using errcode='42501';
    end if;
    if nullif(btrim(new.motivo),'') is null or nullif(btrim(new.referencia_resolucion),'') is null then
      raise exception 'Requiere motivo y resolución documentada' using errcode='23514';
    end if;
    -- Cancelación administrativa solo instrumenta resolución externa documentada.
    -- No se infieren derechos de cancelación, reembolso ni reinscripción.
    new.antecedentes := old.antecedentes;
  end if;
  if new.estado in ('pendiente','aceptada') then
    select * into d from public.competencia_control_deportivo where competencia_id=c.id;
    select * into f from public.fechas where id=c.fecha_id;
    select * into ct from public.categorias_temporada where id=c.categoria_temporada_id;
    select * into r from public.reglamentos_temporada where id=ct.reglamento_id;
    select * into h from public.habilitaciones_jugador_categoria
      where jugador_id=j.id and categoria_temporada_id=ct.id;
    if not c.activo or not c.publicada
      or d.configuracion_aprobada is distinct from true or d.estado_deportivo is distinct from 'preparada'
      or f.estado is distinct from 'publicada' or c.tarifa_clp is null then
      raise exception 'Competencia no disponible' using errcode='23514';
    end if;
    if tg_op='INSERT' then
      if not c.inscripciones_habilitadas then
        raise exception 'Nuevas solicitudes deshabilitadas' using errcode='23514';
      end if;
      if c.inscripcion_abre_en is null or c.inscripcion_cierra_en is null
        or instante < c.inscripcion_abre_en or instante >= c.inscripcion_cierra_en then
        raise exception 'Fuera del período [apertura,cierre)' using errcode='23514';
      end if;
      -- Evidencia temporal inmutable: no reinterpretar solicitudes si cambian plazos.
      new.solicitud_abre_en := c.inscripcion_abre_en;
      new.solicitud_cierra_en := c.inscripcion_cierra_en;
    elsif old.creado_en < old.solicitud_abre_en or old.creado_en >= old.solicitud_cierra_en then
      raise exception 'La solicitud no fue presentada a tiempo' using errcode='23514';
    end if;
    if d.inicio_programado is null or instante >= d.inicio_programado then
      raise exception 'Inicio deportivo alcanzado; no hay excepción validada' using errcode='23514';
    end if;
    if (d.inicio_programado at time zone 'America/Santiago')::date is distinct from f.fecha
      or c.inscripcion_cierra_en > d.inicio_programado then
      raise exception 'Revisar inicio deportivo y día local' using errcode='23514';
    end if;
    if not j.activo or ct.activo is distinct from true or ct.rama is null or ct.criterio_nacimiento='pendiente'
      or r.estado_revision is distinct from 'validado' or d.reglamento_id is distinct from r.id
      or not exists(select 1 from public.categorias where id=ct.categoria_id and activo)
      or not exists(select 1 from public.niveles where id=ct.nivel_id and activo)
      or h.estado is distinct from 'habilitado' or h.validado_por is null or h.validado_en is null
      or nullif(btrim(h.motivo),'') is null or nullif(btrim(h.referencia_evidencia),'') is null then
      raise exception 'Elegibilidad o aprobación pendiente' using errcode='23514';
    end if;
    if h.tipo_resolucion='ordinaria' and ct.criterio_nacimiento='rango_anios' and
      (j.fecha_nacimiento is null or extract(year from j.fecha_nacimiento) not between ct.anio_nacimiento_desde and ct.anio_nacimiento_hasta) then
      raise exception 'Nacimiento vigente requiere revisión deportiva' using errcode='23514';
    end if;
    -- No serializar filas completas en una columna visible al titular.
    new.antecedentes := jsonb_build_object(
      'habilitacion',jsonb_build_object('id',h.id,'estado',h.estado),
      'categoria',jsonb_build_object('id',ct.id,'codigo',ct.codigo,'rama',ct.rama),
      'reglamento',jsonb_build_object('id',r.id,'version',r.version),
      'tarifa_clp',c.tarifa_clp,'club_id',j.club_id,
      'localidad_procedencia_id',j.localidad_procedencia_id);
  end if;
  new.actualizado_por := auth.uid(); new.actualizado_en := instante;
  return new;
end;
$expected$),
('privado_inscripciones.historial_inscripcion_004()','trigger',$expected$
declare evidencia jsonb;
begin
  if new.estado in ('pendiente','aceptada') then
    -- Respaldo íntegro bajo RLS de operadores, nunca en el resumen del jugador.
    select jsonb_build_object('habilitacion',to_jsonb(h),'categoria',to_jsonb(ct),
      'reglamento',to_jsonb(r),'resumen',new.antecedentes,
      'referencia_representacion',new.referencia_representacion)
      into evidencia from public.competencias c
      join public.categorias_temporada ct on ct.id=c.categoria_temporada_id
      join public.reglamentos_temporada r on r.id=ct.reglamento_id
      join public.habilitaciones_jugador_categoria h on h.categoria_temporada_id=ct.id and h.jugador_id=new.jugador_id
      where c.id=new.competencia_id;
  else
    select antecedentes into evidencia from public.inscripciones_historial
      where inscripcion_id=new.id order by id desc limit 1;
  end if;
  insert into public.inscripciones_historial(inscripcion_id,estado_anterior,estado_nuevo,actor,ocurrido_en,motivo,referencia_resolucion,antecedentes)
  values(new.id,case when tg_op='UPDATE' then old.estado end,new.estado,new.actualizado_por,new.actualizado_en,
    new.motivo,new.referencia_resolucion,evidencia);
  return new;
end;
$expected$),
('public.solicitar_inscripcion(bigint,bigint,text)','bigint',$expected$
declare resultado bigint;
begin
  -- Autorizar ANTES de tomar bloqueos o revelar existencia de competencias ajenas.
  -- No confiar en rol de metadata ni en un ID de perfil enviado por el cliente.
  if auth.uid() is null or (not public.es_administrador() and not exists (
    select 1 from public.jugadores where id=p_jugador_id and perfil_id=auth.uid())) then
    raise exception 'Identidad deportiva no autorizada' using errcode='42501';
  end if;
  insert into public.inscripciones(jugador_id,competencia_id,referencia_representacion)
    values(p_jugador_id,p_competencia_id,p_referencia_representacion) returning id into resultado;
  return resultado;
end;
$expected$),
('public.resolver_inscripcion(bigint,text,text,text)','void',$expected$
begin
  if auth.uid() is null or p_estado is null or not (
    (p_estado in ('aceptada','rechazada') and public.es_juez_general())
    or (p_estado='cancelada' and public.es_administrador())) then
    raise exception 'Resolución no autorizada para este rol' using errcode='42501';
  end if;
  -- Mismo orden en las RPC: autorización, bloqueo global, filas.
  perform pg_catalog.pg_advisory_xact_lock(2026003, 1);
  update public.inscripciones set estado=p_estado,motivo=p_motivo,referencia_resolucion=p_referencia where id=p_inscripcion_id;
  if not found then raise exception 'Inscripción inexistente' using errcode='23503'; end if;
end;
$expected$)
  ) as definitions(signature,return_type,body) loop
    select p.*, l.lanname into actual from pg_catalog.pg_proc p
      join pg_catalog.pg_language l on l.oid=p.prolang
      where p.oid=pg_catalog.to_regprocedure(expected.signature);
    if not found then raise exception '006: falta %. Aplicar solo sobre 005 verificada.',expected.signature; end if;
    if pg_catalog.replace(actual.prosrc,E'\r\n',E'\n') is distinct from pg_catalog.replace(expected.body,E'\r\n',E'\n')
      or actual.lanname <> 'plpgsql' or not actual.prosecdef
      or actual.proconfig is distinct from array['search_path=""']::text[]
      or actual.prorettype <> pg_catalog.to_regtype(expected.return_type)
      or actual.provolatile <> 'v' or actual.proisstrict or actual.proleakproof or actual.proretset
      or actual.proowner <> (select relowner from pg_catalog.pg_class where oid='public.inscripciones'::regclass)
      or pg_catalog.pg_get_userbyid(actual.proowner) <> 'postgres'
      or exists(select 1 from pg_catalog.pg_roles r where r.rolname in ('anon','authenticated','service_role')
        and (expected.return_type='trigger' and (r.rolname<>'service_role' or expected.signature<>'public.validar_competencia_003()')
          or expected.return_type<>'trigger' and r.rolname<>'authenticated')
        and pg_catalog.has_function_privilege(r.oid,actual.oid,'EXECUTE'))
    then raise exception '006: definicion/seguridad inesperada en %. Detener y revisar.',expected.signature; end if;
    if expected.return_type<>'trigger' and not pg_catalog.has_function_privilege('authenticated',actual.oid,'EXECUTE') then
      raise exception '006: RPC sin permiso esperado para authenticated';
    end if;
  end loop;
  if pg_catalog.to_regprocedure('privado_inscripciones.proteger_cupo_004()') is not null
    or exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.competencias'::regclass and tgname='c_proteger_cupo') then
    raise exception '006: falta correccion 005 de cupo. No reaplicar 004.';
  end if;
  for expected in select * from (values
    ('public.competencias','a_autorizar','public.autorizar_configuracion_003()',23,true),
    ('public.competencias','b_validar','public.validar_competencia_003()',23,false),
    ('public.inscripciones','validar_inscripcion','privado_inscripciones.validar_inscripcion_004()',23,false),
    ('public.inscripciones','historial_inscripcion','privado_inscripciones.historial_inscripcion_004()',21,false)
  ) as triggers(relation,name,signature,kind,admin_arg) loop
    select * into actual from pg_catalog.pg_trigger
      where tgrelid=pg_catalog.to_regclass(expected.relation) and tgname=expected.name;
    -- autorizar_configuracion_003 es trigger sin argumentos SQL, usa TG_ARGV.
    if not found or actual.tgenabled<>'O' or actual.tgisinternal
      or actual.tgtype<>expected.kind
      or actual.tgfoid<>pg_catalog.to_regprocedure(expected.signature)
      or actual.tgnargs<>(case when expected.admin_arg then 1 else 0 end)
      or actual.tgqual is not null or actual.tgattr<>''::int2vector
      or actual.tgargs is distinct from (case when expected.admin_arg then pg_catalog.convert_to('administrador','UTF8') || pg_catalog.decode('00','hex') else ''::bytea end)
    then raise exception '006: trigger inesperado %.%',expected.relation,expected.name; end if;
  end loop;
  if exists(select 1 from pg_catalog.pg_class where oid in ('public.competencias'::regclass,'public.inscripciones'::regclass,'public.inscripciones_historial'::regclass) and not relrowsecurity)
    or exists(select 1 from pg_catalog.pg_roles r where r.rolname in ('anon','authenticated','service_role') and pg_catalog.has_schema_privilege(r.oid,'privado_inscripciones','USAGE')) then
    raise exception '006: RLS o aislamiento del esquema privado inesperados';
  end if;
  if not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.competencias'::regclass and attname='tarifa_clp'
    and atttypid='integer'::regtype and not attnotnull and not atthasdef and not attisdropped) then
    raise exception '006: tarifa_clp debe ser integer nullable, sin DEFAULT';
  end if;
  -- No adivinar el nombre que PostgreSQL asigno al CHECK. Rechazar checks extra
  -- sobre tarifa: podrian conservar otro bloqueo monetario no auditado.
  select count(*),min(conname) into matches,constraint_name from pg_catalog.pg_constraint
    where conrelid='public.competencias'::regclass and contype='c' and convalidated
      and pg_catalog.regexp_replace(pg_catalog.pg_get_constraintdef(oid),'\s+','','g') =
      'CHECK(((NOTinscripciones_habilitadas)OR(activoANDpublicadaAND(tarifa_clpISNOTNULL)AND(inscripcion_abre_enISNOTNULL)AND(inscripcion_cierra_enISNOTNULL))))';
  if matches<>1 or (select count(*) from pg_catalog.pg_constraint where conrelid='public.competencias'::regclass and pg_catalog.pg_get_constraintdef(oid) like '%tarifa_clp%')<>2
    or not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.competencias'::regclass and convalidated and pg_catalog.regexp_replace(pg_catalog.pg_get_constraintdef(oid),'\s+','','g')='CHECK((tarifa_clp>=0))') then
    raise exception '006: CHECK de habilitacion/columna inesperado o migracion ya aplicada. Detener y revisar.';
  end if;
  execute pg_catalog.format('alter table public.competencias drop constraint %I',constraint_name);
  execute pg_catalog.format('alter table public.competencias add constraint %I check (not inscripciones_habilitadas or (activo and publicada and inscripcion_abre_en is not null and inscripcion_cierra_en is not null))',constraint_name);
end;
$guard$;

-- Mismo cuerpo de 005 excepto la condicion c.tarifa_clp IS NULL.
-- Se conservan snapshots (incluido el campo historico), locks y auditoria.
create or replace function privado_inscripciones.validar_inscripcion_004() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.competencias; d public.competencia_control_deportivo;
  j public.jugadores; ct public.categorias_temporada; h public.habilitaciones_jugador_categoria;
  f public.fechas; r public.reglamentos_temporada; instante timestamptz;
begin
  if auth.uid() is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Inscripciones requiere READ COMMITTED' using errcode='25000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(2026003, 1);
  select * into c from public.competencias where id=new.competencia_id for update;
  if not found then raise exception 'Competencia inexistente' using errcode='23503'; end if;
  select * into j from public.jugadores where id=new.jugador_id for share;
  if not found then raise exception 'Jugador inexistente' using errcode='23503'; end if;
  instante := clock_timestamp(); -- después de adquirir los bloqueos, no now() de inicio de transacción
  if tg_op='INSERT' then
    if new.estado <> 'pendiente' then raise exception 'Solicitud inicial pendiente' using errcode='23514'; end if;
    if public.es_administrador() then
      if j.perfil_id is distinct from auth.uid() and nullif(btrim(new.referencia_representacion),'') is null then
        raise exception 'Falta evidencia de representación' using errcode='23514';
      end if;
    elsif j.perfil_id is distinct from auth.uid() then
      raise exception 'Solo identidad deportiva propia o Administración autorizada' using errcode='42501';
    end if;
    new.creado_por := auth.uid(); new.creado_en := instante;
    new.motivo := null; new.referencia_resolucion := null;
  else
    if (new.id,new.jugador_id,new.competencia_id,new.creado_por,new.creado_en,new.referencia_representacion,new.solicitud_abre_en,new.solicitud_cierra_en)
      is distinct from (old.id,old.jugador_id,old.competencia_id,old.creado_por,old.creado_en,old.referencia_representacion,old.solicitud_abre_en,old.solicitud_cierra_en) then
      raise exception 'Identidad y solicitud inmutables' using errcode='23514';
    end if;
    if not ((old.estado='pendiente' and new.estado in ('aceptada','rechazada') and public.es_juez_general())
      or (old.estado in ('pendiente','aceptada') and new.estado='cancelada' and public.es_administrador())) then
      raise exception 'Transición o rol no autorizado' using errcode='42501';
    end if;
    if nullif(btrim(new.motivo),'') is null or nullif(btrim(new.referencia_resolucion),'') is null then
      raise exception 'Requiere motivo y resolución documentada' using errcode='23514';
    end if;
    -- Cancelación administrativa solo instrumenta resolución externa documentada.
    -- No se infieren derechos de cancelación, reembolso ni reinscripción.
    new.antecedentes := old.antecedentes;
  end if;
  if new.estado in ('pendiente','aceptada') then
    select * into d from public.competencia_control_deportivo where competencia_id=c.id;
    select * into f from public.fechas where id=c.fecha_id;
    select * into ct from public.categorias_temporada where id=c.categoria_temporada_id;
    select * into r from public.reglamentos_temporada where id=ct.reglamento_id;
    select * into h from public.habilitaciones_jugador_categoria
      where jugador_id=j.id and categoria_temporada_id=ct.id;
    if not c.activo or not c.publicada
      or d.configuracion_aprobada is distinct from true or d.estado_deportivo is distinct from 'preparada'
      or f.estado is distinct from 'publicada' then
      raise exception 'Competencia no disponible' using errcode='23514';
    end if;
    if tg_op='INSERT' then
      if not c.inscripciones_habilitadas then
        raise exception 'Nuevas solicitudes deshabilitadas' using errcode='23514';
      end if;
      if c.inscripcion_abre_en is null or c.inscripcion_cierra_en is null
        or instante < c.inscripcion_abre_en or instante >= c.inscripcion_cierra_en then
        raise exception 'Fuera del período [apertura,cierre)' using errcode='23514';
      end if;
      -- Evidencia temporal inmutable: no reinterpretar solicitudes si cambian plazos.
      new.solicitud_abre_en := c.inscripcion_abre_en;
      new.solicitud_cierra_en := c.inscripcion_cierra_en;
    elsif old.creado_en < old.solicitud_abre_en or old.creado_en >= old.solicitud_cierra_en then
      raise exception 'La solicitud no fue presentada a tiempo' using errcode='23514';
    end if;
    if d.inicio_programado is null or instante >= d.inicio_programado then
      raise exception 'Inicio deportivo alcanzado; no hay excepción validada' using errcode='23514';
    end if;
    if (d.inicio_programado at time zone 'America/Santiago')::date is distinct from f.fecha
      or c.inscripcion_cierra_en > d.inicio_programado then
      raise exception 'Revisar inicio deportivo y día local' using errcode='23514';
    end if;
    if not j.activo or ct.activo is distinct from true or ct.rama is null or ct.criterio_nacimiento='pendiente'
      or r.estado_revision is distinct from 'validado' or d.reglamento_id is distinct from r.id
      or not exists(select 1 from public.categorias where id=ct.categoria_id and activo)
      or not exists(select 1 from public.niveles where id=ct.nivel_id and activo)
      or h.estado is distinct from 'habilitado' or h.validado_por is null or h.validado_en is null
      or nullif(btrim(h.motivo),'') is null or nullif(btrim(h.referencia_evidencia),'') is null then
      raise exception 'Elegibilidad o aprobación pendiente' using errcode='23514';
    end if;
    if h.tipo_resolucion='ordinaria' and ct.criterio_nacimiento='rango_anios' and
      (j.fecha_nacimiento is null or extract(year from j.fecha_nacimiento) not between ct.anio_nacimiento_desde and ct.anio_nacimiento_hasta) then
      raise exception 'Nacimiento vigente requiere revisión deportiva' using errcode='23514';
    end if;
    -- No serializar filas completas en una columna visible al titular.
    new.antecedentes := jsonb_build_object(
      'habilitacion',jsonb_build_object('id',h.id,'estado',h.estado),
      'categoria',jsonb_build_object('id',ct.id,'codigo',ct.codigo,'rama',ct.rama),
      'reglamento',jsonb_build_object('id',r.id,'version',r.version),
      'tarifa_clp',c.tarifa_clp,'club_id',j.club_id,
      'localidad_procedencia_id',j.localidad_procedencia_id);
  end if;
  new.actualizado_por := auth.uid(); new.actualizado_en := instante;
  return new;
end;
$$;

commit;
