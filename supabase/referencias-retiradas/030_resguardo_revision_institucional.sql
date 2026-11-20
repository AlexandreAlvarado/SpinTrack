-- REVISIÓN Y APLICACIÓN MANUAL. No aplicar desde esta tarea.
-- Resguardo temporal: no presume edad, consentimiento ni aprobación institucional.
-- No cambia reglas, resultados, asignaciones ni aceptaciones históricas.
begin;
set local lock_timeout = '5s';

-- Conservar implementaciones deportivas; retirar acceso directo, también con JWT.
alter function public.consultar_torneos_publicos_025(bigint) rename to torneos_internos_revision_030;
revoke all on function public.torneos_internos_revision_030(bigint) from public,anon,authenticated,service_role;
create function public.consultar_torneos_publicos_025(p_competencia_id bigint default null)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('temporadas',datos->'temporadas','jornadas',datos->'jornadas',
    'competencias','[]'::jsonb,'detalle',null)
  from (select public.torneos_internos_revision_030(null) datos) origen;
$$;
revoke all on function public.consultar_torneos_publicos_025(bigint) from public,anon,authenticated,service_role;
grant execute on function public.consultar_torneos_publicos_025(bigint) to anon,authenticated;

alter function public.consultar_ranking_publico_026() rename to ranking_interno_revision_030;
revoke all on function public.ranking_interno_revision_030() from public,anon,authenticated,service_role;
create function public.consultar_ranking_publico_026() returns jsonb
language sql stable security definer set search_path='' as $$ select '[]'::jsonb; $$;
revoke all on function public.consultar_ranking_publico_026() from public,anon,authenticated,service_role;
grant execute on function public.consultar_ranking_publico_026() to anon,authenticated;

create function public.bloquear_nuevos_datos_revision_030() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  raise exception 'Revisión institucional pendiente: no se reciben altas ni nuevas aceptaciones' using errcode='55000';
end;
$$;
revoke all on function public.bloquear_nuevos_datos_revision_030() from public,anon,authenticated,service_role;
create trigger resguardo_alta_revision_030 before insert on auth.users
for each row execute function public.bloquear_nuevos_datos_revision_030();
create trigger resguardo_aceptacion_revision_030 before insert on public.aceptaciones_legales_028
for each row execute function public.bloquear_nuevos_datos_revision_030();
revoke execute on function public.editar_mi_perfil_deportivo_029(bigint,date,bigint,bigint,jsonb) from authenticated;

-- La versión vigente NO cambia: el borrador aún no se activa ni acepta.
-- Retirar estos bloqueos requiere otra revisión: aprobación del Presidente,
-- verificación de menores y autorización de publicación. No hay bypass por metadata.
commit;
