-- Preparación LOCAL sobre 017. Aplicación manual, sin activar competencias.
-- La autorización documental se carga manualmente después de validar la distribución.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
 if to_regprocedure('public.guardar_propuesta_eliminatoria_017(bigint,jsonb,text)') is null
 or to_regprocedure('public.bloquear_fuente_eliminatoria_016(bigint)') is null
 or to_regprocedure('public.calcular_resultado_sets_012(jsonb,integer)') is null
 then raise exception '018 requiere 012-017; detener y revisar'; end if;
end $$;

create table public.eliminatorias_respaldos (
 llave_id bigint primary key references public.eliminatorias_llaves(id) on delete restrict,
 referencia_distribucion text not null check(length(btrim(referencia_distribucion)) between 1 and 1000),
 referencia_pases_reencuentros text not null check(length(btrim(referencia_pases_reencuentros)) between 1 and 1000),
 registrado_por uuid not null references public.perfiles(id),
 registrado_en timestamptz not null default clock_timestamp()
);
-- Sin RPC de alta ni permisos de escritura: requiere revisión y carga manual explícita.
create table public.eliminatorias_cuadros (
 llave_id bigint primary key references public.eliminatorias_respaldos(llave_id),
 competencia_id bigint not null references public.competencias(id),
 estado text not null default 'en_curso' check(estado in ('en_curso','finalizado')),
 campeon_id bigint references public.jugadores(id), finalista_id bigint references public.jugadores(id),
 iniciado_por uuid not null references public.perfiles(id), iniciado_en timestamptz not null default clock_timestamp(),
 finalizado_en timestamptz,
 check((estado='en_curso' and campeon_id is null and finalista_id is null and finalizado_en is null)
 or (estado='finalizado' and campeon_id is not null and finalista_id is not null and campeon_id<>finalista_id and finalizado_en is not null))
);
create table public.eliminatorias_partidos (
 id bigint primary key references public.eliminatorias_enfrentamientos(id),
 llave_id bigint not null references public.eliminatorias_cuadros(llave_id),
 ronda_id bigint not null references public.eliminatorias_rondas(id),
 numero integer not null, ronda_numero integer not null,
 jugador_a_id bigint references public.jugadores(id), jugador_b_id bigint references public.jugadores(id),
 fuente_a_id bigint references public.eliminatorias_partidos(id), fuente_b_id bigint references public.eliminatorias_partidos(id),
 mejor_de integer not null check(mejor_de in (3,5)), referencia_reglas text not null check(length(btrim(referencia_reglas)) between 1 and 1000),
 arbitro_id uuid references public.perfiles(id),
 estado text not null default 'pendiente' check(estado in ('pendiente','en_desarrollo','revision','observado','confirmado')),
 revision integer not null default 0 check(revision>=0),
 ganador_id bigint references public.jugadores(id), perdedor_id bigint references public.jugadores(id),
 unique(llave_id,ronda_numero,numero),
 check(jugador_a_id is null or jugador_b_id is null or jugador_a_id<>jugador_b_id),
 check((estado='confirmado' and ganador_id is not null and perdedor_id is not null and ganador_id<>perdedor_id
 and ganador_id in (jugador_a_id,jugador_b_id) and perdedor_id in (jugador_a_id,jugador_b_id))
 or (estado<>'confirmado' and ganador_id is null and perdedor_id is null))
);
create unique index eliminatorias_eliminado_018 on public.eliminatorias_partidos(llave_id,perdedor_id) where perdedor_id is not null;
create index eliminatorias_pagina_018 on public.eliminatorias_partidos(llave_id,ronda_numero,id);
create index eliminatorias_asignados_018 on public.eliminatorias_partidos(arbitro_id,id);
create table public.eliminatorias_actas (
 id bigint generated always as identity primary key,
 partido_id bigint not null references public.eliminatorias_partidos(id),
 revision integer not null check(revision>0),
 sets jsonb not null check(jsonb_typeof(sets)='array'),
 sets_a integer not null, sets_b integer not null, ganador_id bigint not null references public.jugadores(id),
 autor_id uuid not null references public.perfiles(id), creado_en timestamptz not null default clock_timestamp(),
 referencia text not null check(length(btrim(referencia)) between 1 and 1000),
 unique(partido_id,revision), unique(id,partido_id)
);
create table public.eliminatorias_eventos (
 id bigint generated always as identity primary key,
 llave_id bigint not null references public.eliminatorias_cuadros(llave_id),
 partido_id bigint references public.eliminatorias_partidos(id),
 acta_id bigint,
 evento text not null check(evento in ('iniciado','asignado','en_desarrollo','enviado','observado','confirmado','campeon')),
 actor_id uuid not null references public.perfiles(id), ocurrido_en timestamptz not null default clock_timestamp(),
 instantanea jsonb not null default '{}'::jsonb,
 referencia text not null check(length(btrim(referencia)) between 1 and 2000),
 foreign key(acta_id,partido_id) references public.eliminatorias_actas(id,partido_id)
);
create unique index eliminatorias_confirmacion_018 on public.eliminatorias_eventos(partido_id) where evento='confirmado';
create index eliminatorias_historial_018 on public.eliminatorias_eventos(partido_id,id);

