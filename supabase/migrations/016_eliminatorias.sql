-- Propuesta revisada en documentacion/ELIMINATORIAS.md.
-- Aplicacion manual pendiente. No modifica 001-015 ni crea resultados eliminatorios.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create table public.eliminatorias_llaves (
  id bigint generated always as identity primary key,
  competencia_id bigint not null references public.competencias(id) on delete restrict,
  estado text not null default 'borrador' check (estado in ('borrador','reemplazada','confirmada')),
  posiciones integer not null check (posiciones=1 or (posiciones>1 and posiciones & (posiciones-1)=0)),
  clasificados integer not null check (clasificados>0 and clasificados<=posiciones),
  pases_automaticos integer not null check (pases_automaticos=posiciones-clasificados),
  metodo_distribucion text not null check (metodo_distribucion='determinista_por_grupo'),
  propuesta jsonb not null check (jsonb_typeof(propuesta)='object'),
  clasificaciones_fuente jsonb not null check (jsonb_typeof(clasificaciones_fuente)='array'),
  referencia_guardado text not null check (char_length(btrim(referencia_guardado)) between 1 and 1000),
  reglas_confirmadas boolean not null default false,
  datos_reales_confirmados boolean not null default false,
  referencia_reglas text,
  creado_por uuid not null references public.perfiles(id) on delete restrict,
  creado_en timestamptz not null default clock_timestamp(),
  confirmado_por uuid references public.perfiles(id) on delete restrict,
  confirmado_en timestamptz,
  referencia_confirmacion text,
  unique(id,competencia_id),
  check ((estado in ('borrador','reemplazada') and confirmado_por is null and confirmado_en is null and referencia_confirmacion is null)
      or (estado='confirmada' and confirmado_por is not null and confirmado_en is not null and char_length(btrim(coalesce(referencia_confirmacion,''))) between 1 and 1000 and reglas_confirmadas and datos_reales_confirmados and char_length(btrim(coalesce(referencia_reglas,''))) between 1 and 1000))
);
create unique index eliminatorias_llaves_activas_016 on public.eliminatorias_llaves(competencia_id) where estado in ('borrador','confirmada');
create table public.eliminatorias_rondas (
 id bigint generated always as identity primary key,
 llave_id bigint not null references public.eliminatorias_llaves(id) on delete cascade,
 numero integer not null check(numero>0), posiciones integer not null check(posiciones>0), nombre text not null check(char_length(btrim(nombre)) between 1 and 200),
 unique(llave_id,numero), unique(id,llave_id)
);
create table public.eliminatorias_enfrentamientos (
 id bigint generated always as identity primary key,
 llave_id bigint not null references public.eliminatorias_llaves(id) on delete cascade,
 ronda_id bigint not null,
 numero integer not null check(numero>0),
 jugador_a_id bigint references public.jugadores(id) on delete restrict,
 jugador_b_id bigint references public.jugadores(id) on delete restrict,
 origen_a jsonb not null check(jsonb_typeof(origen_a)='object'), origen_b jsonb not null check(jsonb_typeof(origen_b)='object'),
 estado text not null default 'pendiente' check(estado='pendiente'),
 foreign key(ronda_id,llave_id) references public.eliminatorias_rondas(id,llave_id) on delete cascade,
 unique(llave_id,ronda_id,numero), check(jugador_a_id is null or jugador_b_id is null or jugador_a_id<>jugador_b_id)
);
create table public.eliminatorias_historial (
 id bigint generated always as identity primary key,
 llave_id bigint not null references public.eliminatorias_llaves(id) on delete restrict,
 competencia_id bigint not null references public.competencias(id) on delete restrict,
 evento text not null check(evento in ('borrador_guardado','borrador_reemplazado','confirmada')),
 actor_id uuid not null references public.perfiles(id) on delete restrict,
 ocurrido_en timestamptz not null default clock_timestamp(), referencia text not null check(char_length(btrim(referencia)) between 1 and 1000),
 metodo_distribucion text not null check(metodo_distribucion='determinista_por_grupo'), fuente jsonb not null check(jsonb_typeof(fuente)='array'), decisiones jsonb not null default '[]'::jsonb check(jsonb_typeof(decisiones)='array')
);
create index eliminatorias_llaves_competencia_016 on public.eliminatorias_llaves(competencia_id,estado);
create index eliminatorias_enfrentamientos_llave_016 on public.eliminatorias_enfrentamientos(llave_id,ronda_id);

