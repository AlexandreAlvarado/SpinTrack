-- Prueba transaccional para una BD DE PRUEBAS con 001 y 002 aplicadas.
-- Ejecutar con psql -v ON_ERROR_STOP=1 -f ... como postgres/propietario.
-- No ejecutar automáticamente en producción: crea fixtures Auth sin enviar correos.
-- ROLLBACK revierte los registros; las secuencias identity pueden avanzar.
begin;

do $$
begin
  if exists (select 1 from auth.users where id in (
    'e0020000-0000-0000-0000-000000000001',
    'e0020000-0000-0000-0000-000000000002',
    'e0020000-0000-0000-0000-000000000003',
    'e0020000-0000-0000-0000-000000000004'
  )) then
    raise exception 'Colisión con IDs de prueba: no se modificó ninguna cuenta existente';
  end if;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('e0020000-0000-0000-0000-000000000001', 'admin-002@example.invalid', '{"full_name":"Prueba Admin"}'),
  ('e0020000-0000-0000-0000-000000000002', 'juez-002@example.invalid', '{"full_name":"Prueba Juez"}'),
  ('e0020000-0000-0000-0000-000000000003', 'arbitro-002@example.invalid', '{"full_name":"Prueba Arbitro"}'),
  ('e0020000-0000-0000-0000-000000000004', 'jugador-002@example.invalid', '{"full_name":"Prueba Jugador"}');
update public.perfiles set rol = 'administrador' where id = 'e0020000-0000-0000-0000-000000000001';
update public.perfiles set rol = 'juez_general' where id = 'e0020000-0000-0000-0000-000000000002';
update public.perfiles set rol = 'arbitro' where id = 'e0020000-0000-0000-0000-000000000003';

create temporary table identidad_test_ids (clave text primary key, id bigint not null);
grant select on identidad_test_ids to authenticated;

-- Las escrituras siguientes se ejecutan como cliente autenticado, NO como dueño.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e0020000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare
  localidad bigint;
  asociacion bigint;
  club bigint;
  jugador bigint;
begin
  insert into public.localidades(nombre) values ('Localidad prueba 002') returning id into localidad;
  insert into public.asociaciones(nombre, localidad_id) values ('Asociacion prueba 002', localidad) returning id into asociacion;
  insert into public.clubes(nombre, localidad_id, asociacion_id) values ('Club prueba 002', localidad, asociacion) returning id into club;
  insert into public.jugadores(nombre_completo, perfil_id, localidad_procedencia_id, club_id)
    values ('Homonimo prueba 002', 'e0020000-0000-0000-0000-000000000004', localidad, club)
    returning id into jugador;
  -- Mismo nombre permitido; cuenta y nacimiento no son obligatorios.
  insert into public.jugadores(nombre_completo) values ('Homonimo prueba 002');
  update public.jugadores set activo = false where id = jugador;
  if not found then raise exception 'Administrador no pudo editar'; end if;
end;
$$;
reset role;
insert into identidad_test_ids select 'localidad', id from public.localidades where nombre = 'Localidad prueba 002';
insert into identidad_test_ids select 'club', id from public.clubes where nombre = 'Club prueba 002';
insert into identidad_test_ids select 'jugador', id from public.jugadores where perfil_id = 'e0020000-0000-0000-0000-000000000004';

