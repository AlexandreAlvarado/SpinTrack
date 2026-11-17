-- SpinTrack 022: la preparación deportiva pertenece al Administrador.
-- Aplicar solo si 021 ya está instalada. No ejecuta cambios de datos.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Dependencia estricta: 022 reemplaza la RPC creada por 021.
do $$
begin
  if to_regclass('public.competencia_formato_final_021') is null
     or to_regprocedure('public.configurar_formato_final_021(bigint,text)') is null then
    raise exception '022 requiere la migración 021 instalada' using errcode='3F000';
  end if;
end $$;

create or replace function public.autorizar_preparacion_022() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(2026003, 1);
  if tg_op='DELETE' then
    if public.es_administrador() is distinct from true then
      raise exception 'Configuración reservada al Administrador' using errcode='42501';
    end if;
    if tg_table_name='competencia_control_deportivo'
       and (old.configuracion_aprobada or old.estado_deportivo<>'pendiente') then
      raise exception 'La preparación ya fue entregada al Juez General' using errcode='55000';
    end if;
    if tg_table_name='competencia_formatos_sets'
       and exists(select 1 from public.competencia_control_deportivo c where c.competencia_id=old.competencia_id and (c.configuracion_aprobada or c.estado_deportivo<>'pendiente')) then
      raise exception 'La preparación ya fue entregada al Juez General' using errcode='55000';
    end if;
    return old;
  end if;
  if tg_table_name='competencia_formatos_sets' then
    if public.es_administrador() is distinct from true then raise exception 'Solo Administrador puede configurar formatos' using errcode='42501'; end if;
    if exists(select 1 from public.competencia_control_deportivo c where c.competencia_id=new.competencia_id and (c.configuracion_aprobada or c.estado_deportivo<>'pendiente')) then raise exception 'La preparación ya fue entregada al Juez General' using errcode='55000'; end if;
    new.actualizado_por:=auth.uid(); new.actualizado_en:=statement_timestamp(); return new;
  end if;
  if public.es_administrador() then
    if tg_op='UPDATE' and (old.configuracion_aprobada or old.estado_deportivo<>'pendiente') then raise exception 'La preparación ya fue entregada al Juez General' using errcode='55000'; end if;
    new.actualizado_por:=auth.uid(); new.actualizado_en:=statement_timestamp();
    if new.configuracion_aprobada then new.aprobado_por:=auth.uid(); new.aprobado_en:=statement_timestamp(); else new.aprobado_por:=null; new.aprobado_en:=null; end if;
    return new;
  end if;
  raise exception 'Configuración reservada al Administrador' using errcode='42501';
end $$;

drop trigger if exists a_autorizar on public.competencia_control_deportivo;
drop trigger if exists a_autorizar on public.competencia_formatos_sets;
create trigger a_autorizar before insert or update or delete on public.competencia_control_deportivo for each row execute function public.autorizar_preparacion_022();
create trigger a_autorizar before insert or update or delete on public.competencia_formatos_sets for each row execute function public.autorizar_preparacion_022();

drop policy if exists preparacion_admin_022 on public.competencia_control_deportivo;
create policy preparacion_admin_022 on public.competencia_control_deportivo for all to authenticated using ((select public.es_administrador())) with check ((select public.es_administrador()));
drop policy if exists formatos_admin_022 on public.competencia_formatos_sets;
create policy formatos_admin_022 on public.competencia_formatos_sets for all to authenticated using ((select public.es_administrador())) with check ((select public.es_administrador()));

create or replace function public.configurar_formato_final_021(p_competencia_id bigint,p_referencia text)
returns boolean language plpgsql security definer set search_path='' as $$
declare f public.competencia_formatos_sets; c public.competencias; hay_partidos boolean:=false;
begin
 if auth.uid() is null or public.es_administrador() is distinct from true then raise exception 'Solo Administrador' using errcode='42501'; end if;
 if nullif(btrim(p_referencia),'') is null then raise exception 'Referencia deportiva obligatoria para la regla de final' using errcode='22023'; end if;
 select * into strict c from public.competencias where id=p_competencia_id for update;
  perform 1 from public.competencia_control_deportivo
    where competencia_id=p_competencia_id
      and configuracion_aprobada=false
      and estado_deportivo='pendiente'
    for update;
  if not found then
    raise exception 'La preparación ya fue entregada o la competencia está en curso' using errcode='55000';
  end if;
 select * into f from public.competencia_formatos_sets where competencia_id=p_competencia_id and etapa='final' for share;
 if not found then
   insert into public.competencia_formatos_sets(competencia_id,etapa,mejor_de,referencia_resolucion,actualizado_por) values(p_competencia_id,'final',5,btrim(p_referencia),auth.uid());
 elsif f.mejor_de<>5 then
   execute 'select exists(select 1 from public.lotes_partidos_grupos where competencia_id=$1 and estado=''confirmado'')' into hay_partidos using p_competencia_id;
   if not hay_partidos then update public.competencia_formatos_sets set mejor_de=5,referencia_resolucion=btrim(p_referencia) where competencia_id=p_competencia_id and etapa='final'; else raise exception 'La final antigua requiere una nueva referencia y revisión administrativa' using errcode='55000'; end if;
 end if;
 insert into public.competencia_formato_final_021(competencia_id,mejor_de,referencia_resolucion,actualizado_por) values(p_competencia_id,5,btrim(p_referencia),auth.uid()) on conflict (competencia_id) do update set mejor_de=5,referencia_resolucion=excluded.referencia_resolucion,actualizado_por=excluded.actualizado_por,actualizado_en=clock_timestamp();
 return true;
end $$;

revoke all on function public.configurar_formato_final_021(bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.configurar_formato_final_021(bigint,text) to authenticated;
commit;