alter table public.eliminatorias_llaves enable row level security;
alter table public.eliminatorias_rondas enable row level security;
alter table public.eliminatorias_enfrentamientos enable row level security;
alter table public.eliminatorias_historial enable row level security;
revoke all on public.eliminatorias_llaves,public.eliminatorias_rondas,public.eliminatorias_enfrentamientos,public.eliminatorias_historial from public,anon,authenticated,service_role;
grant select on public.eliminatorias_llaves,public.eliminatorias_rondas,public.eliminatorias_enfrentamientos,public.eliminatorias_historial to authenticated;
create policy eliminatorias_llaves_operadores_016 on public.eliminatorias_llaves for select to authenticated using((select public.es_juez_general()) or (select public.es_administrador()));
create policy eliminatorias_rondas_operadores_016 on public.eliminatorias_rondas for select to authenticated using((select public.es_juez_general()) or (select public.es_administrador()));
create policy eliminatorias_enfrentamientos_operadores_016 on public.eliminatorias_enfrentamientos for select to authenticated using((select public.es_juez_general()) or (select public.es_administrador()));
create policy eliminatorias_historial_operadores_016 on public.eliminatorias_historial for select to authenticated using((select public.es_juez_general()) or (select public.es_administrador()));

create function public.proteger_eliminatoria_confirmada_016() returns trigger language plpgsql security definer set search_path='' as $$ begin if tg_op in('UPDATE','DELETE') and old.estado='confirmada' then raise exception 'La llave confirmada es inmutable' using errcode='55000'; end if; if tg_op='DELETE' then return old; end if; return new; end $$;
create trigger proteger_llave_confirmada_016 before update or delete on public.eliminatorias_llaves for each row execute function public.proteger_eliminatoria_confirmada_016();
create function public.proteger_rondas_confirmadas_016() returns trigger language plpgsql security definer set search_path='' as $$ declare old_state text; new_state text; old_key bigint; new_key bigint; begin old_key:=case when tg_op='INSERT' then null else old.llave_id end; new_key:=case when tg_op='DELETE' then null else (to_jsonb(new)->>'llave_id')::bigint end; if old_key is not null then select estado into old_state from public.eliminatorias_llaves where id=old_key; end if; if new_key is not null then select estado into new_state from public.eliminatorias_llaves where id=new_key; end if; if old_key is distinct from new_key and (old_state='confirmada' or new_state='confirmada') then raise exception 'No se puede mover una estructura confirmada' using errcode='55000'; end if; if old_state='confirmada' or new_state='confirmada' then raise exception 'Las rondas confirmadas son inmutables' using errcode='55000'; end if; if tg_op='DELETE' then return old; end if; return new; end $$;
create trigger proteger_rondas_confirmadas_016 before insert or update or delete on public.eliminatorias_rondas for each row execute function public.proteger_rondas_confirmadas_016();
create trigger proteger_enfrentamientos_confirmados_016 before insert or update or delete on public.eliminatorias_enfrentamientos for each row execute function public.proteger_rondas_confirmadas_016();
create function public.proteger_historial_eliminatorias_016() returns trigger language plpgsql security definer set search_path='' as $$ begin raise exception 'El historial es inmutable' using errcode='55000'; end $$;
create trigger proteger_historial_eliminatorias_016 before update or delete on public.eliminatorias_historial for each row execute function public.proteger_historial_eliminatorias_016();
create trigger proteger_historial_eliminatorias_truncate_016 before truncate on public.eliminatorias_historial for each statement execute function public.proteger_historial_eliminatorias_016();

