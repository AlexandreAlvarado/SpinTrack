-- Exclusivamente competencias individuales. SIN INSERT de catálogos ni valores deportivos.
-- Requiere 001 y 002. PostgreSQL 15+ (UNIQUE NULLS NOT DISTINCT).
-- Ejecutar una sola vez como propietario, primero en un entorno de pruebas.
-- Las acciones Next.js futuras deberán comprobar requireRole además de estas defensas SQL.
begin;

-- Extensión aditiva de integridad: no cambia columnas ni el archivo de la migración 001.
alter table public.fechas add constraint fechas_id_temporada_uq unique (id, temporada_id);

create table public.categorias (
  id bigint generated always as identity primary key,
  codigo text not null unique check (codigo in ('peneca','preinfantil','infantil','juvenil','tc')),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 100 and nombre !~* '\mdobles\M'),
  orden_presentacion integer check (orden_presentacion >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.niveles (
  id bigint generated always as identity primary key,
  codigo text not null unique check (codigo in ('inicial','aficionado','federado','unica')),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 100 and nombre !~* '\mdobles\M'),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.reglamentos_temporada (
  id bigint generated always as identity primary key,
  temporada_id bigint not null references public.temporadas(id) on delete restrict,
  version text not null check (char_length(btrim(version)) between 1 and 50),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
  referencia_documental text not null check (char_length(btrim(referencia_documental)) between 1 and 1000),
  hash_documento text check (hash_documento ~ '^[0-9a-f]{64}$'),
  estado_revision text not null default 'pendiente' check (estado_revision in ('pendiente','validado')),
  referencia_aprobacion text check (char_length(btrim(referencia_aprobacion)) between 1 and 1000),
  registrado_por uuid not null,
  registrado_en timestamptz not null default now(),
  unique (temporada_id, version),
  unique (id, temporada_id),
  check (estado_revision <> 'validado' or referencia_aprobacion is not null)
);

create table public.categorias_temporada (
  id bigint generated always as identity primary key,
  temporada_id bigint not null references public.temporadas(id) on delete restrict,
  categoria_id bigint not null references public.categorias(id) on delete restrict,
  nivel_id bigint not null references public.niveles(id) on delete restrict,
  -- Código derivado por trigger de la combinación documentada, no enviado por el cliente.
  codigo text not null,
  rama text check (rama in ('mixta','varones','damas')),
  criterio_nacimiento text not null default 'pendiente' check (criterio_nacimiento in ('pendiente','rango_anios','sin_limite')),
  anio_nacimiento_desde integer,
  anio_nacimiento_hasta integer,
  reglamento_id bigint,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (temporada_id, codigo),
  unique nulls not distinct (temporada_id, categoria_id, nivel_id, rama),
  unique (id, temporada_id),
  foreign key (reglamento_id, temporada_id) references public.reglamentos_temporada(id, temporada_id) on delete restrict,
  check (
    (criterio_nacimiento in ('pendiente','sin_limite') and anio_nacimiento_desde is null and anio_nacimiento_hasta is null)
    or (criterio_nacimiento = 'rango_anios' and anio_nacimiento_desde is not null and anio_nacimiento_hasta is not null
      and anio_nacimiento_desde between 1 and 9999 and anio_nacimiento_hasta between anio_nacimiento_desde and 9999)
  )
);

create table public.competencias (
  id bigint generated always as identity primary key,
  temporada_id bigint not null references public.temporadas(id) on delete restrict,
  fecha_id bigint not null,
  categoria_temporada_id bigint not null,
  tarifa_clp integer check (tarifa_clp >= 0),
  inscripcion_abre_en timestamptz check (isfinite(inscripcion_abre_en)),
  inscripcion_cierra_en timestamptz check (isfinite(inscripcion_cierra_en)),
  cupo_maximo integer check (cupo_maximo > 0),
  inscripciones_habilitadas boolean not null default false,
  publicada boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  foreign key (fecha_id, temporada_id) references public.fechas(id, temporada_id) on delete restrict,
  foreign key (categoria_temporada_id, temporada_id) references public.categorias_temporada(id, temporada_id) on delete restrict,
  unique (fecha_id, categoria_temporada_id),
  unique (id, temporada_id),
  check (inscripcion_abre_en is null or inscripcion_cierra_en is null or inscripcion_abre_en < inscripcion_cierra_en),
  check (not inscripciones_habilitadas or (activo and publicada and tarifa_clp is not null
    and inscripcion_abre_en is not null and inscripcion_cierra_en is not null)),
  check (not publicada or activo)
);

create table public.competencia_control_deportivo (
  competencia_id bigint primary key references public.competencias(id) on delete restrict,
  inicio_programado timestamptz check (isfinite(inicio_programado)),
  estado_deportivo text not null default 'pendiente'
    check (estado_deportivo in ('pendiente','preparada','en_curso','suspendida','finalizada','cancelada')),
  minimo_participantes integer check (minimo_participantes > 0),
  grupo_minimo integer check (grupo_minimo between 3 and 4),
  grupo_maximo integer check (grupo_maximo between 3 and 4),
  formato_competencia text check (formato_competencia = 'grupos_eliminacion_simple'),
  reglamento_id bigint,
  temporada_id bigint not null,
  configuracion_aprobada boolean not null default false,
  motivo_resolucion text check (char_length(btrim(motivo_resolucion)) between 1 and 2000),
  referencia_resolucion text check (char_length(btrim(referencia_resolucion)) between 1 and 1000),
  actualizado_por uuid not null,
  actualizado_en timestamptz not null default now(),
  aprobado_por uuid,
  aprobado_en timestamptz,
  foreign key (competencia_id, temporada_id) references public.competencias(id, temporada_id) on delete restrict,
  foreign key (reglamento_id, temporada_id) references public.reglamentos_temporada(id, temporada_id) on delete restrict,
  check (grupo_minimo is null or grupo_maximo is null or grupo_minimo <= grupo_maximo),
  check (minimo_participantes is null or minimo_participantes >= 4
    or (motivo_resolucion is not null and referencia_resolucion is not null)),
  check (estado_deportivo = 'pendiente' or configuracion_aprobada),
  check (not configuracion_aprobada or estado_deportivo <> 'pendiente'),
  check (not configuracion_aprobada or (inicio_programado is not null and minimo_participantes is not null
    and grupo_minimo is not null and grupo_maximo is not null and formato_competencia is not null
    and reglamento_id is not null and aprobado_por is not null and aprobado_en is not null))
);

create table public.competencia_formatos_sets (
  competencia_id bigint not null references public.competencia_control_deportivo(competencia_id) on delete restrict,
  etapa text not null check (etapa in ('grupos','previa_cuartos','cuartos','semifinal','final')),
  mejor_de integer not null check (mejor_de in (3,5)),
  referencia_resolucion text check (char_length(btrim(referencia_resolucion)) between 1 and 1000),
  actualizado_por uuid not null,
  actualizado_en timestamptz not null default now(),
  primary key (competencia_id, etapa)
);

create table public.habilitaciones_jugador_categoria (
  id bigint generated always as identity primary key,
  jugador_id bigint not null references public.jugadores(id) on delete restrict,
  categoria_temporada_id bigint not null references public.categorias_temporada(id) on delete restrict,
  estado text not null default 'pendiente' check (estado in ('pendiente','habilitado','no_habilitado')),
  tipo_resolucion text not null default 'ordinaria' check (tipo_resolucion in ('ordinaria','excepcion_documentada')),
  motivo text check (char_length(btrim(motivo)) between 1 and 2000),
  referencia_evidencia text check (char_length(btrim(referencia_evidencia)) between 1 and 1000),
  validado_por uuid,
  validado_en timestamptz,
  creado_en timestamptz not null default now(),
  unique (jugador_id, categoria_temporada_id),
  check (estado = 'pendiente' or (motivo is not null and referencia_evidencia is not null and validado_por is not null and validado_en is not null)),
  check (tipo_resolucion <> 'excepcion_documentada' or (motivo is not null and referencia_evidencia is not null))
);

comment on table public.reglamentos_temporada is 'Referencias privadas de resoluciones de la Liga; no se incorporan documentos ni valores por defecto.';
comment on table public.categorias_temporada is 'Solo las diez combinaciones individuales observadas; rama NULL y criterio pendiente no habilitan participación.';
comment on table public.competencias is 'NULL en tarifa/plazos significa pendiente. Cupo NULL significa que no se ha fijado máximo, no un valor oficial. Los plazos se presentan en America/Santiago. Las futuras inscripciones deben verificar también el intervalo temporal: habilitada no significa abierta fuera de plazo.';
comment on table public.competencia_control_deportivo is 'Decisiones del Juez General. Estados son flujo técnico, no reglas deportivas inventadas. Formatos excepcionales distintos quedan pendientes de otra revisión.';
comment on table public.habilitaciones_jugador_categoria is 'Resolución por jugador y categoría de temporada; NO es inscripción, licencia ni condición federativa fija. Revalidar datos vigentes al implementar inscripciones.';
comment on column public.reglamentos_temporada.registrado_por is 'Snapshot del UUID autenticado; sin FK de auditoría para conservar evidencia aunque se borre la cuenta. Lo establece el trigger.';
comment on column public.competencia_control_deportivo.aprobado_por is 'Snapshot de actor autenticado estampado por trigger, no modificable por el cliente.';

create index reglamentos_temporada_idx on public.reglamentos_temporada(temporada_id);
create index categorias_temporada_categoria_idx on public.categorias_temporada(categoria_id);
create index categorias_temporada_nivel_idx on public.categorias_temporada(nivel_id);
create index categorias_temporada_reglamento_idx on public.categorias_temporada(reglamento_id, temporada_id);
create index competencias_categoria_idx on public.competencias(categoria_temporada_id, temporada_id);
create index competencias_fecha_temporada_idx on public.competencias(fecha_id, temporada_id);
create index competencias_temporada_idx on public.competencias(temporada_id);
create index control_reglamento_idx on public.competencia_control_deportivo(reglamento_id, temporada_id);
create index control_temporada_idx on public.competencia_control_deportivo(temporada_id);
create index habilitaciones_categoria_idx on public.habilitaciones_jugador_categoria(categoria_temporada_id);

-- Autorización también en el servidor PostgreSQL, además de RLS. Funciones de trigger
-- no invocables por RPC. UUIDs/fechas de auditoría se derivan de la sesión, nunca del formulario.
create function public.autorizar_configuracion_003() returns trigger
language plpgsql security definer set search_path = '' as $$
declare es_admin boolean; es_juez boolean;
begin
  es_admin := public.es_administrador();
  es_juez := public.es_juez_general();
  if (tg_argv[0] = 'administrador' and not es_admin)
    or (tg_argv[0] = 'juez_general' and not es_juez) then
    raise exception 'Operación no autorizada para este rol' using errcode = '42501';
  end if;
  -- Configuraciones de bajo volumen: serializar la revisión/publicación entre roles.
  -- Es un bloqueo de transacción, no una conexión ni credencial externa.
  perform pg_catalog.pg_advisory_xact_lock(2026003, 1);
  if tg_table_name = 'reglamentos_temporada' then
    new.registrado_por := auth.uid(); new.registrado_en := statement_timestamp();
  elsif tg_table_name in ('competencia_control_deportivo','competencia_formatos_sets') then
    new.actualizado_por := auth.uid(); new.actualizado_en := statement_timestamp();
    if tg_table_name = 'competencia_control_deportivo' then
      if new.configuracion_aprobada then
        new.aprobado_por := auth.uid(); new.aprobado_en := statement_timestamp();
      else new.aprobado_por := null; new.aprobado_en := null;
      end if;
    end if;
  elsif tg_table_name = 'habilitaciones_jugador_categoria' then
    if new.estado <> 'pendiente' then
      new.validado_por := auth.uid(); new.validado_en := statement_timestamp();
    else new.validado_por := null; new.validado_en := null;
    end if;
  end if;
  return new;
end;
$$;

create function public.validar_categoria_temporada_003() returns trigger
language plpgsql security definer set search_path = '' as $$
declare categoria text; nivel text; anio integer;
begin
  select codigo into categoria from public.categorias where id = new.categoria_id;
  select codigo into nivel from public.niveles where id = new.nivel_id;
  if categoria is null or nivel is null then
    raise exception 'Categoría o nivel inexistente' using errcode = '23503';
  end if;
  if not ((categoria = 'peneca' and nivel = 'inicial')
    or (categoria in ('preinfantil','infantil','juvenil') and nivel in ('inicial','federado'))
    or (categoria = 'tc' and nivel in ('aficionado','federado','unica'))) then
    raise exception 'Combinación individual no documentada' using errcode = '23514';
  end if;
  new.codigo := case when categoria = 'tc' and nivel = 'unica' then 'tc_damas' else categoria || '_' || nivel end;
  if nivel = 'unica' and new.rama is not null and new.rama <> 'damas' then
    raise exception 'La combinación TC Única corresponde a Damas' using errcode = '23514';
  end if;
  select t.anio into anio from public.temporadas t where t.id = new.temporada_id;
  if new.anio_nacimiento_hasta > anio then
    raise exception 'El nacimiento no puede ser posterior al año de temporada' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new is distinct from old then
    if exists (select 1 from public.competencias c join public.competencia_control_deportivo d on d.competencia_id = c.id
      where c.categoria_temporada_id = old.id and d.configuracion_aprobada)
      or exists (select 1 from public.habilitaciones_jugador_categoria h where h.categoria_temporada_id = old.id and h.estado <> 'pendiente') then
      raise exception 'La categoría tiene decisiones deportivas vigentes; requiere revisión previa' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create function public.proteger_fuente_003() returns trigger
language plpgsql security definer set search_path = '' as $$
declare usada boolean := false;
begin
  if new is not distinct from old then return new; end if;
  if tg_table_name = 'categorias' then
    usada := exists (select 1 from public.categorias_temporada where categoria_id = old.id);
  elsif tg_table_name = 'niveles' then
    usada := exists (select 1 from public.categorias_temporada where nivel_id = old.id);
  elsif tg_table_name = 'reglamentos_temporada' and old.estado_revision = 'validado' then
    usada := exists (select 1 from public.categorias_temporada where reglamento_id = old.id)
      or exists (select 1 from public.competencia_control_deportivo where reglamento_id = old.id);
  end if;
  if usada then
    raise exception 'Fuente ya referenciada: conservar su significado y registrar una nueva versión cuando proceda' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.validar_control_deportivo_003() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.competencias; ct public.categorias_temporada; r public.reglamentos_temporada;
begin
  select * into c from public.competencias where id = new.competencia_id;
  if c.id is null then raise exception 'Competencia inexistente' using errcode = '23503'; end if;
  if tg_op = 'UPDATE' then
    if old.estado_deportivo in ('finalizada','cancelada') then
      raise exception 'Estado deportivo terminal; no sobrescribir el cierre' using errcode = '23514';
    end if;
    if (c.publicada or c.inscripciones_habilitadas) and (
      not new.configuracion_aprobada or new.inicio_programado is distinct from old.inicio_programado
      or new.minimo_participantes is distinct from old.minimo_participantes
      or new.grupo_minimo is distinct from old.grupo_minimo or new.grupo_maximo is distinct from old.grupo_maximo
      or new.formato_competencia is distinct from old.formato_competencia or new.reglamento_id is distinct from old.reglamento_id
      or new.motivo_resolucion is distinct from old.motivo_resolucion or new.referencia_resolucion is distinct from old.referencia_resolucion) then
      raise exception 'Retirar publicación y cerrar inscripciones antes de cambiar reglas aprobadas' using errcode = '23514';
    end if;
    if c.inscripciones_habilitadas and new.estado_deportivo <> 'preparada' then
      raise exception 'Cerrar inscripciones antes de iniciar o suspender la competencia' using errcode = '23514';
    end if;
  end if;
  if new.configuracion_aprobada then
    select * into ct from public.categorias_temporada where id = c.categoria_temporada_id;
    select * into r from public.reglamentos_temporada where id = new.reglamento_id;
    if not ct.activo or ct.rama is null or ct.criterio_nacimiento = 'pendiente'
      or ct.reglamento_id is null or ct.reglamento_id is distinct from new.reglamento_id
      or r.estado_revision is distinct from 'validado'
      or not exists (select 1 from public.categorias where id = ct.categoria_id and activo)
      or not exists (select 1 from public.niveles where id = ct.nivel_id and activo) then
      raise exception 'Categoría, rama o reglamento sin validar' using errcode = '23514';
    end if;
    if (select count(*) from public.competencia_formatos_sets where competencia_id = new.competencia_id) <> 5 then
      raise exception 'Falta configurar las cinco etapas de sets' using errcode = '23514';
    end if;
    if c.inscripcion_cierra_en > new.inicio_programado then
      raise exception 'El cierre de inscripción es posterior al inicio' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create function public.validar_formatos_sets_003() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.competencia_control_deportivo where competencia_id = new.competencia_id and configuracion_aprobada) then
    raise exception 'Retirar aprobación deportiva antes de modificar sets' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.validar_competencia_003() returns trigger
