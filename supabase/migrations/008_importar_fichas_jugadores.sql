-- Preparada para revisión y aplicación MANUAL. No ejecutar automáticamente.
-- 007 reservada. Sin nuevas tablas, cambios de políticas ni datos iniciales.
-- Orden: 001,002,003,004 HISTÓRICA,005,006,008. No reaplicar 004 local.
-- También compatible con 001–005 mientras 006 esté pendiente; no depende de 007.
begin;
create function public.importar_fichas_jugadores(filas jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare f jsonb; resultados jsonb := '[]'; nuevo bigint; coincidencia bigint; nombre text; clave text; n integer := 0; tiempo_bloqueo text;
begin
  if auth.uid() is null or not public.es_administrador() then raise exception 'Solo Administrador' using errcode = '42501'; end if;
  if filas is null or jsonb_typeof(filas) is distinct from 'array' then raise exception 'Lote inválido'; end if;
  if jsonb_array_length(filas) > 2000 or pg_column_size(filas) > 2000000 then raise exception 'Lote inválido'; end if;
  -- Se necesita un snapshot nuevo después de esperar por otro importador.
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'Importar requiere READ COMMITTED'; end if;
  -- Serializa importadores entre procesos; no requiere ampliar privilegios de tabla.
  tiempo_bloqueo := current_setting('lock_timeout');
  perform set_config('lock_timeout', '5s', true);
  perform pg_advisory_xact_lock(824713, 8);
  perform set_config('lock_timeout', tiempo_bloqueo, true);
  for f in select value from jsonb_array_elements(filas) loop
    n := n + 1;
    begin
      if jsonb_typeof(f) is distinct from 'object' then raise exception 'Fila inválida'; end if;
      if exists(select 1 from jsonb_object_keys(f) as k(campo) where campo not in ('nombre_completo','fecha_nacimiento','club_id','localidad_procedencia_id','perfil_id','activo')) then raise exception 'Campos no permitidos'; end if;
      if jsonb_typeof(f->'nombre_completo') is distinct from 'string' then raise exception 'Nombre inválido'; end if;
      nombre := btrim(f->>'nombre_completo');
      if nombre is null or char_length(nombre) not between 1 and 160 or nombre ~ '^[=+@-]' or nombre ~ '[[:cntrl:]]' then raise exception 'Nombre inválido'; end if;
      if (f->>'perfil_id') is not null or (f->'activo') is distinct from 'true'::jsonb then raise exception 'Campos no permitidos'; end if;
      if f->>'fecha_nacimiento' is not null and (jsonb_typeof(f->'fecha_nacimiento') <> 'string' or f->>'fecha_nacimiento' !~ '^\d{4}-\d{2}-\d{2}$') then raise exception 'Fecha inválida'; end if;
      clave := regexp_replace(lower(normalize(nombre, NFD)), '[^a-z0-9]', '', 'g');
      select id into coincidencia from public.jugadores where regexp_replace(lower(normalize(nombre_completo, NFD)), '[^a-z0-9]', '', 'g') = clave order by id limit 1;
      if coincidencia is not null then
        resultados := resultados || jsonb_build_array(jsonb_build_object('fila', n, 'estado', 'duplicado', 'id', coincidencia));
        continue;
      end if;
      if f->>'club_id' is not null and not exists(select 1 from public.clubes where id = (f->>'club_id')::bigint and activo) then raise exception 'Club no disponible'; end if;
      if f->>'localidad_procedencia_id' is not null and not exists(select 1 from public.localidades where id = (f->>'localidad_procedencia_id')::bigint and activo) then raise exception 'Localidad no disponible'; end if;
      insert into public.jugadores(nombre_completo, fecha_nacimiento, club_id, localidad_procedencia_id, activo)
      values(nombre, (f->>'fecha_nacimiento')::date, (f->>'club_id')::bigint, (f->>'localidad_procedencia_id')::bigint, true) returning id into nuevo;
      resultados := resultados || jsonb_build_array(jsonb_build_object('fila', n, 'estado', 'creado', 'id', nuevo));
    exception when data_exception or check_violation or foreign_key_violation or raise_exception then
      resultados := resultados || jsonb_build_array(jsonb_build_object('fila', n, 'estado', 'error', 'mensaje', 'Datos rechazados: revisa nombre, fecha y catálogos.'));
    end;
  end loop;
  return resultados;
end $$;
revoke all on function public.importar_fichas_jugadores(jsonb) from public, anon;
grant execute on function public.importar_fichas_jugadores(jsonb) to authenticated;
commit;