create function public.normalizar_origen_eliminatoria_016(o jsonb) returns jsonb language plpgsql immutable set search_path='' as $$ declare i text; begin if jsonb_typeof(o)<>'object' then raise exception 'Origen invalido' using errcode='22023'; end if; if o->>'tipo'='jugador' then i:=coalesce(o->>'jugador_id',o->'jugador'->>'id'); if i is null or not i~'^[0-9]+$' then raise exception 'Jugador invalido' using errcode='22023'; end if; return jsonb_build_object('tipo','jugador','jugador_id',i::bigint); end if; if o->>'tipo'='ganador' and o->>'cruce'~'^R[0-9]+-C[0-9]+$' then return jsonb_build_object('tipo','ganador','cruce',o->>'cruce'); end if; raise exception 'Origen no autorizado' using errcode='22023'; end $$;
create function public.normalizar_rondas_eliminatoria_016(rs jsonb) returns jsonb language plpgsql immutable set search_path='' as $$ declare r jsonb; m jsonb; a jsonb; b jsonb; outj jsonb:='[]'; ms jsonb; begin if jsonb_typeof(rs)<>'array' then raise exception 'Faltan rondas' using errcode='22023'; end if; for r in select value from jsonb_array_elements(rs) loop if jsonb_typeof(r->'enfrentamientos')<>'array' or r->>'posiciones' is null or not(r->>'posiciones')~'^[0-9]+$' then raise exception 'Ronda invalida' using errcode='22023'; end if; ms:='[]'; for m in select value from jsonb_array_elements(r->'enfrentamientos') loop if m->>'tipo'<>'encuentro' then raise exception 'Los pases automaticos no son partidos' using errcode='23514'; end if; if m->>'numero' is null or not(m->>'numero')~'^[0-9]+$' then raise exception 'Numero invalido' using errcode='22023'; end if; a:=public.normalizar_origen_eliminatoria_016(m->'origen_a'); b:=public.normalizar_origen_eliminatoria_016(m->'origen_b'); if m->>'jugador_a_id' is not null and not(m->>'jugador_a_id')~'^[0-9]+$' then raise exception 'Jugador invalido' using errcode='22023'; end if; if m->>'jugador_b_id' is not null and not(m->>'jugador_b_id')~'^[0-9]+$' then raise exception 'Jugador invalido' using errcode='22023'; end if; ms:=ms||jsonb_build_array(jsonb_build_object('numero',(m->>'numero')::integer,'tipo','encuentro','jugador_a_id',nullif(m->>'jugador_a_id','')::bigint,'jugador_b_id',nullif(m->>'jugador_b_id','')::bigint,'origen_a',a,'origen_b',b)); end loop; outj:=outj||jsonb_build_array(jsonb_build_object('posiciones',(r->>'posiciones')::integer,'enfrentamientos',ms)); end loop; return outj; end $$;
create function public.generar_rondas_eliminatoria_016(cid bigint,src jsonb,slots_n integer) returns jsonb language plpgsql security definer set search_path='' as $$ declare ps bigint[]; s jsonb[]; n jsonb[]; c jsonb[]; outj jsonb:='[]'; ms jsonb; a jsonb; b jsonb; w jsonb; i integer; rn integer:=1; bits integer; rev integer; tmp integer; bit integer; cnt integer; begin select array_agg((e->>'jugador_id')::bigint order by g.numero,g.id) into ps from jsonb_array_elements(src)e join public.grupos_competencia g on g.id=(e->>'grupo_id')::bigint where g.competencia_id=cid; cnt:=coalesce(array_length(ps,1),0); bits:=floor(log(2,slots_n))::integer; s:=array_fill(null::jsonb,array[slots_n]); for i in 0..cnt-1 loop rev:=0; tmp:=i; for bit in 0..bits-1 loop rev:=(rev<<1)|(tmp&1); tmp:=tmp>>1; end loop; s[rev+1]:=jsonb_build_object('tipo','jugador','jugador_id',ps[i+1]); end loop; c:=s; while array_length(c,1)>1 loop ms:='[]'; n:=array_fill(null::jsonb,array[array_length(c,1)/2]); for i in 1..array_length(c,1) by 2 loop a:=c[i]; b:=c[i+1]; if a is not null and b is not null then w:=jsonb_build_object('tipo','ganador','cruce',format('R%s-C%s',rn,(i+1)/2)); ms:=ms||jsonb_build_array(jsonb_build_object('numero',(i+1)/2,'tipo','encuentro','jugador_a_id',case when a->>'tipo'='jugador' then(a->>'jugador_id')::bigint end,'jugador_b_id',case when b->>'tipo'='jugador' then(b->>'jugador_id')::bigint end,'origen_a',a,'origen_b',b)); n[(i+1)/2]:=w; else n[(i+1)/2]:=coalesce(a,b); end if; end loop; outj:=outj||jsonb_build_array(jsonb_build_object('posiciones',array_length(c,1),'enfrentamientos',ms)); c:=n; rn:=rn+1; end loop; return outj; end $$;