language plpgsql security definer set search_path = '' as $$
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
$$;

create function public.validar_habilitacion_003() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j public.jugadores; ct public.categorias_temporada;
begin
  if new.estado = 'habilitado' then
    select * into j from public.jugadores where id = new.jugador_id;
    select * into ct from public.categorias_temporada where id = new.categoria_temporada_id;
    if j.id is null or ct.id is null then raise exception 'Jugador o categoría inexistente' using errcode = '23503'; end if;
    if not j.activo or not ct.activo or ct.criterio_nacimiento = 'pendiente' or ct.rama is null
      or not exists (select 1 from public.reglamentos_temporada where id = ct.reglamento_id and estado_revision = 'validado') then
      raise exception 'No se puede habilitar un jugador o categoría pendiente/inactivo' using errcode = '23514';
    end if;
    if new.tipo_resolucion = 'ordinaria' and ct.criterio_nacimiento = 'rango_anios' and (
      j.fecha_nacimiento is null or extract(year from j.fecha_nacimiento) not between ct.anio_nacimiento_desde and ct.anio_nacimiento_hasta) then
      raise exception 'Nacimiento desconocido o fuera del rango; requiere revisión documentada, no habilitación automática' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- No permitir que una modificación de la fecha deje vigentes condiciones contradictorias.
