-- Corrección incremental para 004 histórica del commit 829a9c6.
-- NO reaplicar 004. Sin DML ni limpieza de cupo_maximo. 006: programación deportiva.
-- Comparación deliberadamente estricta: ante deriva, revisar; nunca quitar el guard.
-- Supabase histórico: el validador 003 conserva EXECUTE de service_role.
-- Se acepta con/sin ese permiso solo en 003, sin concederlo ni revocarlo.
-- Su cuerpo CRLF verificado tiene longitud 1635 y MD5
-- 3725d3905310ffdee1ad5415f03b0ac2. Solo se normaliza CRLF a LF.
begin;
set local lock_timeout = '5s';
lock table public.competencias, public.inscripciones in access exclusive mode;
do $guard$
declare esperado record; actual record;
begin
  for esperado in select * from (values
('public.validar_competencia_003()',$esperado$
declare d public.competencia_control_deportivo;
begin
  if tg_op = 'UPDATE' and (old.publicada or old.inscripciones_habilitadas) and (
    new.tarifa_clp is distinct from old.tarifa_clp or new.cupo_maximo is distinct from old.cupo_maximo
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
  if new.inscripciones_habilitadas and new.cupo_maximo < d.minimo_participantes then
    raise exception 'El cupo máximo no puede ser inferior al mínimo deportivo aprobado' using errcode = '23514';
  end if;
  return new;
end;
$esperado$),
('privado_inscripciones.validar_inscripcion_004()',$esperado$
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
    if c.cupo_maximo is not null and (select count(*) from public.inscripciones
      where competencia_id=c.id and estado in ('pendiente','aceptada') and id<>new.id) >= c.cupo_maximo then
      raise exception 'Cupo agotado' using errcode='23514';
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
$esperado$),
('privado_inscripciones.proteger_cupo_004()',$esperado$
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Revisión de cupo requiere READ COMMITTED' using errcode='25000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(2026003, 1);
  if new.cupo_maximo is not null and (select count(*) from public.inscripciones
    where competencia_id=new.id and estado in ('pendiente','aceptada')) > new.cupo_maximo then
    raise exception 'Cupo inferior a reservas vigentes' using errcode='23514';
  end if;
  return new;
end;
$esperado$)
  ) as v(firma,cuerpo) loop
    select p.*, l.lanname into actual from pg_catalog.pg_proc p
    join pg_catalog.pg_language l on l.oid=p.prolang
    where p.oid=pg_catalog.to_regprocedure(esperado.firma);
    if not found then raise exception '005: falta %', esperado.firma; end if;
    if pg_catalog.replace(actual.prosrc, E'\r\n', E'\n')
         is distinct from pg_catalog.replace(esperado.cuerpo, E'\r\n', E'\n')
      or actual.lanname <> 'plpgsql' or not actual.prosecdef
      or actual.proconfig is distinct from array['search_path=""']::text[]
      or actual.prorettype <> 'pg_catalog.trigger'::regtype
      or actual.provolatile <> 'v' or actual.proisstrict or actual.proleakproof
      or actual.proretset or actual.pronargs <> 0
      or pg_catalog.pg_get_userbyid(actual.proowner) <> 'postgres'
      or actual.proowner <> (select relowner from pg_catalog.pg_class where oid='public.competencias'::regclass)
      or exists (select 1 from pg_catalog.pg_roles r
         where (r.rolname in ('anon','authenticated')
           or (r.rolname='service_role' and esperado.firma <> 'public.validar_competencia_003()'))
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

create or replace function public.validar_competencia_003() returns trigger
language plpgsql security definer set search_path = '' as $$
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
$$;

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
$$;

drop trigger c_proteger_cupo on public.competencias;
drop function privado_inscripciones.proteger_cupo_004(); -- RESTRICT implícito, nunca CASCADE.
comment on column public.competencias.cupo_maximo is 'Columna heredada sin efecto deportivo ni límite de inscripción. No configurar ni limpiar automáticamente sus valores.';
comment on table public.inscripciones is 'Sin máximo general de participantes ni pago implícito. Rechazada/cancelada son terminales. Una fila histórica por jugador/competencia.';
commit;
