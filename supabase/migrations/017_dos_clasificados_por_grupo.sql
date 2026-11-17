-- Incremental sobre 016 YA aplicada. Revisión y aplicación exclusivamente manual.
-- No modifica llaves existentes: los borradores antiguos deben regenerarse explícitamente.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $$ begin
  if to_regprocedure('public.guardar_propuesta_eliminatoria_016(bigint,jsonb,text)') is null
    or to_regprocedure('public.confirmar_llave_eliminatoria_016(bigint,text,boolean,boolean,text)') is null
    or to_regclass('public.eliminatorias_historial') is null then
    raise exception '017 requiere la migración 016 aplicada; detener y revisar el esquema';
  end if;
end $$;

create or replace function public.generar_rondas_eliminatoria_016(cid bigint,src jsonb,slots_n integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  firsts bigint[]; seconds bigint[]; c jsonb[]; n jsonb[];
  outj jsonb:='[]'; ms jsonb; a jsonb; b jsonb; w jsonb;
  i integer; h integer; j integer; k integer; idx integer; rn integer:=1; cnt integer;
begin
  select array_agg((e->>'jugador_id')::bigint order by g.numero,g.id) filter(where e->>'posicion'='1'),
         array_agg((e->>'jugador_id')::bigint order by g.numero,g.id) filter(where e->>'posicion'='2')
    into firsts,seconds from jsonb_array_elements(src)e
    join public.grupos_competencia g on g.id=(e->>'grupo_id')::bigint where g.competencia_id=cid;
  cnt:=coalesce(array_length(firsts,1),0);
  if cnt<2 then raise exception 'Un solo grupo: reencuentro pendiente de regla deportiva validada' using errcode='55000'; end if;
  c:=array_fill(null::jsonb,array[slots_n]); k:=slots_n/4;
  for h in 0..1 loop
    j:=0;
    for i in 1..cnt loop
      if (i-1)%2=h then
        c[h*slots_n/2+2*j+1]:=jsonb_build_object('tipo','jugador','jugador_id',firsts[i]); j:=j+1;
      end if;
    end loop;
    j:=0;
    for i in 1..cnt loop
      if (i-1)%2<>h then
        idx:=h*slots_n/2+2*(k-case when h=0 then cnt/2 else (cnt+1)/2 end+j)+2;
        c[idx]:=jsonb_build_object('tipo','jugador','jugador_id',seconds[i]); j:=j+1;
      end if;
    end loop;
  end loop;
  while array_length(c,1)>1 loop
    ms:='[]'; n:=array_fill(null::jsonb,array[array_length(c,1)/2]);
    for i in 1..array_length(c,1) by 2 loop
      a:=c[i]; b:=c[i+1];
      if a is null and b is null then raise exception 'Rama vacía inválida' using errcode='23514'; end if;
      if a is not null and b is not null then
        w:=jsonb_build_object('tipo','ganador','cruce',format('R%s-C%s',rn,(i+1)/2));
        ms:=ms||jsonb_build_array(jsonb_build_object('numero',(i+1)/2,'tipo','encuentro',
          'jugador_a_id',case when a->>'tipo'='jugador' then(a->>'jugador_id')::bigint end,
          'jugador_b_id',case when b->>'tipo'='jugador' then(b->>'jugador_id')::bigint end,'origen_a',a,'origen_b',b));
        n[(i+1)/2]:=w;
      else n[(i+1)/2]:=coalesce(a,b); end if;
    end loop;
    outj:=outj||jsonb_build_array(jsonb_build_object('posiciones',array_length(c,1),'enfrentamientos',ms));
    c:=n; rn:=rn+1;
  end loop;
  return outj;
end $$;

create or replace function public.validar_eliminatoria_016(p_competencia_id bigint,p_propuesta jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare g record; e jsonb; actual jsonb; src jsonb; cnt bigint; total bigint; slots_n bigint:=1; expected jsonb;
begin
  if p_propuesta is null or jsonb_typeof(p_propuesta) is distinct from 'object'
    or p_propuesta->>'metodo_distribucion' is distinct from 'determinista_por_grupo'
    or jsonb_typeof(p_propuesta->'clasificaciones') is distinct from 'array' then
    raise exception 'Propuesta inválida' using errcode='22023';
  end if;
  src:=p_propuesta->'clasificaciones';
  select count(*),count(*) filter(where estado='confirmado') into total,cnt
    from public.grupos_competencia where competencia_id=p_competencia_id;
  if total<2 then raise exception 'Un solo grupo: distribución bloqueada hasta validar reencuentro' using errcode='55000'; end if;
  if total<>cnt or jsonb_array_length(src)<>total*2 then
    raise exception 'Se requieren primero y segundo de todos los grupos confirmados; regenerar borradores de 016' using errcode='23514';
  end if;
  if exists(select 1 from jsonb_array_elements(src)x where
    coalesce(x->>'grupo_id','')!~'^[0-9]+$' or coalesce(x->>'jugador_id','')!~'^[0-9]+$'
    or coalesce(x->>'posicion','') not in('1','2')) then
    raise exception 'Fuente incompleta: posición 1 o 2 obligatoria' using errcode='22023';
  end if;
  if (select count(distinct (x->>'jugador_id')::bigint) from jsonb_array_elements(src)x)<>total*2
    or (select count(distinct ((x->>'grupo_id')::bigint,(x->>'posicion')::integer)) from jsonb_array_elements(src)x)<>total*2
    or exists(select 1 from jsonb_array_elements(src)x where not exists(
      select 1 from public.grupos_competencia gc where gc.id=(x->>'grupo_id')::bigint and gc.competencia_id=p_competencia_id)) then
    raise exception 'Jugadores duplicados, grupos ajenos o plazas repetidas' using errcode='23514';
  end if;
  -- Una consulta de clasificación por grupo, no una por plaza.
  for g in select gc.id,gc.numero,s.entries from public.grupos_competencia gc
    join (select (value->>'grupo_id')::bigint id,jsonb_agg(value) entries
      from jsonb_array_elements(src) group by (value->>'grupo_id')::bigint) s on s.id=gc.id
    where gc.competencia_id=p_competencia_id order by gc.numero,gc.id loop
    actual:=public.consultar_clasificacion_grupo(g.id);
    if (actual->>'aprobable')::boolean is distinct from true
      or (actual->'aprobacion'->>'vigente')::boolean is distinct from true
      or (actual->>'grupo_id')::bigint is distinct from g.id
      or (actual->>'pendientes')::integer is distinct from 0
      or (actual->>'confirmados')::integer is distinct from (actual->>'total')::integer
      or (actual->'filas'->0->>'empate')::boolean is distinct from false
      or (actual->'filas'->1->>'empate')::boolean is distinct from false
      or jsonb_array_length(actual->'filas')<2 then
      raise exception 'Clasificación incompleta, empate pendiente o aprobación desactualizada' using errcode='55000';
    end if;
    for e in select value from jsonb_array_elements(g.entries) loop
      if (actual->'filas'->((e->>'posicion')::integer-1)->>'jugador_id')::bigint is distinct from (e->>'jugador_id')::bigint
        or e->'snapshot' is distinct from actual->'snapshot' then
        raise exception 'Posición o snapshot desactualizado' using errcode='40001';
      end if;
      if not exists(select 1 from public.grupo_participantes gp where gp.grupo_id=g.id and gp.jugador_id=(e->>'jugador_id')::bigint) then
        raise exception 'Jugador ajeno al grupo' using errcode='23514';
      end if;
    end loop;
  end loop;
  cnt:=total*2;
  while slots_n<cnt loop slots_n:=slots_n*2; end loop;
  -- Límite de representación de INTEGER de 016, nunca límite deportivo.
  if slots_n>2147483647 then raise exception 'El cuadro excede la representación INTEGER de la infraestructura; requiere ampliar el almacenamiento' using errcode='54000'; end if;
  if (p_propuesta->>'posiciones')::bigint is distinct from slots_n
    or (p_propuesta->>'clasificados')::bigint is distinct from cnt
    or (p_propuesta->>'pases_automaticos')::bigint is distinct from slots_n-cnt then
    raise exception 'Tamaño o pases inválidos' using errcode='23514';
  end if;
  expected:=public.generar_rondas_eliminatoria_016(p_competencia_id,src,slots_n::integer);
  if public.normalizar_rondas_eliminatoria_016(p_propuesta->'rondas') is distinct from expected then
    raise exception 'Estructura no autorizada' using errcode='23514';
  end if;
end $$;

create or replace function public.construir_propuesta_eliminatoria_016(p_competencia_id bigint,p_propuesta jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare fuente jsonb; cnt integer; slots_n integer; rondas jsonb;
begin
  select jsonb_agg(jsonb_build_object('grupo_id',gc.id,'posicion',(e->>'posicion')::integer,
    'jugador_id',(e->>'jugador_id')::bigint,'snapshot',e->'snapshot') order by gc.numero,gc.id,(e->>'posicion')::integer)
    into fuente from jsonb_array_elements(p_propuesta->'clasificaciones')e
    join public.grupos_competencia gc on gc.id=(e->>'grupo_id')::bigint where gc.competencia_id=p_competencia_id;
  cnt:=jsonb_array_length(fuente); slots_n:=(p_propuesta->>'posiciones')::integer;
  rondas:=public.generar_rondas_eliminatoria_016(p_competencia_id,fuente,slots_n);
  select jsonb_agg(r||jsonb_build_object('nombre',case (r->>'posiciones')::integer
    when 2 then 'Final' when 4 then 'Semifinales' when 8 then 'Cuartos de final'
    when 16 then 'Octavos de final' else format('Ronda de %s · %s encuentros',r->>'posiciones',(r->>'posiciones')::integer/2) end) order by ord)
    into rondas from jsonb_array_elements(rondas) with ordinality as items(r,ord);
  return jsonb_build_object('version_regla',17,'posiciones',slots_n,'clasificados',cnt,
    'pases_automaticos',slots_n-cnt,'metodo_distribucion','determinista_por_grupo',
    'clasificaciones',fuente,'rondas',rondas,'decisiones',jsonb_build_array(
      'Primero y segundo por grupo. Distribución técnica pendiente de validación; no es sorteo oficial.',
      'Compañeros en mitades opuestas. Pases sin partidos ficticios.'));
end $$;

-- Las RPC 016 conservan autorización, bloqueos de fuente, RLS, auditoría,
-- reemplazo explícito e inmutabilidad. Sus llamadas internas usan la regla nueva.
create function public.guardar_propuesta_eliminatoria_017(p_competencia_id bigint,p_propuesta jsonb,p_referencia text)
returns bigint language sql security invoker set search_path='' as $$
  select public.guardar_propuesta_eliminatoria_016(p_competencia_id,p_propuesta,p_referencia)
$$;
revoke all on function public.guardar_propuesta_eliminatoria_017(bigint,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.guardar_propuesta_eliminatoria_017(bigint,jsonb,text) to authenticated;
-- CREATE OR REPLACE preserva las ACL privadas de los auxiliares de 016.
commit;
