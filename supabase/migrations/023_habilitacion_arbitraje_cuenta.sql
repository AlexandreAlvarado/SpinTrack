-- SpinTrack 023: una cuenta, identidad deportiva y habilitación independiente.
-- Solo revisión/aplicación manual después de 022. No modifica auth.users.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
 if to_regprocedure('public.autorizar_preparacion_022()') is null then
 raise exception '023 requiere 022 instalada'; end if;
end $$;
alter table public.perfiles add column arbitraje_habilitado boolean not null default false;
-- Única conversión de compatibilidad: conserva los permisos de cuentas existentes.
update public.perfiles set arbitraje_habilitado=true where rol='arbitro';
create table public.arbitraje_habilitaciones_historial (
 id bigint generated always as identity primary key,
 perfil_id uuid not null references public.perfiles(id) on delete restrict,
 habilitado boolean not null, actor_id uuid not null references public.perfiles(id) on delete restrict,
 ocurrido_en timestamptz not null default clock_timestamp()
);
alter table public.arbitraje_habilitaciones_historial enable row level security;
create policy historial_admin_023 on public.arbitraje_habilitaciones_historial for select to authenticated using (public.es_administrador());
revoke all on public.arbitraje_habilitaciones_historial from public,anon,authenticated,service_role;
grant select on public.arbitraje_habilitaciones_historial to authenticated;
create function public.proteger_habilitacion_023() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if tg_op='INSERT' then
   if new.arbitraje_habilitado then raise exception 'Alta sin habilitación' using errcode='42501'; end if;
 elsif new.arbitraje_habilitado is distinct from old.arbitraje_habilitado then
   if auth.uid() is null or public.es_administrador() is distinct from true then
     raise exception 'Solo Administrador habilita arbitraje' using errcode='42501'; end if;
   insert into public.arbitraje_habilitaciones_historial(perfil_id,habilitado,actor_id)
   values(new.id,new.arbitraje_habilitado,auth.uid());
 end if;
 return new;
end $$;
create trigger proteger_habilitacion_023 before insert or update on public.perfiles
 for each row execute function public.proteger_habilitacion_023();
create function public.habilitar_arbitraje_023(p_perfil_id uuid,p_habilitado boolean,p_esperado boolean)
returns boolean language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or public.es_administrador() is distinct from true then raise exception 'Solo Administrador' using errcode='42501'; end if;
 if p_habilitado is null or p_esperado is null then raise exception 'Estado requerido' using errcode='22023'; end if;
 update public.perfiles set arbitraje_habilitado=p_habilitado where id=p_perfil_id and arbitraje_habilitado=p_esperado;
 if not found then raise exception 'Cuenta o habilitación cambió: recargue' using errcode='40001'; end if;
 return p_habilitado;
end $$;
create or replace function public.es_arbitro_013() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.perfiles where id=auth.uid() and arbitraje_habilitado)
$$;
drop policy perfiles_arbitros_juez_013 on public.perfiles;
create policy perfiles_arbitros_juez_013 on public.perfiles for select to authenticated
 using (arbitraje_habilitado and public.es_juez_general());