create function public.validar_eliminatoria_016(p_competencia_id bigint,p_propuesta jsonb) returns void language plpgsql security definer set search_path='' as $$ declare g jsonb; actual jsonb; seen bigint[]:=array[]::bigint[]; groups bigint[]:=array[]::bigint[]; player bigint; cnt integer; total integer; slots_n integer:=1; expected jsonb; begin if p_propuesta is null or jsonb_typeof(p_propuesta)<>'object' then raise exception 'Propuesta invalida' using errcode='22023'; end if; if p_propuesta->>'metodo_distribucion'<>'determinista_por_grupo' then raise exception 'Metodo no autorizado' using errcode='22023'; end if; if jsonb_typeof(p_propuesta->'clasificaciones')<>'array' then raise exception 'Faltan clasificaciones' using errcode='22023'; end if; select count(*) into total from public.grupos_competencia where competencia_id=p_competencia_id; select count(*) into cnt from public.grupos_competencia where competencia_id=p_competencia_id and estado='confirmado'; if total=0 or total<>cnt or cnt<>jsonb_array_length(p_propuesta->'clasificaciones') then raise exception 'Hay grupos pendientes o fuente incompleta' using errcode='23514'; end if; for g in select value from jsonb_array_elements(p_propuesta->'clasificaciones') loop if g->>'grupo_id' is null or not(g->>'grupo_id')~'^[0-9]+$' or g->>'jugador_id' is null or not(g->>'jugador_id')~'^[0-9]+$' then raise exception 'Fuente incompleta' using errcode='22023'; end if; groups:=array_append(groups,(g->>'grupo_id')::bigint); player:=(g->>'jugador_id')::bigint; if player=any(seen) then raise exception 'Jugador duplicado' using errcode='23514'; end if; seen:=array_append(seen,player); select public.consultar_clasificacion_grupo((g->>'grupo_id')::bigint) into actual; if actual->>'grupo_id' is null or(actual->>'aprobable')::boolean is distinct from true or coalesce((actual->'aprobacion'->>'vigente')::boolean,false) is distinct from true then raise exception 'Clasificacion no aprobada' using errcode='55000'; end if; if actual->'filas'->0->>'jugador_id'<>g->>'jugador_id' then raise exception 'Primer lugar desactualizado' using errcode='40001'; end if; if g->'snapshot' is distinct from actual->'snapshot' then raise exception 'Snapshot desactualizado' using errcode='40001'; end if; if not exists(select 1 from public.grupo_participantes gp join public.grupos_competencia gc on gc.id=gp.grupo_id where gc.competencia_id=p_competencia_id and gp.grupo_id=(g->>'grupo_id')::bigint and gp.jugador_id=player) then raise exception 'Jugador ajeno' using errcode='23514'; end if; end loop; if(select count(*) from public.grupos_competencia where competencia_id=p_competencia_id and estado='confirmado' and id=any(groups))<>cnt then raise exception 'Grupos ajenos o repetidos' using errcode='23514'; end if; while slots_n<cnt loop slots_n:=slots_n*2; end loop; if p_propuesta->>'posiciones' is null or not(p_propuesta->>'posiciones')~'^[0-9]+$' or(p_propuesta->>'posiciones')::integer is distinct from slots_n or(p_propuesta->>'clasificados')::integer is distinct from cnt or(p_propuesta->>'pases_automaticos')::integer is distinct from slots_n-cnt then raise exception 'Tamano o pases invalidos' using errcode='23514'; end if; expected:=public.generar_rondas_eliminatoria_016(p_competencia_id,p_propuesta->'clasificaciones',slots_n); if public.normalizar_rondas_eliminatoria_016(p_propuesta->'rondas') is distinct from expected then raise exception 'Estructura no autorizada' using errcode='23514'; end if; end $$;