create function public.proteger_operacion_eliminatoria_018() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='TRUNCATE' or tg_op='DELETE' then raise exception 'Historial operativo protegido' using errcode='55000'; end if;
 if tg_table_name in ('eliminatorias_actas','eliminatorias_eventos','eliminatorias_respaldos')
 or (tg_table_name='eliminatorias_partidos' and to_jsonb(old)->>'estado'='confirmado')
 or (tg_table_name='eliminatorias_cuadros' and to_jsonb(old)->>'estado'='finalizado') then
 raise exception 'Resultado, respaldo e historial inmutables' using errcode='55000'; end if;
 return new;
end $$;

create function public.auditar_eliminatoria_018() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.eliminatorias_partidos; summary jsonb;
begin
 select * into p from public.eliminatorias_partidos where id=new.partido_id;
 if tg_table_name='eliminatorias_actas' then
   if auth.uid() is null or public.es_arbitro_013() is distinct from true or p.arbitro_id is distinct from auth.uid()
   or new.autor_id is distinct from auth.uid() then raise exception 'Acta sin asignación' using errcode='42501'; end if;
   if p.estado not in ('pendiente','en_desarrollo','observado') or p.jugador_a_id is null or p.jugador_b_id is null
   or new.revision<>p.revision+1 then raise exception 'Partido o revisión no habilitados' using errcode='55000'; end if;
   summary:=public.calcular_resultado_sets_012(new.sets,p.mejor_de);
   if new.sets_a is distinct from (summary->>'sets_a')::integer or new.sets_b is distinct from (summary->>'sets_b')::integer
   or new.ganador_id is distinct from (case summary->>'ganador' when 'a' then p.jugador_a_id else p.jugador_b_id end) then
     raise exception 'Resumen falsificado' using errcode='23514'; end if;
   new.creado_en:=clock_timestamp();
 else
   if new.actor_id is distinct from auth.uid() or (new.partido_id is not null and new.llave_id is distinct from p.llave_id) then raise exception 'Evento ajeno' using errcode='42501'; end if;
   new.instantanea:=case when new.partido_id is null then (select to_jsonb(c) from public.eliminatorias_cuadros c where llave_id=new.llave_id) else to_jsonb(p) end;
   new.ocurrido_en:=clock_timestamp();
 end if;
 return new;
end $$;
create trigger validar_acta_018 before insert on public.eliminatorias_actas for each row execute function public.auditar_eliminatoria_018();
create trigger auditar_evento_018 before insert on public.eliminatorias_eventos for each row execute function public.auditar_eliminatoria_018();

