-- SpinTrack 021: respaldo reutilizable para la regla configurada de finales.
-- No modifica 001-020 ni escribe datos de producción automáticamente.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.competencia_formato_final_021 (
  competencia_id bigint primary key references public.competencias(id) on delete cascade,
  mejor_de smallint not null default 5 check (mejor_de = 5),
  referencia_resolucion text not null check (length(btrim(referencia_resolucion)) between 1 and 1000),
  actualizado_por uuid not null,
  actualizado_en timestamptz not null default clock_timestamp()
);

alter table public.competencia_formato_final_021 enable row level security;
revoke all on public.competencia_formato_final_021 from public, anon, authenticated, service_role;
grant select on public.competencia_formato_final_021 to authenticated;
create policy competencia_formato_final_021_lectura on public.competencia_formato_final_021
  for select to authenticated using ((select public.es_juez_general()) or (select public.es_administrador()));

create or replace function public.configurar_formato_final_021(p_competencia_id bigint, p_referencia text)
returns boolean language plpgsql security definer set search_path='' as $$
declare f public.competencia_formatos_sets; c public.competencias; hay_partidos boolean := false;
begin
  if auth.uid() is null or public.es_juez_general() is distinct from true then
    raise exception 'Solo Juez General' using errcode='42501';
  end if;
  if nullif(btrim(p_referencia),'') is null then
    raise exception 'Referencia deportiva obligatoria para la regla de final' using errcode='22023';
  end if;
  select * into strict c from public.competencias where id=p_competencia_id for update;
  perform 1 from public.competencia_control_deportivo where competencia_id=p_competencia_id for update;
  select * into f from public.competencia_formatos_sets where competencia_id=p_competencia_id and etapa='final' for share;
  if not found then
    insert into public.competencia_formatos_sets(competencia_id,etapa,mejor_de,referencia_resolucion,actualizado_por)
    values(p_competencia_id,'final',5,btrim(p_referencia),auth.uid());
  elsif f.mejor_de <> 5 then
    -- Una referencia heredada de mejor de 3 no se reutiliza: el Juez debe
    -- registrar explícitamente el respaldo de la nueva regla de final.
    if nullif(btrim(f.referencia_resolucion),'') is not null
       and btrim(p_referencia)=btrim(f.referencia_resolucion) then
      raise exception 'La final al mejor de 5 necesita una referencia deportiva nueva' using errcode='55000';
    end if;
    if to_regclass('public.lotes_partidos_grupos') is not null then
      execute 'select exists(select 1 from public.lotes_partidos_grupos where competencia_id=$1 and estado=''confirmado'')'
        into hay_partidos using p_competencia_id;
    end if;
    if not hay_partidos then
      update public.competencia_formatos_sets set mejor_de=5,referencia_resolucion=btrim(p_referencia)
       where competencia_id=p_competencia_id and etapa='final';
    end if;
  end if;
  insert into public.competencia_formato_final_021(competencia_id,mejor_de,referencia_resolucion,actualizado_por)
  values(p_competencia_id,5,btrim(p_referencia),auth.uid())
  on conflict (competencia_id) do update set mejor_de=5,referencia_resolucion=excluded.referencia_resolucion,
    actualizado_por=excluded.actualizado_por,actualizado_en=clock_timestamp();
  return true;
end $$;

-- 018 sigue siendo el punto único de inicio. Esta versión acepta el respaldo
-- persistido por 021 cuando la fila heredada tiene referencia NULL.
create or replace function public.iniciar_eliminatoria_018(p_llave_id bigint,p_referencia text) returns bigint
language plpgsql security definer set search_path='' as $$
declare k public.eliminatorias_llaves; m record; fmt public.competencia_formatos_sets; sid bigint; src jsonb; side text; respaldo text; fmt_found boolean;
begin
 if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
 if nullif(btrim(p_referencia),'') is null then raise exception 'Referencia obligatoria' using errcode='22023'; end if;
 select competencia_id into strict k.competencia_id from public.eliminatorias_llaves where id=p_llave_id;
 perform pg_catalog.pg_advisory_xact_lock(2026003,2); perform 1 from public.competencias where id=k.competencia_id for update; perform public.bloquear_fuente_eliminatoria_016(k.competencia_id); select * into k from public.eliminatorias_llaves where id=p_llave_id for update;
 if k.estado<>'confirmada' or (k.propuesta->>'version_regla') not in ('17','19') or not k.reglas_confirmadas or not k.datos_reales_confirmados or not exists(select 1 from public.eliminatorias_respaldos where llave_id=k.id) then raise exception 'Falta llave oficial y respaldo deportivo manual' using errcode='55000'; end if;
 if exists(select 1 from public.eliminatorias_cuadros where llave_id=k.id) then return k.id; end if;
 if (k.propuesta->>'version_regla')='19' then perform public.validar_eliminatoria_019(k.competencia_id,k.propuesta); else perform public.validar_eliminatoria_016(k.competencia_id,k.propuesta); end if;
 insert into public.eliminatorias_cuadros(llave_id,competencia_id,iniciado_por) values(k.id,k.competencia_id,auth.uid());
 for m in select e.*,r.numero rn,r.posiciones from public.eliminatorias_enfrentamientos e join public.eliminatorias_rondas r on r.id=e.ronda_id where e.llave_id=k.id order by r.numero,e.numero loop
   select * into fmt from public.competencia_formatos_sets where competencia_id=k.competencia_id and etapa=case m.posiciones when 2 then 'final' when 4 then 'semifinal' when 8 then 'cuartos' else 'previa_cuartos' end for share;
   fmt_found := found;
   respaldo := nullif(btrim(fmt.referencia_resolucion),'');
   if m.posiciones=2 and fmt_found and fmt.mejor_de=3 then respaldo := null; end if;
   if m.posiciones=2 and respaldo is null then select nullif(btrim(referencia_resolucion),'') into respaldo from public.competencia_formato_final_021 where competencia_id=k.competencia_id; end if;
   if not fmt_found or fmt.mejor_de not in (3,5) or respaldo is null then raise exception 'Falta formato de sets respaldado para la ronda' using errcode='55000'; end if;
   insert into public.eliminatorias_partidos(id,llave_id,ronda_id,numero,ronda_numero,jugador_a_id,jugador_b_id,mejor_de,referencia_reglas) values(m.id,k.id,m.ronda_id,m.numero,m.rn,m.jugador_a_id,m.jugador_b_id,case when m.posiciones=2 then 5 else fmt.mejor_de end,respaldo);
   foreach side in array array['a','b'] loop src:=case side when 'a' then m.origen_a else m.origen_b end; if src->>'tipo'='ganador' then select p.id into sid from public.eliminatorias_partidos p where p.llave_id=k.id and format('R%s-C%s',p.ronda_numero,p.numero)=src->>'cruce' and p.ronda_numero<m.rn; if sid is null then raise exception 'Origen ganador inválido' using errcode='23514'; end if; if side='a' then update public.eliminatorias_partidos set fuente_a_id=sid where id=m.id; else update public.eliminatorias_partidos set fuente_b_id=sid where id=m.id; end if; end if; end loop;
 end loop;
 insert into public.eliminatorias_eventos(llave_id,evento,actor_id,referencia) values(k.id,'iniciado',auth.uid(),p_referencia); return k.id;
end $$;

revoke all on function public.configurar_formato_final_021(bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.configurar_formato_final_021(bigint,text) to authenticated;
revoke all on function public.iniciar_eliminatoria_018(bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.iniciar_eliminatoria_018(bigint,text) to authenticated;
commit;
