-- Revisión y aplicación MANUAL sobre 001–028. No crea fichas ni cambia vínculos.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create function public.editar_mi_perfil_deportivo_029(
  p_jugador_id bigint, p_fecha_nacimiento date, p_club_id bigint,
  p_localidad_id bigint, p_esperado jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ficha public.jugadores%rowtype;
  dependencia record;
  condicion text;
  tiene_antecedentes boolean;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Reintentar en READ COMMITTED' using errcode = '25001';
  end if;
  if p_esperado is null or jsonb_typeof(p_esperado) <> 'object' then
    raise exception 'Debes enviar la versión completa de la ficha' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_esperado)) <> 3
    or not (p_esperado ?& array['fecha_nacimiento','club_id','localidad_procedencia_id']) then
    raise exception 'La versión esperada debe contener exactamente los tres campos editables' using errcode = '22023';
  end if;

  -- 003/004 serializan habilitaciones e inscripciones con este mismo bloqueo,
  -- antes de leer al jugador. Así no se valida una categoría con un nacimiento
  -- anterior y se inserta la habilitación después de que esta RPC haya cambiado la ficha.
  perform pg_catalog.pg_advisory_xact_lock(2026003, 1);
  select * into ficha from public.jugadores
    where id = p_jugador_id and perfil_id = auth.uid() for update;
  if not found then
    raise exception 'Ficha no vinculada' using errcode = '42501';
  end if;
  if p_esperado is distinct from jsonb_build_object(
    'fecha_nacimiento', ficha.fecha_nacimiento, 'club_id', ficha.club_id,
    'localidad_procedencia_id', ficha.localidad_procedencia_id
  ) then
    raise exception 'La ficha cambió; vuelve a cargarla' using errcode = '40001';
  end if;
  -- NULL es válido solo si el dato ya estaba vacío. No hay borrado de datos desde
  -- esta RPC; una eliminación/corrección supervisada utiliza el panel administrativo.
  if (p_fecha_nacimiento is null and ficha.fecha_nacimiento is not null)
    or (p_club_id is null and ficha.club_id is not null)
    or (p_localidad_id is null and ficha.localidad_procedencia_id is not null) then
    raise exception 'No se permite borrar información existente desde el perfil' using errcode = '22023';
  end if;
  if p_fecha_nacimiento is not null and
    (not isfinite(p_fecha_nacimiento) or p_fecha_nacimiento < date '0001-01-01' or
     p_fecha_nacimiento > (clock_timestamp() at time zone 'America/Santiago')::date) then
    raise exception 'Nacimiento inválido' using errcode = '22023';
  end if;
  if (p_fecha_nacimiento, p_club_id, p_localidad_id) is not distinct from
    (ficha.fecha_nacimiento, ficha.club_id, ficha.localidad_procedencia_id) then
    return;
  end if;

  -- Criterio conservador: cualquier referencia deportiva exige revisión de la
  -- Administración. Incluye habilitaciones, inscripciones, nóminas e historial,
  -- grupos, partidos, campeones y resoluciones de ranking, también FK compuestas.
  -- Las tablas y columnas proceden del catálogo, nunca de parámetros del cliente.
  for dependencia in
    select c.conrelid, c.confrelid, c.conkey, c.confkey
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f' and c.confrelid = 'public.jugadores'::regclass
      and n.nspname = 'public' order by c.oid
  loop
    select string_agg(format('d.%I = ($1).%I', a.attname, b.attname), ' and ' order by k.i)
      into condicion
    from generate_subscripts(dependencia.conkey, 1) k(i)
    join pg_catalog.pg_attribute a on a.attrelid = dependencia.conrelid and a.attnum = dependencia.conkey[k.i]
    join pg_catalog.pg_attribute b on b.attrelid = dependencia.confrelid and b.attnum = dependencia.confkey[k.i];
    execute format('select exists (select 1 from %s d where %s)',
      dependencia.conrelid::regclass, condicion) into tiene_antecedentes using ficha;
    if tiene_antecedentes then
      raise exception 'La ficha tiene antecedentes deportivos; solicita revisión administrativa' using errcode = '55000';
    end if;
  end loop;

  -- Permitir conservar un catálogo inactivo ya asignado, pero no elegir uno nuevo.
  if p_club_id is not null and p_club_id is distinct from ficha.club_id then
    perform 1 from public.clubes where id = p_club_id and activo for share;
    if not found then raise exception 'Club no disponible' using errcode = '22023'; end if;
  end if;
  if p_localidad_id is not null and p_localidad_id is distinct from ficha.localidad_procedencia_id then
    perform 1 from public.localidades where id = p_localidad_id and activo for share;
    if not found then raise exception 'Localidad no disponible' using errcode = '22023'; end if;
  end if;
  update public.jugadores set fecha_nacimiento = p_fecha_nacimiento,
    club_id = p_club_id, localidad_procedencia_id = p_localidad_id
    where id = ficha.id and perfil_id = auth.uid();
end;
$$;
revoke all on function public.editar_mi_perfil_deportivo_029(bigint,date,bigint,bigint,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.editar_mi_perfil_deportivo_029(bigint,date,bigint,bigint,jsonb)
  to authenticated;
-- Sin nuevas políticas RLS ni cambios al UPDATE directo de Administración.
commit;