create function public.proteger_fecha_competencias_003() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(2026003, 1);
  if new.fecha is distinct from old.fecha and exists (
    select 1 from public.competencias c join public.competencia_control_deportivo d on d.competencia_id = c.id
    where c.fecha_id = old.id and d.configuracion_aprobada) then
    raise exception 'Revisar la programación deportiva antes de cambiar el día' using errcode = '23514';
  end if;
  if new.estado <> 'publicada' and exists (select 1 from public.competencias where fecha_id = old.id and inscripciones_habilitadas) then
    raise exception 'Cerrar inscripciones antes de retirar o finalizar la fecha' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.proteger_anio_temporada_003() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(2026003, 1);
  if new.anio is distinct from old.anio and (
    exists (select 1 from public.reglamentos_temporada where temporada_id = old.id)
    or exists (select 1 from public.categorias_temporada where temporada_id = old.id)) then
    raise exception 'El año de una temporada con configuración deportiva no puede reinterpretarse' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Orden alfabético: autorización/bloqueo/auditoría ANTES de validación.
create trigger a_autorizar before insert or update on public.categorias for each row execute function public.autorizar_configuracion_003('administrador');
create trigger a_autorizar before insert or update on public.niveles for each row execute function public.autorizar_configuracion_003('administrador');
create trigger a_autorizar before insert or update on public.reglamentos_temporada for each row execute function public.autorizar_configuracion_003('administrador');
create trigger a_autorizar before insert or update on public.categorias_temporada for each row execute function public.autorizar_configuracion_003('administrador');
create trigger a_autorizar before insert or update on public.competencias for each row execute function public.autorizar_configuracion_003('administrador');
create trigger a_autorizar before insert or update on public.competencia_control_deportivo for each row execute function public.autorizar_configuracion_003('juez_general');
create trigger a_autorizar before insert or update on public.competencia_formatos_sets for each row execute function public.autorizar_configuracion_003('juez_general');
create trigger a_autorizar before insert or update on public.habilitaciones_jugador_categoria for each row execute function public.autorizar_configuracion_003('juez_general');
create trigger b_validar before insert or update on public.categorias_temporada for each row execute function public.validar_categoria_temporada_003();
create trigger b_proteger before update on public.categorias for each row execute function public.proteger_fuente_003();
create trigger b_proteger before update on public.niveles for each row execute function public.proteger_fuente_003();
create trigger b_proteger before update on public.reglamentos_temporada for each row execute function public.proteger_fuente_003();
create trigger b_validar before insert or update on public.competencias for each row execute function public.validar_competencia_003();
create trigger b_validar before insert or update on public.competencia_control_deportivo for each row execute function public.validar_control_deportivo_003();
create trigger b_validar before insert or update on public.competencia_formatos_sets for each row execute function public.validar_formatos_sets_003();
create trigger b_validar before insert or update on public.habilitaciones_jugador_categoria for each row execute function public.validar_habilitacion_003();
create trigger proteger_competencias_003 before update on public.fechas for each row execute function public.proteger_fecha_competencias_003();
create trigger proteger_anio_003 before update of anio on public.temporadas for each row execute function public.proteger_anio_temporada_003();