create function public.construir_propuesta_eliminatoria_016(p_competencia_id bigint,p_propuesta jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare fuente jsonb; rondas jsonb; decisiones jsonb; cnt integer; slots_n integer:=1; begin
  select jsonb_agg(jsonb_build_object('grupo_id',(e->>'grupo_id')::bigint,'jugador_id',(e->>'jugador_id')::bigint,'snapshot',e->'snapshot') order by gc.numero,gc.id)
    into fuente
    from jsonb_array_elements(p_propuesta->'clasificaciones') e
    join public.grupos_competencia gc on gc.id=(e->>'grupo_id')::bigint
   where gc.competencia_id=p_competencia_id and gc.estado='confirmado';
  cnt:=jsonb_array_length(fuente);
  while slots_n<cnt loop slots_n:=slots_n*2; end loop;
  rondas:=public.generar_rondas_eliminatoria_016(p_competencia_id,fuente,slots_n);
  decisiones:=case when jsonb_typeof(p_propuesta->'decisiones')='array' then p_propuesta->'decisiones' else '[]'::jsonb end;
  return jsonb_build_object('posiciones',slots_n,'clasificados',cnt,'pases_automaticos',slots_n-cnt,'metodo_distribucion','determinista_por_grupo','clasificaciones',fuente,'rondas',rondas,'decisiones',decisiones);
end $$;

create function public.bloquear_fuente_eliminatoria_016(p_competencia_id bigint) returns void language plpgsql security definer set search_path='' as $$ begin
  perform 1 from public.grupos_competencia where competencia_id=p_competencia_id order by id for update;
  perform 1 from public.partidos p join public.grupos_competencia g on g.id=p.grupo_id where g.competencia_id=p_competencia_id order by p.id for update;
end $$;

create function public.bloquear_correccion_grupos_016() returns trigger language plpgsql security definer set search_path='' as $$ declare competencia bigint; begin
  select g.competencia_id into competencia from public.partidos p join public.grupos_competencia g on g.id=p.grupo_id where p.id=new.partido_id;
  if competencia is not null and exists(select 1 from public.eliminatorias_llaves where competencia_id=competencia and estado='confirmada') then
    raise exception 'La clasificación está cerrada por una llave confirmada' using errcode='55000';
  end if;
  return new;
end $$;
create trigger bloquear_correcciones_con_llave_016 before insert or update on public.resultados_partidos for each row execute function public.bloquear_correccion_grupos_016();

create function public.guardar_propuesta_eliminatoria_016(p_competencia_id bigint,p_propuesta jsonb,p_referencia text) returns bigint language plpgsql security definer set search_path='' as $$ declare id_new bigint; old_id bigint; r jsonb; m jsonb; rid bigint; rn integer; canonica jsonb; begin if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if; if nullif(btrim(p_referencia),'') is null then raise exception 'Referencia obligatoria' using errcode='22023'; end if; perform pg_catalog.pg_advisory_xact_lock(2026003,2); perform 1 from public.competencias where id=p_competencia_id for update; perform public.bloquear_fuente_eliminatoria_016(p_competencia_id); perform public.validar_eliminatoria_016(p_competencia_id,p_propuesta); canonica:=public.construir_propuesta_eliminatoria_016(p_competencia_id,p_propuesta); if exists(select 1 from public.eliminatorias_llaves where competencia_id=p_competencia_id and estado='confirmada') then raise exception 'Llave confirmada' using errcode='55000'; end if; for old_id in select id from public.eliminatorias_llaves where competencia_id=p_competencia_id and estado='borrador' for update loop update public.eliminatorias_llaves set estado='reemplazada' where id=old_id; insert into public.eliminatorias_historial(llave_id,competencia_id,evento,actor_id,referencia,metodo_distribucion,fuente,decisiones) select old_id,p_competencia_id,'borrador_reemplazado',auth.uid(),btrim(p_referencia),'determinista_por_grupo',clasificaciones_fuente,coalesce(propuesta->'decisiones','[]') from public.eliminatorias_llaves where id=old_id; end loop; insert into public.eliminatorias_llaves(competencia_id,posiciones,clasificados,pases_automaticos,metodo_distribucion,propuesta,clasificaciones_fuente,referencia_guardado,creado_por) values(p_competencia_id,(canonica->>'posiciones')::integer,(canonica->>'clasificados')::integer,(canonica->>'pases_automaticos')::integer,'determinista_por_grupo',canonica,canonica->'clasificaciones',btrim(p_referencia),auth.uid()) returning id into id_new; for r,rn in select value,ordinality::integer from jsonb_array_elements(canonica->'rondas') with ordinality loop insert into public.eliminatorias_rondas(llave_id,numero,posiciones,nombre) values(id_new,rn,(r->>'posiciones')::integer,coalesce(r->>'nombre','Ronda '||rn)) returning id into rid; for m in select value from jsonb_array_elements(r->'enfrentamientos') loop insert into public.eliminatorias_enfrentamientos(llave_id,ronda_id,numero,jugador_a_id,jugador_b_id,origen_a,origen_b) values(id_new,rid,(m->>'numero')::integer,nullif(m->>'jugador_a_id','')::bigint,nullif(m->>'jugador_b_id','')::bigint,m->'origen_a',m->'origen_b'); end loop; end loop; insert into public.eliminatorias_historial(llave_id,competencia_id,evento,actor_id,referencia,metodo_distribucion,fuente,decisiones) values(id_new,p_competencia_id,'borrador_guardado',auth.uid(),btrim(p_referencia),'determinista_por_grupo',canonica->'clasificaciones',canonica->'decisiones'); return id_new; end $$;

create function public.confirmar_llave_eliminatoria_016(p_llave_id bigint,p_referencia text,p_reglas_confirmadas boolean,p_datos_reales boolean,p_referencia_reglas text) returns bigint language plpgsql security definer set search_path='' as $$ declare k public.eliminatorias_llaves; begin if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if; if nullif(btrim(p_referencia),'') is null or p_reglas_confirmadas is distinct from true or p_datos_reales is distinct from true or nullif(btrim(p_referencia_reglas),'') is null then raise exception 'Faltan referencias' using errcode='22023'; end if; perform pg_catalog.pg_advisory_xact_lock(2026003,2); select * into k from public.eliminatorias_llaves where id=p_llave_id for update; if not found or k.estado<>'borrador' then raise exception 'Propuesta no vigente' using errcode='55000'; end if; perform public.bloquear_fuente_eliminatoria_016(k.competencia_id); perform public.validar_eliminatoria_016(k.competencia_id,k.propuesta); update public.eliminatorias_llaves set estado='confirmada',reglas_confirmadas=true,datos_reales_confirmados=true,referencia_reglas=btrim(p_referencia_reglas),confirmado_por=auth.uid(),confirmado_en=clock_timestamp(),referencia_confirmacion=btrim(p_referencia) where id=p_llave_id; insert into public.eliminatorias_historial(llave_id,competencia_id,evento,referencia,actor_id,metodo_distribucion,fuente,decisiones) values(p_llave_id,k.competencia_id,'confirmada',btrim(p_referencia),auth.uid(),'determinista_por_grupo',k.clasificaciones_fuente,coalesce(k.propuesta->'decisiones','[]')); return p_llave_id; end $$;

revoke all on function public.normalizar_origen_eliminatoria_016(jsonb),public.normalizar_rondas_eliminatoria_016(jsonb),public.generar_rondas_eliminatoria_016(bigint,jsonb,integer),public.validar_eliminatoria_016(bigint,jsonb),public.construir_propuesta_eliminatoria_016(bigint,jsonb),public.bloquear_fuente_eliminatoria_016(bigint),public.bloquear_correccion_grupos_016(),public.guardar_propuesta_eliminatoria_016(bigint,jsonb,text),public.confirmar_llave_eliminatoria_016(bigint,text,boolean,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.guardar_propuesta_eliminatoria_016(bigint,jsonb,text),public.confirmar_llave_eliminatoria_016(bigint,text,boolean,boolean,text) to authenticated;
revoke all on sequence public.eliminatorias_llaves_id_seq,public.eliminatorias_rondas_id_seq,public.eliminatorias_enfrentamientos_id_seq,public.eliminatorias_historial_id_seq from public,anon,authenticated,service_role;
commit;
