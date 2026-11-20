-- APLICACIÓN MANUAL, solo tras confirmar que el contenido aprobado corresponde
-- exactamente a 2026-11-19.1. No ejecutar remotamente desde herramientas.
-- Instala/repara únicamente el subsistema legal de 028; no modifica usuarios,
-- roles, perfiles, fichas, resultados ni aceptaciones históricas.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.version_legal_028 (
  id boolean primary key default true check(id),
  version text not null check(length(version) between 1 and 80)
);
create table if not exists public.aceptaciones_legales_028 (
  usuario_id uuid not null references auth.users(id) on delete restrict,
  version text not null,
  aceptado_en timestamptz not null default clock_timestamp(),
  origen text not null check(origen in ('registro','sesion')),
  primary key(usuario_id,version)
);

-- No sobrescribir una versión distinta ni permitir una configuración ambigua.
lock table public.version_legal_028 in share row exclusive mode;
do $$
begin
  if exists(select 1 from public.version_legal_028 where id is distinct from true or version <> '2026-11-19.1') then
    raise exception 'La versión instalada no coincide con 2026-11-19.1; revisar antes de activar' using errcode='22023';
  end if;
end;
$$;
insert into public.version_legal_028(id,version) values(true,'2026-11-19.1') on conflict(id) do nothing;

alter table public.version_legal_028 enable row level security;
alter table public.aceptaciones_legales_028 enable row level security;
revoke all on public.version_legal_028,public.aceptaciones_legales_028 from public,anon,authenticated,service_role;
grant select on public.version_legal_028 to anon,authenticated;
grant select on public.aceptaciones_legales_028 to authenticated;
drop policy if exists version_publica_028 on public.version_legal_028;
create policy version_publica_028 on public.version_legal_028 for select to anon,authenticated using(true);
drop policy if exists aceptacion_propia_028 on public.aceptaciones_legales_028;
create policy aceptacion_propia_028 on public.aceptaciones_legales_028 for select to authenticated using(usuario_id=auth.uid());

create or replace function public.estado_legal_028() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('version',v.version,'aceptada',exists(
    select 1 from public.aceptaciones_legales_028 a where a.usuario_id=auth.uid() and a.version=v.version
  )) from public.version_legal_028 v where id;
$$;
create or replace function public.aceptar_terminos_028(p_version text,p_acepta boolean) returns void
language plpgsql security definer set search_path='' as $$
declare actual text;
begin
  if auth.uid() is null then raise exception 'Se requiere sesión' using errcode='42501'; end if;
  select version into actual from public.version_legal_028 where id for share;
  if actual is null or p_acepta is distinct from true or p_version is distinct from actual then
    raise exception 'Revisar y aceptar versión vigente' using errcode='22023';
  end if;
  insert into public.aceptaciones_legales_028(usuario_id,version,origen)
    values(auth.uid(),actual,'sesion') on conflict(usuario_id,version) do nothing;
end;
$$;
create or replace function public.validar_registro_legal_028() returns trigger
language plpgsql security definer set search_path='' as $$
declare actual text;
begin
  select version into actual from public.version_legal_028 where id for share;
  if actual is null or new.raw_user_meta_data->>'terminos_version' is distinct from actual
    or new.raw_user_meta_data->>'terminos_aceptados' is distinct from 'true' then
    raise exception 'Es obligatorio aceptar los términos vigentes' using errcode='23514';
  end if;
  return new;
end;
$$;
create or replace function public.registrar_aceptacion_028() returns trigger
language plpgsql security definer set search_path='' as $$
declare actual text;
begin
  select version into actual from public.version_legal_028 where id for share;
  if actual is null or new.raw_user_meta_data->>'terminos_version' is distinct from actual
    or new.raw_user_meta_data->>'terminos_aceptados' is distinct from 'true' then
    raise exception 'Registro sin aceptación vigente' using errcode='23514';
  end if;
  insert into public.aceptaciones_legales_028(usuario_id,version,origen) values(new.id,actual,'registro');
  return new;
end;
$$;
drop trigger if exists validar_registro_legal_028 on auth.users;
create trigger validar_registro_legal_028 before insert on auth.users for each row execute function public.validar_registro_legal_028();
drop trigger if exists registrar_aceptacion_028 on auth.users;
create trigger registrar_aceptacion_028 after insert on auth.users for each row execute function public.registrar_aceptacion_028();

-- Retirar solo el veto general de revisión. No retirar los resguardos de datos
-- deportivos ni restaurar publicación/RPC de edición personal revocados en 030.
drop trigger if exists resguardo_alta_revision_030 on auth.users;
drop trigger if exists resguardo_aceptacion_revision_030 on public.aceptaciones_legales_028;
revoke all on function public.estado_legal_028(),public.aceptar_terminos_028(text,boolean),
  public.validar_registro_legal_028(),public.registrar_aceptacion_028() from public,anon,authenticated,service_role;
grant execute on function public.estado_legal_028() to anon,authenticated;
grant execute on function public.aceptar_terminos_028(text,boolean) to authenticated;
commit;

-- Verificación manual sin exponer identidades ni crear aceptaciones:
select version from public.version_legal_028 where id;
select to_regprocedure('public.estado_legal_028()') as consulta,
       to_regprocedure('public.aceptar_terminos_028(text,boolean)') as aceptacion;