-- Los bucles generan únicamente DDL repetitivo, nunca datos de categorías.
do $$
declare tabla text; operador text;
begin
  foreach tabla in array array['categorias','niveles','reglamentos_temporada','categorias_temporada','competencias',
    'competencia_control_deportivo','competencia_formatos_sets','habilitaciones_jugador_categoria'] loop
    operador := case when tabla in ('competencia_control_deportivo','competencia_formatos_sets','habilitaciones_jugador_categoria')
      then 'es_juez_general' else 'es_administrador' end;
    execute format('alter table public.%I enable row level security', tabla);
    execute format('revoke all on table public.%I from public, anon, authenticated', tabla);
    execute format('grant select on table public.%I to authenticated', tabla);
    execute format('create policy lectura_operadores on public.%I for select to authenticated using ((select public.es_administrador()) or (select public.es_juez_general()))', tabla);
    execute format('create policy crear_operador on public.%I for insert to authenticated with check ((select public.%I()))', tabla, operador);
    execute format('create policy editar_operador on public.%I for update to authenticated using ((select public.%I())) with check ((select public.%I()))', tabla, operador, operador);
  end loop;
end;
$$;

-- Columnas de identidad, temporada y auditoría no actualizables desde clientes.
grant insert (codigo,nombre,orden_presentacion,activo), update (nombre,orden_presentacion,activo) on public.categorias to authenticated;
grant insert (codigo,nombre,activo), update (nombre,activo) on public.niveles to authenticated;
grant insert (temporada_id,version,titulo,referencia_documental,hash_documento,estado_revision,referencia_aprobacion),
  update (titulo,referencia_documental,hash_documento,estado_revision,referencia_aprobacion) on public.reglamentos_temporada to authenticated;
