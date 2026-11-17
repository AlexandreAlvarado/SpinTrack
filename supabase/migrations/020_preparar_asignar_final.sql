-- SpinTrack 020: prepara una final autorizada y asigna su árbitro en una sola transacción.
-- Aplicación manual pendiente. No modifica 001–019 ni convierte llaves históricas.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create function public.preparar_asignar_final_eliminatoria_020(
  p_llave_id bigint,
  p_arbitro_id uuid,
  p_referencia text
) returns bigint
language plpgsql security definer set search_path='' as $$
declare
  k public.eliminatorias_llaves;
  cuadro public.eliminatorias_cuadros;
  m public.eliminatorias_partidos;
  grupos integer;
  encuentros integer;
begin
  if auth.uid() is null or public.es_juez_general() is distinct from true then
    raise exception 'Solo Juez General' using errcode='42501';
  end if;
  if p_llave_id is null or p_arbitro_id is null or nullif(btrim(p_referencia),'') is null then
    raise exception 'Llave, árbitro y referencia son obligatorios' using errcode='22023';
  end if;

  -- Rechazar antes de iniciar cualquier cuadro que no sea la final 019 de grupo único.
  select * into k from public.eliminatorias_llaves where id=p_llave_id;
  if not found or k.estado<>'confirmada' or k.propuesta->>'version_regla' is distinct from '19'
     or k.posiciones<>2 or k.clasificados<>2 or k.pases_automaticos<>0
     or k.propuesta->>'metodo_distribucion' is distinct from 'final_grupo_unico'
     or not k.reglas_confirmadas or not k.datos_reales_confirmados
     or not exists(select 1 from public.eliminatorias_respaldos where llave_id=k.id) then
    raise exception 'Solo se puede preparar una final 019 confirmada y autorizada' using errcode='55000';
  end if;
  select count(*) into grupos from public.grupos_competencia where competencia_id=k.competencia_id and estado='confirmado';
  if grupos<>1 then raise exception 'La asignación directa solo aplica a competencias de grupo único' using errcode='55000'; end if;
  select count(*) into encuentros from public.eliminatorias_enfrentamientos where llave_id=k.id;
  if encuentros<>1 then raise exception 'La llave no contiene una única final' using errcode='55000'; end if;

  -- 018 adquiere el bloqueo de competencia y valida respaldo, formato y participantes.
  perform public.iniciar_eliminatoria_018(p_llave_id, p_referencia);
  -- El orden coincide con operar_eliminatoria_018: cuadro y después partido.
  select * into cuadro from public.eliminatorias_cuadros where llave_id=p_llave_id for update;
  select * into m
    from public.eliminatorias_partidos
   where llave_id=p_llave_id and ronda_numero=1 and estado='pendiente'
     and jugador_a_id is not null and jugador_b_id is not null
   order by id
   limit 1
   for update;
  if m.id is null then
    raise exception 'No hay una final pendiente y habilitada' using errcode='55000';
  end if;
  if (select count(*) from public.eliminatorias_partidos where llave_id=p_llave_id)<>1
     or cuadro.llave_id is null then
    raise exception 'El cuadro operativo no es una única final' using errcode='55000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(2026004, pg_catalog.hashtext(p_arbitro_id::text));
  if m.arbitro_id is not null then
    if m.arbitro_id=p_arbitro_id then return m.id; end if;
    raise exception 'El encuentro ya tiene otro árbitro asignado' using errcode='55000';
  end if;
  if exists (
    select 1 from public.eliminatorias_partidos p
     where p.arbitro_id=p_arbitro_id and p.estado not in ('confirmado') and p.id<>m.id
  ) then
    raise exception 'El árbitro ya tiene una asignación operativa incompatible' using errcode='55000';
  end if;
  if not exists(select 1 from public.perfiles where id=p_arbitro_id and rol='arbitro'::public.rol_usuario) then
    raise exception 'Perfil no es Árbitro' using errcode='23514';
  end if;
  perform public.operar_eliminatoria_018(m.id,'asignar',m.revision,p_referencia,p_arbitro_id,null);
  return m.id;
end $$;

create or replace function public.proteger_asignacion_arbitro_020()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.arbitro_id is not distinct from old.arbitro_id then return new; end if;
  if old.arbitro_id is not null then
    raise exception 'La asignación existente no puede sustituirse mediante una asignación normal' using errcode='55000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(2026004, pg_catalog.hashtext(new.arbitro_id::text));
  if exists(select 1 from public.eliminatorias_partidos where arbitro_id=new.arbitro_id and estado<>'confirmado' and id<>new.id) then
    raise exception 'El árbitro ya tiene una asignación operativa incompatible' using errcode='55000';
  end if;
  if exists(select 1 from public.jugadores where perfil_id=new.arbitro_id and id in (new.jugador_a_id,new.jugador_b_id)) then
    raise exception 'No se permite autoarbitraje' using errcode='23514';
  end if;
  return new;
end $$;

drop trigger if exists proteger_asignacion_arbitro_020 on public.eliminatorias_partidos;
create trigger proteger_asignacion_arbitro_020
before update of arbitro_id on public.eliminatorias_partidos
for each row execute function public.proteger_asignacion_arbitro_020();

revoke all on function public.preparar_asignar_final_eliminatoria_020(bigint,uuid,text),public.proteger_asignacion_arbitro_020() from public,anon,authenticated,service_role;
grant execute on function public.preparar_asignar_final_eliminatoria_020(bigint,uuid,text) to authenticated;
commit;