create or replace function public.puede_capturar_resultado_012(p_partido_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.es_arbitro_013()
 and exists(select 1 from public.partidos_arbitros pa where pa.partido_id=p_partido_id and pa.arbitro_id=auth.uid() and pa.activo)
 and not exists(select 1 from public.partidos p join public.jugadores j on j.id in(p.jugador_a_id,p.jugador_b_id) where p.id=p_partido_id and j.perfil_id=auth.uid())
$$;
create or replace function public.asignar_arbitro_partido(p_partido_id bigint,p_arbitro_id uuid,p_referencia text)
returns bigint language plpgsql security definer set search_path='' as $$
declare p public.partidos; l public.lotes_partidos_grupos; actual public.partidos_arbitros; evento text;
begin
  if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
  if p_arbitro_id is null or nullif(btrim(p_referencia),'') is null then raise exception 'Árbitro y referencia son obligatorios' using errcode='22023'; end if;
  select * into p from public.partidos where id=p_partido_id for update;
  perform 1 from public.perfiles where id=p_arbitro_id and arbitraje_habilitado for share;
  if not found then raise exception 'La habilitación de arbitraje cambió; recargue' using errcode='42501'; end if;
  if not found then raise exception 'Partido no disponible' using errcode='22023'; end if;
  select * into l from public.lotes_partidos_grupos where id=p.lote_id for share;
  if l.estado is distinct from 'confirmado' then raise exception 'Solo se asignan partidos confirmados' using errcode='55000'; end if;
  if not exists(select 1 from public.perfiles where id=p_arbitro_id and arbitraje_habilitado) then raise exception 'Perfil no es Árbitro' using errcode='22023'; end if;
  if exists(select 1 from public.jugadores where perfil_id=p_arbitro_id and id in (p.jugador_a_id,p.jugador_b_id)) then
    raise exception 'No se permite autoarbitraje' using errcode='23514'; end if;
  select * into actual from public.partidos_arbitros where partido_id=p.id for update;
  if actual.partido_id is not null and exists(select 1 from public.resultados_partidos where partido_id=p.id)
     and exists(select 1 from public.perfiles where id=actual.arbitro_id and arbitraje_habilitado)
     and not exists(select 1 from public.jugadores where perfil_id=actual.arbitro_id and id in(p.jugador_a_id,p.jugador_b_id)) then
    raise exception 'No se puede reemplazar el rbitro despus de iniciar el historial de resultados' using errcode='55000';
  end if;
  evento := case when actual.partido_id is null then 'asignado' else case when actual.arbitro_id=p_arbitro_id then 'asignado' else 'reemplazado' end end;
  insert into public.partidos_arbitros(partido_id,arbitro_id,asignado_por,referencia,activo)
    values(p.id,p_arbitro_id,auth.uid(),btrim(p_referencia),true)
    on conflict(partido_id) do update set arbitro_id=excluded.arbitro_id,asignado_por=excluded.asignado_por,
      asignado_en=clock_timestamp(),referencia=excluded.referencia,activo=true;
  insert into public.partidos_arbitros_historial(partido_id,arbitro_id,evento,actor_id,referencia)
    values(p.id,p_arbitro_id,evento,auth.uid(),btrim(p_referencia));
  return p.id;
end $$;
create or replace function public.capturar_resultado_partido(p_partido_id bigint,p_revision_esperada integer,p_tipo text,p_sets jsonb,
  p_referencia text,p_referencia_reglas text,p_reglas_confirmadas boolean,p_descripcion text default '',p_motivo text default null)
returns bigint language plpgsql security definer set search_path='' as $$
declare p public.partidos; l public.lotes_partidos_grupos; ultima integer; resumen jsonb; nuevo bigint;
begin
  if auth.uid() is null or public.puede_capturar_resultado_012(p_partido_id) is distinct from true then raise exception 'Solo el Árbitro asignado puede capturar' using errcode='42501'; end if;
  if p_revision_esperada is null or p_revision_esperada<0 or p_tipo is null or p_tipo not in ('ordinario','incomparecencia','retiro','suspension')
    or nullif(btrim(p_referencia),'') is null or nullif(btrim(p_referencia_reglas),'') is null or p_reglas_confirmadas is distinct from true then raise exception 'Datos o reglas no confirmadas' using errcode='22023'; end if;
  select * into p from public.partidos where id=p_partido_id for update;
  perform 1 from public.perfiles where id=auth.uid() and arbitraje_habilitado for share;
  if not found then raise exception 'La habilitación de arbitraje cambió; recargue' using errcode='42501'; end if;
  select * into l from public.lotes_partidos_grupos where id=p.lote_id for share;
  if l.estado is distinct from 'confirmado' then raise exception 'Solo partidos confirmados' using errcode='55000'; end if;
  select coalesce(max(revision),0) into ultima from public.resultados_partidos where partido_id=p.id;
  if ultima<>p_revision_esperada then raise exception 'La captura cambió: recargue' using errcode='40001'; end if;
  if ultima>0 and nullif(btrim(p_motivo),'') is null then raise exception 'Corrección requiere motivo' using errcode='22023'; end if;
  if p_tipo='ordinario' then resumen:=public.calcular_resultado_sets_012(p_sets,l.mejor_de);
  elsif p_sets is distinct from '[]'::jsonb or nullif(btrim(p_descripcion),'') is null then raise exception 'Incidencia requiere descripción, sin sets ni ganador automático' using errcode='22023'; end if;
  insert into public.resultados_partidos(partido_id,revision,tipo,sets,mejor_de,sets_a,sets_b,ganador_id,descripcion,referencia_reglas,referencia,motivo_correccion,autor_id)
    values(p.id,ultima+1,p_tipo,p_sets,l.mejor_de,(resumen->>'sets_a')::integer,(resumen->>'sets_b')::integer,
      case when resumen->>'ganador'='a' then p.jugador_a_id when resumen->>'ganador'='b' then p.jugador_b_id end,
      coalesce(btrim(p_descripcion),''),btrim(p_referencia_reglas),btrim(p_referencia),nullif(btrim(p_motivo),''),auth.uid()) returning id into nuevo;
  return nuevo;
end $$;
create or replace function public.operar_eliminatoria_018(p_partido_id bigint,p_operacion text,p_revision integer,p_referencia text,
 p_arbitro_id uuid default null,p_sets jsonb default null) returns bigint
language plpgsql security definer set search_path='' as $$
declare p public.eliminatorias_partidos; c public.eliminatorias_cuadros; a public.eliminatorias_actas; resumen jsonb; winner bigint; loser bigint; aid bigint;
begin
 if auth.uid() is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 if p_operacion is null or p_operacion not in ('asignar','comenzar','enviar','observar','confirmar') then raise exception 'Operación inválida' using errcode='22023'; end if;
 if nullif(btrim(p_referencia),'') is null or length(p_referencia)>2000 then raise exception 'Referencia obligatoria' using errcode='22023'; end if;
 select * into c from public.eliminatorias_cuadros where llave_id=(select llave_id from public.eliminatorias_partidos where id=p_partido_id) for update;
 select * into p from public.eliminatorias_partidos where id=p_partido_id for update;
 if p.id is null then raise exception 'Partido no disponible' using errcode='55000'; end if;
 if p_operacion in ('comenzar','enviar') then
   perform 1 from public.perfiles where id=auth.uid() and arbitraje_habilitado for share;
   if not found then raise exception 'La habilitación de arbitraje cambió; recargue' using errcode='42501'; end if;
 end if;
 if p_operacion in ('asignar','observar','confirmar') then
   if public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
 else
   if public.es_arbitro_013() is distinct from true or p.arbitro_id is distinct from auth.uid() then raise exception 'Solo Árbitro asignado' using errcode='42501'; end if;
 end if;
 if p_operacion in ('comenzar','enviar') and exists(select 1 from public.jugadores where perfil_id=auth.uid() and id in(p.jugador_a_id,p.jugador_b_id)) then raise exception 'Autoarbitraje: requiere reasignación del Juez' using errcode='23514'; end if;
 if p_operacion='confirmar' and p.estado='confirmado' and p.revision=p_revision then return p.id; end if;
 if c.estado<>'en_curso' or p.estado='confirmado' then raise exception 'Resultado confirmado inmutable' using errcode='55000'; end if;
 if p.revision is distinct from p_revision then raise exception 'Revisión cambió: recargue' using errcode='40001'; end if;
 if p.jugador_a_id is null or p.jugador_b_id is null then raise exception 'Participantes pendientes' using errcode='55000'; end if;
 if exists(select 1 from public.eliminatorias_partidos where llave_id=p.llave_id and perdedor_id in (p.jugador_a_id,p.jugador_b_id)) then raise exception 'Jugador eliminado' using errcode='55000'; end if;
 if p_operacion='asignar' then
   if (p.revision>0 and p.estado<>'observado') or p.estado not in ('pendiente','en_desarrollo','observado') then raise exception 'Asignación ya utilizada: observar antes de reasignar' using errcode='55000'; end if;
   if not exists(select 1 from public.perfiles where id=p_arbitro_id and arbitraje_habilitado)
   or exists(select 1 from public.jugadores where perfil_id=p_arbitro_id and id in (p.jugador_a_id,p.jugador_b_id)) then raise exception 'Árbitro inválido o autoarbitraje' using errcode='23514'; end if;
   update public.eliminatorias_partidos set arbitro_id=p_arbitro_id where id=p.id;
 elsif p_operacion='comenzar' then
   if p.estado<>'pendiente' then raise exception 'Partido ya iniciado' using errcode='55000'; end if;
   update public.eliminatorias_partidos set estado='en_desarrollo' where id=p.id;
 elsif p_operacion='enviar' then
   if p.estado not in ('pendiente','en_desarrollo','observado') then raise exception 'Espere revisión del Juez' using errcode='55000'; end if;
   resumen:=public.calcular_resultado_sets_012(p_sets,p.mejor_de);
   winner:=case resumen->>'ganador' when 'a' then p.jugador_a_id else p.jugador_b_id end;
   insert into public.eliminatorias_actas(partido_id,revision,sets,sets_a,sets_b,ganador_id,autor_id,referencia)
   values(p.id,p.revision+1,p_sets,(resumen->>'sets_a')::integer,(resumen->>'sets_b')::integer,winner,auth.uid(),p_referencia) returning id into aid;
   update public.eliminatorias_partidos set revision=revision+1,estado='revision' where id=p.id;
 else
   if p.estado<>'revision' then raise exception 'Se requiere un resultado enviado sin observaciones pendientes' using errcode='55000'; end if;
   select * into strict a from public.eliminatorias_actas where partido_id=p.id and revision=p.revision;
   aid:=a.id;
   if a.autor_id=auth.uid() then raise exception 'No se permite revisar el propio resultado' using errcode='42501'; end if;
   if p_operacion='observar' then
     update public.eliminatorias_partidos set estado='observado' where id=p.id;
   else
     resumen:=public.calcular_resultado_sets_012(a.sets,p.mejor_de);
     winner:=case resumen->>'ganador' when 'a' then p.jugador_a_id else p.jugador_b_id end;
     if a.ganador_id<>winner or a.sets_a<>(resumen->>'sets_a')::integer or a.sets_b<>(resumen->>'sets_b')::integer then raise exception 'Acta inconsistente' using errcode='23514'; end if;
     loser:=case winner when p.jugador_a_id then p.jugador_b_id else p.jugador_a_id end;
     update public.eliminatorias_partidos set estado='confirmado',ganador_id=winner,perdedor_id=loser where id=p.id;
     update public.eliminatorias_partidos set jugador_a_id=winner where llave_id=p.llave_id and fuente_a_id=p.id and jugador_a_id is null;
     update public.eliminatorias_partidos set jugador_b_id=winner where llave_id=p.llave_id and fuente_b_id=p.id and jugador_b_id is null;
     if not exists(select 1 from public.eliminatorias_partidos where llave_id=p.llave_id and (fuente_a_id=p.id or fuente_b_id=p.id)) then
       if exists(select 1 from public.eliminatorias_partidos where llave_id=p.llave_id and estado<>'confirmado') then raise exception 'Final incompleta' using errcode='23514'; end if;
       update public.eliminatorias_cuadros set estado='finalizado',campeon_id=winner,finalista_id=loser,finalizado_en=clock_timestamp() where llave_id=p.llave_id;
       insert into public.eliminatorias_eventos(llave_id,partido_id,acta_id,evento,actor_id,referencia) values(p.llave_id,p.id,aid,'campeon',auth.uid(),p_referencia);
     end if;
   end if;
 end if;
 insert into public.eliminatorias_eventos(llave_id,partido_id,acta_id,evento,actor_id,referencia)
 values(p.llave_id,p.id,aid,case p_operacion when 'asignar' then 'asignado' when 'comenzar' then 'en_desarrollo' when 'enviar' then 'enviado' when 'observar' then 'observado' else 'confirmado' end,auth.uid(),p_referencia);
 return p.id;
end $$;
create or replace function public.preparar_asignar_final_eliminatoria_020(
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
  if not exists(select 1 from public.perfiles where id=p_arbitro_id and arbitraje_habilitado) then
    raise exception 'Perfil no es Árbitro' using errcode='23514';
  end if;
  perform public.operar_eliminatoria_018(m.id,'asignar',m.revision,p_referencia,p_arbitro_id,null);
  return m.id;
end $$;
create or replace function public.proteger_asignacion_arbitro_020() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if new.arbitro_id is not distinct from old.arbitro_id then return new; end if;
 if public.es_juez_general() is distinct from true or (old.revision>0 and old.estado<>'observado') or old.estado not in ('pendiente','en_desarrollo','observado') then raise exception 'Reasignación no autorizada' using errcode='42501'; end if;
 if old.arbitro_id is not null and exists(select 1 from public.perfiles where id=old.arbitro_id and arbitraje_habilitado)
 and not exists(select 1 from public.jugadores where perfil_id=old.arbitro_id and id in(old.jugador_a_id,old.jugador_b_id)) then raise exception 'Asignación vigente' using errcode='55000'; end if;
 perform pg_catalog.pg_advisory_xact_lock(2026004,pg_catalog.hashtext(new.arbitro_id::text));
 if not exists(select 1 from public.perfiles where id=new.arbitro_id and arbitraje_habilitado)
 or exists(select 1 from public.jugadores where perfil_id=new.arbitro_id and id in(new.jugador_a_id,new.jugador_b_id)) then raise exception 'Árbitro inválido o autoarbitraje' using errcode='23514'; end if;
 if exists(select 1 from public.eliminatorias_partidos where arbitro_id=new.arbitro_id and estado<>'confirmado' and id<>new.id) then raise exception 'Asignación operativa incompatible' using errcode='55000'; end if;
 return new;
end $$;
-- La vinculación de fichas se serializa con las operaciones arbitrales.
create function public.serializar_identidad_arbitraje_023() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 return new;
end $$;
create trigger serializar_identidad_arbitraje_023 before insert or update of perfil_id on public.jugadores
 for each row execute function public.serializar_identidad_arbitraje_023();
revoke all on function public.proteger_habilitacion_023(),public.serializar_identidad_arbitraje_023(),public.habilitar_arbitraje_023(uuid,boolean,boolean) from public,anon,authenticated,service_role;
grant execute on function public.habilitar_arbitraje_023(uuid,boolean,boolean),public.es_arbitro_013() to authenticated;
-- Las lecturas operativas de 014 también exigen habilitación vigente.
drop policy lotes_arbitros_asignados_014 on public.lotes_partidos_grupos;
create policy lotes_arbitros_asignados_014 on public.lotes_partidos_grupos for select to authenticated
 using (public.es_arbitro_013() and exists(select 1 from public.partidos p join public.partidos_arbitros pa on pa.partido_id=p.id where p.lote_id=lotes_partidos_grupos.id and pa.arbitro_id=auth.uid() and pa.activo));
drop policy partidos_arbitros_asignados_014 on public.partidos;
create policy partidos_arbitros_asignados_014 on public.partidos for select to authenticated
 using (public.es_arbitro_013() and exists(select 1 from public.partidos_arbitros pa where pa.partido_id=partidos.id and pa.arbitro_id=auth.uid() and pa.activo));
drop policy jugadores_arbitros_asignados_014 on public.jugadores;
create policy jugadores_arbitros_asignados_014 on public.jugadores for select to authenticated
 using (public.es_arbitro_013() and exists(select 1 from public.partidos p join public.partidos_arbitros pa on pa.partido_id=p.id where pa.arbitro_id=auth.uid() and pa.activo and jugadores.id in(p.jugador_a_id,p.jugador_b_id)));
commit;
