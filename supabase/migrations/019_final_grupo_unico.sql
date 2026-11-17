-- SpinTrack 019: final independiente para competencias con un solo grupo.
-- Aplicación manual sobre 018. No modifica migraciones anteriores ni convierte llaves históricas.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $$ begin
  if to_regprocedure('public.guardar_propuesta_eliminatoria_017(bigint,jsonb,text)') is null
  or to_regprocedure('public.iniciar_eliminatoria_018(bigint,text)') is null
  or to_regprocedure('public.operar_eliminatoria_018(bigint,text,integer,text,uuid,jsonb)') is null
  then raise exception '019 requiere 017 y 018; detener y revisar'; end if;
end $$;

create function public.validar_eliminatoria_019(p_competencia_id bigint,p_propuesta jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare c jsonb; c2 jsonb; actual jsonb; gid bigint; first_id bigint; second_id bigint; total integer; confirmed integer;
begin
  if p_propuesta is null or p_propuesta->>'version_regla' is distinct from '19'
    or jsonb_typeof(p_propuesta->'clasificaciones') is distinct from 'array'
    or jsonb_array_length(p_propuesta->'clasificaciones') is distinct from 2
    or (p_propuesta->>'posiciones')::integer is distinct from 2
    or (p_propuesta->>'clasificados')::integer is distinct from 2
    or (p_propuesta->>'pases_automaticos')::integer is distinct from 0
  then raise exception 'Final de grupo único inválida' using errcode='22023'; end if;
  c:=p_propuesta->'clasificaciones'->0; c2:=p_propuesta->'clasificaciones'->1;
  if c->>'grupo_id' is null or c->>'jugador_id' is null or c2->>'jugador_id' is null or c->>'posicion' is distinct from '1' or c2->>'grupo_id' is distinct from c->>'grupo_id' or c2->>'posicion' is distinct from '2' or (c->>'jugador_id')::bigint=(c2->>'jugador_id')::bigint then raise exception 'Clasificación incompleta o jugadores repetidos' using errcode='22023'; end if;
  gid:=(c->>'grupo_id')::bigint;
  select count(*) into total from public.grupos_competencia where competencia_id=p_competencia_id;
  select count(*) into confirmed from public.grupos_competencia where competencia_id=p_competencia_id and estado='confirmado';
  if total<>1 or confirmed<>1 or not exists(select 1 from public.grupos_competencia where id=gid and competencia_id=p_competencia_id and estado='confirmado') then raise exception 'La final de grupo único requiere un solo grupo confirmado' using errcode='23514'; end if;
  select public.consultar_clasificacion_grupo(gid) into actual;
  if actual->>'aprobable' is distinct from 'true' or coalesce((actual->'aprobacion'->>'vigente')::boolean,false) is distinct from true or coalesce((actual->>'empate')::boolean,false) or coalesce((actual->>'pendientes')::integer,0)<>0 or coalesce((actual->>'confirmados')::integer,(actual->>'total')::integer)<>(actual->>'total')::integer then raise exception 'Clasificación no aprobada' using errcode='55000'; end if;
  if jsonb_array_length(actual->'filas')<2 then raise exception 'Faltan primero y segundo' using errcode='23514'; end if;
  first_id:=(actual->'filas'->0->>'jugador_id')::bigint; second_id:=(actual->'filas'->1->>'jugador_id')::bigint;
  if (c->>'jugador_id')::bigint is distinct from first_id or (c2->>'jugador_id')::bigint is distinct from second_id then raise exception 'Identidad de clasificación inválida' using errcode='23514'; end if;
  if c->'snapshot' is distinct from actual->'snapshot' or c2->'snapshot' is distinct from actual->'snapshot' then raise exception 'Snapshot desactualizado' using errcode='40001'; end if;
  if not exists(select 1 from public.grupo_participantes gp where gp.grupo_id=gid and gp.jugador_id=first_id) or not exists(select 1 from public.grupo_participantes gp where gp.grupo_id=gid and gp.jugador_id=second_id) then raise exception 'Participante ajeno' using errcode='23514'; end if;
end $$;

create function public.guardar_propuesta_eliminatoria_019(p_competencia_id bigint,p_propuesta jsonb,p_referencia text) returns bigint
language plpgsql security definer set search_path='' as $$
declare id_new bigint; old_id bigint; gid bigint; actual jsonb; first_id bigint; second_id bigint; canonica jsonb; rid bigint; eid bigint;
begin
  if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
  if nullif(btrim(p_referencia),'') is null then raise exception 'Referencia obligatoria' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(2026003,2);
  perform 1 from public.competencias where id=p_competencia_id for update;
  perform public.bloquear_fuente_eliminatoria_016(p_competencia_id);
  perform public.validar_eliminatoria_019(p_competencia_id,p_propuesta);
  gid:=(p_propuesta->'clasificaciones'->0->>'grupo_id')::bigint;
  actual:=public.consultar_clasificacion_grupo(gid); first_id:=(actual->'filas'->0->>'jugador_id')::bigint; second_id:=(actual->'filas'->1->>'jugador_id')::bigint;
  canonica:=jsonb_build_object('version_regla',19,'posiciones',2,'clasificados',2,'pases_automaticos',0,'metodo_distribucion','final_grupo_unico','clasificaciones',jsonb_build_array(jsonb_build_object('grupo_id',gid,'posicion',1,'jugador_id',first_id,'snapshot',actual->'snapshot'),jsonb_build_object('grupo_id',gid,'posicion',2,'jugador_id',second_id,'snapshot',actual->'snapshot')),'rondas',jsonb_build_array(jsonb_build_object('posiciones',2,'nombre','Final','enfrentamientos',jsonb_build_array(jsonb_build_object('numero',1,'tipo','encuentro','jugador_a_id',first_id,'jugador_b_id',second_id,'origen_a',jsonb_build_object('tipo','jugador','jugador_id',first_id),'origen_b',jsonb_build_object('tipo','jugador','jugador_id',second_id))))),'decisiones',jsonb_build_array('Final independiente: primero y segundo del único grupo; el partido de grupos no sustituye la final.'));
  for old_id in select id from public.eliminatorias_llaves where competencia_id=p_competencia_id and estado='borrador' for update loop update public.eliminatorias_llaves set estado='reemplazada' where id=old_id; insert into public.eliminatorias_historial(llave_id,competencia_id,evento,actor_id,referencia,metodo_distribucion,fuente,decisiones) select old_id,p_competencia_id,'borrador_reemplazado',auth.uid(),btrim(p_referencia),'determinista_por_grupo',clasificaciones_fuente,coalesce(propuesta->'decisiones','[]') from public.eliminatorias_llaves where id=old_id; end loop;
  insert into public.eliminatorias_llaves(competencia_id,posiciones,clasificados,pases_automaticos,metodo_distribucion,propuesta,clasificaciones_fuente,referencia_guardado,creado_por) values(p_competencia_id,2,2,0,'determinista_por_grupo',canonica,canonica->'clasificaciones',btrim(p_referencia),auth.uid()) returning id into id_new;
  insert into public.eliminatorias_rondas(llave_id,numero,posiciones,nombre) values(id_new,1,2,'Final') returning id into rid;
  insert into public.eliminatorias_enfrentamientos(llave_id,ronda_id,numero,jugador_a_id,jugador_b_id,origen_a,origen_b) values(id_new,rid,1,first_id,second_id,jsonb_build_object('tipo','jugador','jugador_id',first_id),jsonb_build_object('tipo','jugador','jugador_id',second_id)) returning id into eid;
  insert into public.eliminatorias_historial(llave_id,competencia_id,evento,actor_id,referencia,metodo_distribucion,fuente,decisiones) values(id_new,p_competencia_id,'borrador_guardado',auth.uid(),btrim(p_referencia),'determinista_por_grupo',canonica->'clasificaciones',canonica->'decisiones');
  return id_new;
end $$;

create function public.confirmar_llave_eliminatoria_019(p_llave_id bigint,p_referencia text,p_reglas_confirmadas boolean,p_datos_reales boolean,p_referencia_reglas text,p_referencia_pases_reencuentros text) returns bigint
language plpgsql security definer set search_path='' as $$
declare k public.eliminatorias_llaves;
begin
  if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
  if nullif(btrim(p_referencia),'') is null or p_reglas_confirmadas is distinct from true or p_datos_reales is distinct from true or nullif(btrim(p_referencia_reglas),'') is null or nullif(btrim(p_referencia_pases_reencuentros),'') is null then raise exception 'Faltan referencias' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(2026003,2); select * into k from public.eliminatorias_llaves where id=p_llave_id for update;
  if not found or k.estado<>'borrador' or k.propuesta->>'version_regla' is distinct from '19' then raise exception 'Propuesta no vigente' using errcode='55000'; end if;
  perform public.bloquear_fuente_eliminatoria_016(k.competencia_id); perform public.validar_eliminatoria_019(k.competencia_id,k.propuesta);
  insert into public.eliminatorias_respaldos(llave_id,referencia_distribucion,referencia_pases_reencuentros,registrado_por) values(p_llave_id,btrim(p_referencia_reglas),btrim(p_referencia_pases_reencuentros),auth.uid());
  update public.eliminatorias_llaves set estado='confirmada',reglas_confirmadas=true,datos_reales_confirmados=true,referencia_reglas=btrim(p_referencia_reglas),confirmado_por=auth.uid(),confirmado_en=clock_timestamp(),referencia_confirmacion=btrim(p_referencia) where id=p_llave_id;
  insert into public.eliminatorias_historial(llave_id,competencia_id,evento,referencia,actor_id,metodo_distribucion,fuente,decisiones) values(p_llave_id,k.competencia_id,'confirmada',btrim(p_referencia),auth.uid(),'determinista_por_grupo',k.clasificaciones_fuente,coalesce(k.propuesta->'decisiones','[]'));
  return p_llave_id;
end $$;

-- 018 ya sabe operar una final de una fila; esta versión solo admite además la llave 019.
create or replace function public.iniciar_eliminatoria_018(p_llave_id bigint,p_referencia text) returns bigint
language plpgsql security definer set search_path='' as $$
declare k public.eliminatorias_llaves; m record; fmt public.competencia_formatos_sets; sid bigint; src jsonb; side text;
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
   if not found or fmt.mejor_de not in (3,5) or nullif(btrim(fmt.referencia_resolucion),'') is null then raise exception 'Falta formato de sets respaldado para la ronda' using errcode='55000'; end if;
   insert into public.eliminatorias_partidos(id,llave_id,ronda_id,numero,ronda_numero,jugador_a_id,jugador_b_id,mejor_de,referencia_reglas) values(m.id,k.id,m.ronda_id,m.numero,m.rn,m.jugador_a_id,m.jugador_b_id,fmt.mejor_de,fmt.referencia_resolucion);
   foreach side in array array['a','b'] loop src:=case side when 'a' then m.origen_a else m.origen_b end; if src->>'tipo'='ganador' then select p.id into sid from public.eliminatorias_partidos p where p.llave_id=k.id and format('R%s-C%s',p.ronda_numero,p.numero)=src->>'cruce' and p.ronda_numero<m.rn; if sid is null then raise exception 'Origen ganador inválido' using errcode='23514'; end if; if side='a' then update public.eliminatorias_partidos set fuente_a_id=sid where id=m.id; else update public.eliminatorias_partidos set fuente_b_id=sid where id=m.id; end if; end if; end loop;
 end loop;
 insert into public.eliminatorias_eventos(llave_id,evento,actor_id,referencia) values(k.id,'iniciado',auth.uid(),p_referencia); return k.id;
end $$;

revoke all on function public.validar_eliminatoria_019(bigint,jsonb),public.guardar_propuesta_eliminatoria_019(bigint,jsonb,text),public.confirmar_llave_eliminatoria_019(bigint,text,boolean,boolean,text,text),public.iniciar_eliminatoria_018(bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.guardar_propuesta_eliminatoria_019(bigint,jsonb,text),public.confirmar_llave_eliminatoria_019(bigint,text,boolean,boolean,text,text),public.iniciar_eliminatoria_018(bigint,text) to authenticated;
commit;