create function public.iniciar_eliminatoria_018(p_llave_id bigint,p_referencia text) returns bigint
language plpgsql security definer set search_path='' as $$
declare k public.eliminatorias_llaves; m record; fmt public.competencia_formatos_sets; sid bigint; src jsonb; side text;
begin
 if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
 if nullif(btrim(p_referencia),'') is null then raise exception 'Referencia obligatoria' using errcode='22023'; end if;
 select competencia_id into strict k.competencia_id from public.eliminatorias_llaves where id=p_llave_id;
 -- Misma secuencia que 011/016: advisory -> competencia -> grupos -> partidos -> llave.
 perform pg_catalog.pg_advisory_xact_lock(2026003,2);
 perform 1 from public.competencias where id=k.competencia_id for update;
 perform public.bloquear_fuente_eliminatoria_016(k.competencia_id);
 select * into k from public.eliminatorias_llaves where id=p_llave_id for update;
 if k.estado<>'confirmada' or (k.propuesta->>'version_regla') is distinct from '17'
 or not k.reglas_confirmadas or not k.datos_reales_confirmados
 or not exists(select 1 from public.eliminatorias_respaldos where llave_id=k.id)
 then raise exception 'Falta llave oficial 017 y respaldo deportivo manual; históricos 016 no se convierten' using errcode='55000'; end if;
 if exists(select 1 from public.eliminatorias_cuadros where llave_id=k.id) then return k.id; end if;
 perform public.validar_eliminatoria_016(k.competencia_id,k.propuesta);
 insert into public.eliminatorias_cuadros(llave_id,competencia_id,iniciado_por) values(k.id,k.competencia_id,auth.uid());
 for m in select e.*,r.numero rn,r.posiciones from public.eliminatorias_enfrentamientos e join public.eliminatorias_rondas r on r.id=e.ronda_id where e.llave_id=k.id order by r.numero,e.numero loop
   select * into fmt from public.competencia_formatos_sets where competencia_id=k.competencia_id
     and etapa=case m.posiciones when 2 then 'final' when 4 then 'semifinal' when 8 then 'cuartos' else 'previa_cuartos' end for share;
   if not found or fmt.mejor_de not in (3,5) or nullif(btrim(fmt.referencia_resolucion),'') is null then raise exception 'Falta formato de sets respaldado para la ronda' using errcode='55000'; end if;
   insert into public.eliminatorias_partidos(id,llave_id,ronda_id,numero,ronda_numero,jugador_a_id,jugador_b_id,mejor_de,referencia_reglas)
   values(m.id,k.id,m.ronda_id,m.numero,m.rn,m.jugador_a_id,m.jugador_b_id,fmt.mejor_de,fmt.referencia_resolucion);
   foreach side in array array['a','b'] loop
     src:=case side when 'a' then m.origen_a else m.origen_b end;
     if src->>'tipo'='ganador' then
       select p.id into sid from public.eliminatorias_partidos p where p.llave_id=k.id and format('R%s-C%s',p.ronda_numero,p.numero)=src->>'cruce' and p.ronda_numero<m.rn;
       if sid is null then raise exception 'Origen ganador inválido' using errcode='23514'; end if;
       if side='a' then update public.eliminatorias_partidos set fuente_a_id=sid where id=m.id;
       else update public.eliminatorias_partidos set fuente_b_id=sid where id=m.id; end if;
     end if;
   end loop;
 end loop;
 insert into public.eliminatorias_eventos(llave_id,evento,actor_id,referencia) values(k.id,'iniciado',auth.uid(),p_referencia);
 return k.id;
end $$;