grant insert (temporada_id,categoria_id,nivel_id,rama,criterio_nacimiento,anio_nacimiento_desde,anio_nacimiento_hasta,reglamento_id,activo),
  update (rama,criterio_nacimiento,anio_nacimiento_desde,anio_nacimiento_hasta,reglamento_id,activo) on public.categorias_temporada to authenticated;
grant insert (temporada_id,fecha_id,categoria_temporada_id,tarifa_clp,inscripcion_abre_en,inscripcion_cierra_en,cupo_maximo,inscripciones_habilitadas,publicada,activo),
  update (tarifa_clp,inscripcion_abre_en,inscripcion_cierra_en,cupo_maximo,inscripciones_habilitadas,publicada,activo) on public.competencias to authenticated;
grant insert (competencia_id,temporada_id,inicio_programado,estado_deportivo,minimo_participantes,grupo_minimo,grupo_maximo,formato_competencia,reglamento_id,configuracion_aprobada,motivo_resolucion,referencia_resolucion),
  update (inicio_programado,estado_deportivo,minimo_participantes,grupo_minimo,grupo_maximo,formato_competencia,reglamento_id,configuracion_aprobada,motivo_resolucion,referencia_resolucion) on public.competencia_control_deportivo to authenticated;
grant insert (competencia_id,etapa,mejor_de,referencia_resolucion), update (mejor_de,referencia_resolucion) on public.competencia_formatos_sets to authenticated;
grant insert (jugador_id,categoria_temporada_id,estado,tipo_resolucion,motivo,referencia_evidencia),
  update (estado,tipo_resolucion,motivo,referencia_evidencia) on public.habilitaciones_jugador_categoria to authenticated;

revoke all on sequence public.categorias_id_seq, public.niveles_id_seq, public.reglamentos_temporada_id_seq,
  public.categorias_temporada_id_seq, public.competencias_id_seq, public.habilitaciones_jugador_categoria_id_seq from public, anon, authenticated;
grant usage on sequence public.categorias_id_seq, public.niveles_id_seq, public.reglamentos_temporada_id_seq,
  public.categorias_temporada_id_seq, public.competencias_id_seq, public.habilitaciones_jugador_categoria_id_seq to authenticated;

revoke all on function public.autorizar_configuracion_003(), public.validar_categoria_temporada_003(),
  public.proteger_fuente_003(), public.validar_control_deportivo_003(), public.validar_formatos_sets_003(),
  public.validar_competencia_003(), public.validar_habilitacion_003(), public.proteger_fecha_competencias_003(),
  public.proteger_anio_temporada_003() from public, anon, authenticated;

commit;