-- Integridad, bajo propietario para aislarla de RLS.
do $$
begin
  if (select count(*) from public.jugadores where nombre_completo = 'Homonimo prueba 002') <> 2 then
    raise exception 'Se perdieron homónimos';
  end if;
  begin
    insert into public.jugadores(nombre_completo, perfil_id) values ('Duplicado cuenta', 'e0020000-0000-0000-0000-000000000004');
    raise exception 'Se permitió reutilizar perfil';
  exception when unique_violation then null; end;
  begin
    insert into public.jugadores(nombre_completo, perfil_id) values ('FK inexistente', 'e0020000-0000-0000-0000-000000000099');
    raise exception 'Se permitió perfil inexistente';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.jugadores(nombre_completo, fecha_nacimiento) values ('Nacimiento futuro', current_date + 1);
    raise exception 'Se permitió nacimiento futuro';
  exception when check_violation then null; end;
  begin
    insert into public.jugadores(nombre_completo, fecha_nacimiento) values ('Nacimiento infinito', 'infinity');
    raise exception 'Se permitió nacimiento infinito';
  exception when check_violation then null; end;
  begin
    insert into public.jugadores(nombre_completo) values (E' \t ');
    raise exception 'Se permitió nombre vacío';
  exception when check_violation then null; end;
  begin
    insert into public.jugadores(nombre_completo, club_id) values ('Club inexistente', -1);
    raise exception 'Se permitió club inexistente';
  exception when foreign_key_violation then null; end;
  begin
    delete from public.clubes where id = (select id from identidad_test_ids where clave = 'club');
    raise exception 'Se permitió borrar club referenciado';
  exception when foreign_key_violation or restrict_violation then null; end;
  begin
    delete from public.localidades where id = (select id from identidad_test_ids where clave = 'localidad');
    raise exception 'Se permitió borrar localidad referenciada';
  exception when foreign_key_violation or restrict_violation then null; end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e0020000-0000-0000-0000-000000000004","role":"authenticated"}', true);
do $$
declare n integer;
begin
  if (select count(*) from public.jugadores where nombre_completo = 'Homonimo prueba 002') <> 1 then
    raise exception 'Jugador no ve exactamente su registro';
  end if;
  if not exists (select 1 from public.clubes where id = (select id from identidad_test_ids where clave = 'club')) then
    raise exception 'Jugador no puede consultar catálogos';
  end if;
  begin
    insert into public.jugadores(nombre_completo, perfil_id) values ('Autoalta no autorizada', auth.uid());
    raise exception 'Jugador pudo crear registros';
  exception when insufficient_privilege then null; end;
  update public.jugadores set perfil_id = null where id = (select id from identidad_test_ids where clave = 'jugador');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Jugador pudo cambiar vínculo de cuenta'; end if;
  update public.clubes set nombre = 'Cambio no autorizado' where id = (select id from identidad_test_ids where clave = 'club');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Jugador pudo editar club'; end if;
  begin
    delete from public.jugadores;
    raise exception 'Jugador tiene DELETE';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"e0020000-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
declare n integer;
begin
  if (select count(*) from public.jugadores where nombre_completo = 'Homonimo prueba 002') <> 2 then
    raise exception 'Juez no puede consultar registros deportivos';
  end if;
  begin
    insert into public.clubes(nombre) values ('Alta juez no autorizada');
    raise exception 'Juez pudo crear club';
  exception when insufficient_privilege then null; end;
  update public.jugadores set activo = true where id = (select id from identidad_test_ids where clave = 'jugador');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Juez pudo editar jugador'; end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"e0020000-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from public.jugadores where nombre_completo = 'Homonimo prueba 002') then
    raise exception 'Arbitro accedió a jugadores ajenos';
  end if;
end;
$$;

-- Incluso el administrador usa columnas autorizadas y no borra identidades.
select set_config('request.jwt.claims', '{"sub":"e0020000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
begin
  begin
    update public.jugadores set id = default;
    raise exception 'Cliente pudo editar PK';
  exception when insufficient_privilege then null; end;
  begin
    update public.jugadores set creado_en = now();
    raise exception 'Cliente pudo editar creado_en';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.jugadores;
    raise exception 'Administrador cliente tiene DELETE';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

set local role anon;
do $$
begin
  begin
    perform 1 from public.jugadores;
    raise exception 'Anon tiene SELECT de datos privados';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.localidades;
    raise exception 'Anon tiene SELECT de catálogos';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

-- La baja de Auth elimina el perfil (001), pero conserva el jugador (002).
delete from auth.users where id = 'e0020000-0000-0000-0000-000000000004';
do $$
begin
  if not exists (
    select 1 from public.jugadores
    where id = (select id from identidad_test_ids where clave = 'jugador') and perfil_id is null
  ) then raise exception 'Borrar cuenta eliminó o dejó vinculado el registro deportivo'; end if;
end;
$$;

rollback;
-- Si psql termina con código 0, todas las aserciones anteriores pasaron.