-- Toda mutación toma primero el bloqueo del cuadro: orden común para concurrencia.
create function public.operar_eliminatoria_018(p_partido_id bigint,p_operacion text,p_revision integer,p_referencia text,
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
 if p_operacion in ('asignar','observar','confirmar') then
   if public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
 else
   if public.es_arbitro_013() is distinct from true or p.arbitro_id is distinct from auth.uid() then raise exception 'Solo Árbitro asignado' using errcode='42501'; end if;
 end if;
 if p_operacion='confirmar' and p.estado='confirmado' and p.revision=p_revision then return p.id; end if;
 if c.estado<>'en_curso' or p.estado='confirmado' then raise exception 'Resultado confirmado inmutable' using errcode='55000'; end if;
 if p.revision is distinct from p_revision then raise exception 'Revisión cambió: recargue' using errcode='40001'; end if;
 if p.jugador_a_id is null or p.jugador_b_id is null then raise exception 'Participantes pendientes' using errcode='55000'; end if;
 if exists(select 1 from public.eliminatorias_partidos where llave_id=p.llave_id and perdedor_id in (p.jugador_a_id,p.jugador_b_id)) then raise exception 'Jugador eliminado' using errcode='55000'; end if;
 if p_operacion='asignar' then
   if p.revision>0 or p.estado<>'pendiente' then raise exception 'Asignación ya utilizada' using errcode='55000'; end if;
   if not exists(select 1 from public.perfiles where id=p_arbitro_id and rol='arbitro'::public.rol_usuario)
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

-- Lecturas asignadas sin ampliar acceso a las llaves históricas ni recursión RLS.
create function public.leer_partido_eliminatoria_018(pid bigint) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.es_juez_general() or public.es_administrador() or exists(select 1 from public.eliminatorias_partidos where id=pid and arbitro_id=auth.uid() and public.es_arbitro_013()))
$$;
do $$ declare t text; begin
 foreach t in array array['eliminatorias_respaldos','eliminatorias_cuadros','eliminatorias_partidos','eliminatorias_actas','eliminatorias_eventos'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
   execute format('grant select on public.%I to authenticated',t);
   execute format('create trigger proteger_cambios_018 before update or delete on public.%I for each row execute function public.proteger_operacion_eliminatoria_018()',t);
   execute format('create trigger proteger_truncate_018 before truncate on public.%I for each statement execute function public.proteger_operacion_eliminatoria_018()',t);
 end loop;
end $$;
create policy respaldos_lectura_018 on public.eliminatorias_respaldos for select to authenticated using((select public.es_juez_general()) or (select public.es_administrador()));
create policy cuadros_lectura_018 on public.eliminatorias_cuadros for select to authenticated using((select public.es_juez_general()) or (select public.es_administrador()));
create policy partidos_lectura_018 on public.eliminatorias_partidos for select to authenticated using(public.leer_partido_eliminatoria_018(id));
create policy actas_lectura_018 on public.eliminatorias_actas for select to authenticated using(public.leer_partido_eliminatoria_018(partido_id));
create policy eventos_lectura_018 on public.eliminatorias_eventos for select to authenticated using((select public.es_juez_general()) or (select public.es_administrador()) or public.leer_partido_eliminatoria_018(partido_id));
create policy jugadores_eliminatorias_018 on public.jugadores for select to authenticated using(exists(select 1 from public.eliminatorias_partidos p where p.arbitro_id=(select auth.uid()) and (jugadores.id=p.jugador_a_id or jugadores.id=p.jugador_b_id)));
revoke all on sequence public.eliminatorias_actas_id_seq,public.eliminatorias_eventos_id_seq from public,anon,authenticated,service_role;
revoke all on function public.auditar_eliminatoria_018(),public.proteger_operacion_eliminatoria_018(),public.iniciar_eliminatoria_018(bigint,text),public.operar_eliminatoria_018(bigint,text,integer,text,uuid,jsonb),public.leer_partido_eliminatoria_018(bigint) from public,anon,authenticated,service_role;
grant execute on function public.iniciar_eliminatoria_018(bigint,text),public.operar_eliminatoria_018(bigint,text,integer,text,uuid,jsonb),public.leer_partido_eliminatoria_018(bigint) to authenticated;
commit;
