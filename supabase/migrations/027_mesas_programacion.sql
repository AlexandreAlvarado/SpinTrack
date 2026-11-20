-- Revisión y aplicación MANUAL. Sin datos deportivos nuevos ni cambios a 001–026.
-- Reservas operativas; los resultados y avances conservan sus fuentes existentes.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- Fila técnica, sin datos deportivos. El UPDATE también fuerza error de
-- serialización en REPEATABLE READ/SERIALIZABLE con una fotografía obsoleta.
create table public.programacion_guardia_027 (id boolean primary key check(id), version bigint not null);
insert into public.programacion_guardia_027 values(true,0);
alter table public.programacion_guardia_027 enable row level security;
revoke all on public.programacion_guardia_027 from public,anon,authenticated,service_role;
create function public.bloquear_programacion_027() returns void language sql security definer set search_path='' as $$
 update public.programacion_guardia_027 set version=version+1 where id=true;
$$;
revoke all on function public.bloquear_programacion_027() from public,anon,authenticated,service_role;

create table public.mesas_jornada (
 id bigint generated always as identity primary key,
 fecha_id bigint not null references public.fechas(id), numero integer not null check(numero>0),
 estado text not null default 'disponible' check(estado in ('disponible','fuera_servicio')),
 unique(fecha_id,numero), unique(id,fecha_id)
);
create table public.programacion_reservas (
 id bigint generated always as identity primary key,
 fecha_id bigint not null references public.fechas(id), mesa_id bigint not null,
 grupo_partido_id bigint references public.partidos(id), eliminatoria_partido_id bigint references public.eliminatorias_partidos(id),
 inicio timestamptz not null, fin timestamptz not null, descanso_minutos integer not null check(descanso_minutos between 0 and 1440),
 arbitro_id uuid not null references public.perfiles(id), jugadores bigint[] not null, perfiles uuid[] not null,
 estado text not null default 'asignada' check(estado in ('asignada','en_juego','revision','liberada','cancelada')),
 version integer not null default 1, liberado_en timestamptz,
 foreign key(mesa_id,fecha_id) references public.mesas_jornada(id,fecha_id),
 check(num_nonnulls(grupo_partido_id,eliminatoria_partido_id)=1), check(fin>inicio and fin-inicio<=interval '1 day')
);
create unique index programacion_grupo_activo_027 on public.programacion_reservas(grupo_partido_id) where estado not in ('liberada','cancelada');
create unique index programacion_llave_activa_027 on public.programacion_reservas(eliminatoria_partido_id) where estado not in ('liberada','cancelada');
create index programacion_jornada_027 on public.programacion_reservas(fecha_id,estado);
create table public.programacion_historial (
 id bigint generated always as identity primary key, fecha_id bigint not null references public.fechas(id),
 reserva_id bigint references public.programacion_reservas(id), evento text not null,
 actor_id uuid not null references public.perfiles(id), ocurrido_en timestamptz not null default clock_timestamp(),
 motivo text not null check(length(btrim(motivo)) between 1 and 1000), detalle jsonb not null
);

-- Proyección privada. Solo materializa identidad/estado; nunca calcula clasificados.
create view public.programacion_partidos_027 with (security_invoker=true) as
select 'grupo'::text tipo,p.id,p.competencia_id,c.fecha_id,p.jugador_a_id a,p.jugador_b_id b,
 a.nombre_completo nombre_a,b.nombre_completo nombre_b,a.perfil_id perfil_a,b.perfil_id perfil_b,
 pa.arbitro_id,
 case when rc.partido_id is not null then 'confirmado' when r.id is not null then 'revision' else 'pendiente' end estado,
 (l.estado='confirmado' and r.id is null and ctl.configuracion_aprobada and ctl.estado_deportivo in ('preparada','en_curso')) elegible,ctl.inicio_programado inicio
from public.partidos p join public.competencias c on c.id=p.competencia_id
join public.lotes_partidos_grupos l on l.id=p.lote_id
join public.jugadores a on a.id=p.jugador_a_id join public.jugadores b on b.id=p.jugador_b_id
join public.competencia_control_deportivo ctl on ctl.competencia_id=c.id
left join public.partidos_arbitros pa on pa.partido_id=p.id and pa.activo
left join lateral(select id from public.resultados_partidos where partido_id=p.id order by revision desc limit 1) r on true
left join public.resultados_confirmados_grupos rc on rc.partido_id=p.id and rc.resultado_id=r.id
union all
select 'eliminatoria',p.id,c.id,c.fecha_id,p.jugador_a_id,p.jugador_b_id,a.nombre_completo,b.nombre_completo,a.perfil_id,b.perfil_id,p.arbitro_id,p.estado,
 (p.estado='pendiente' and p.jugador_a_id is not null and p.jugador_b_id is not null and cuadro.estado='en_curso' and ctl.configuracion_aprobada and ctl.estado_deportivo in ('preparada','en_curso')
 and (p.fuente_a_id is null or exists(select 1 from public.eliminatorias_partidos f where f.id=p.fuente_a_id and f.estado='confirmado' and f.ganador_id=p.jugador_a_id))
 and (p.fuente_b_id is null or exists(select 1 from public.eliminatorias_partidos f where f.id=p.fuente_b_id and f.estado='confirmado' and f.ganador_id=p.jugador_b_id))),ctl.inicio_programado
from public.eliminatorias_partidos p join public.eliminatorias_cuadros cuadro on cuadro.llave_id=p.llave_id
join public.competencias c on c.id=cuadro.competencia_id
join public.competencia_control_deportivo ctl on ctl.competencia_id=c.id
left join public.jugadores a on a.id=p.jugador_a_id left join public.jugadores b on b.id=p.jugador_b_id;

-- Un único orden de serialización para recursos compartidos entre jornadas/categorías.
-- Además de los índices, el trigger protege intervalos y cruces jugador/árbitro.
create function public.validar_reserva_027() returns trigger language plpgsql security definer set search_path='' as $$
declare m record; t public.mesas_jornada; r public.programacion_reservas; v_fin timestamptz; otro_fin timestamptz; fin_comparado timestamptz;
begin
 perform public.bloquear_programacion_027();
 if new.estado='liberada' then new.liberado_en:=clock_timestamp(); return new; end if;
 if new.estado='cancelada' then return new; end if;
 select * into m from public.programacion_partidos_027 where tipo=case when new.grupo_partido_id is null then 'eliminatoria' else 'grupo' end and id=coalesce(new.grupo_partido_id,new.eliminatoria_partido_id);
 select * into t from public.mesas_jornada where id=new.mesa_id;
 if m.id is null or m.a is null or m.b is null or m.fecha_id<>new.fecha_id or t.fecha_id<>new.fecha_id or t.estado<>'disponible' then raise exception 'Mesa o participantes no disponibles' using errcode='23514'; end if;
 if tg_op='INSERT' and not m.elegible then raise exception 'Partido no elegible' using errcode='23514'; end if;
 if m.inicio is not null and new.inicio<m.inicio then raise exception 'La competencia aún no comienza' using errcode='23514'; end if;
 perform 1 from public.perfiles where id=new.arbitro_id and arbitraje_habilitado for share;
 if m.arbitro_id is distinct from new.arbitro_id or not exists(select 1 from public.perfiles where id=new.arbitro_id and arbitraje_habilitado)
 or new.arbitro_id in (m.perfil_a,m.perfil_b) then raise exception 'Árbitro no habilitado, distinto o autoarbitraje' using errcode='23514'; end if;
 new.jugadores:=array[m.a,m.b]; new.perfiles:=array_remove(array[m.perfil_a,m.perfil_b,new.arbitro_id],null);
 if exists(select 1 from public.programacion_partidos_027 otro where (otro.tipo,otro.id)<>(m.tipo,m.id) and otro.estado in ('en_desarrollo','revision','observado')
 and (array[otro.a,otro.b] && new.jugadores or array_remove(array[otro.perfil_a,otro.perfil_b,otro.arbitro_id],null) && new.perfiles)
 and not exists(select 1 from public.programacion_reservas asignada where asignada.estado not in ('liberada','cancelada') and (otro.tipo='grupo' and asignada.grupo_partido_id=otro.id or otro.tipo='eliminatoria' and asignada.eliminatoria_partido_id=otro.id))) then
 raise exception 'Persona en un encuentro anterior sin mesa o en revisión' using errcode='23P01'; end if;
 v_fin:=case when new.estado in ('en_juego','revision') then 'infinity'::timestamptz else new.fin end;
 for r in select * from public.programacion_reservas where id<>new.id and estado<>'cancelada' loop
   otro_fin:=case when r.estado in ('en_juego','revision') then 'infinity'::timestamptz when r.estado='liberada' then greatest(r.inicio,r.liberado_en) else r.fin end;
   -- Iniciar/enviar no invalida una reserva futura ya existente: esa reserva
   -- sigue siendo estimada y NO podrá comenzar hasta la liberación real.
   fin_comparado:=case when tg_op='UPDATE' and new.estado in ('en_juego','revision') and r.estado='asignada' then new.fin else v_fin end;
   if r.estado<>'liberada' and r.mesa_id=new.mesa_id and tstzrange(new.inicio,fin_comparado,'[)') && tstzrange(r.inicio,otro_fin,'[)') then raise exception 'Mesa ocupada en ese intervalo' using errcode='23P01'; end if;
   if (r.jugadores && new.jugadores or r.perfiles && new.perfiles)
   and tstzrange(new.inicio,fin_comparado+make_interval(mins=>new.descanso_minutos),'[)') && tstzrange(r.inicio,otro_fin+make_interval(mins=>r.descanso_minutos),'[)') then raise exception 'Persona ocupada o en descanso, incluso entre categorías' using errcode='23P01'; end if;
 end loop;
 return new;
end $$;
create trigger validar_reserva_027 before insert or update on public.programacion_reservas for each row execute function public.validar_reserva_027();

create function public.consultar_programacion_027(p_fecha_id bigint) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
 return jsonb_build_object(
 'mesas',(select coalesce(jsonb_agg(to_jsonb(t) order by numero),'[]') from public.mesas_jornada t where fecha_id=p_fecha_id),
 'partidos',(select coalesce(jsonb_agg(to_jsonb(p) order by competencia_id,id),'[]') from public.programacion_partidos_027 p where fecha_id=p_fecha_id),
 'reservas',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('tipo',case when grupo_partido_id is null then 'eliminatoria' else 'grupo' end,'partido',coalesce(grupo_partido_id,eliminatoria_partido_id)) order by inicio,id),'[]') from public.programacion_reservas r where fecha_id=p_fecha_id),
 'arbitros',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',nombre_completo) order by nombre_completo),'[]') from public.perfiles where arbitraje_habilitado),
 'historial',(select coalesce(jsonb_agg(to_jsonb(h) order by id desc),'[]') from (select id,evento,ocurrido_en,motivo from public.programacion_historial where fecha_id=p_fecha_id order by id desc limit 30) h));
end $$;

create function public.gestionar_mesa_027(p_fecha_id bigint,p_numero integer,p_estado text) returns bigint language plpgsql security definer set search_path='' as $$
declare mid bigint;
begin
 if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
 perform public.bloquear_programacion_027();
 select id into mid from public.mesas_jornada where fecha_id=p_fecha_id and numero=p_numero;
 if exists(select 1 from public.programacion_reservas where mesa_id=mid and estado not in ('cancelada','liberada')) and p_estado='fuera_servicio' then raise exception 'Reprograme primero los encuentros de la mesa' using errcode='55000'; end if;
 insert into public.mesas_jornada(fecha_id,numero,estado) values(p_fecha_id,p_numero,p_estado) on conflict(fecha_id,numero) do update set estado=excluded.estado returning id into mid;
 insert into public.programacion_historial(fecha_id,evento,actor_id,motivo,detalle) values(p_fecha_id,'mesa',auth.uid(),'Configuración de mesa',jsonb_build_object('mesa',mid,'estado',p_estado));
 return mid;
end $$;

-- Confirmación atómica de una tanda. Reprogramar exige id+versión; una propuesta
-- obsoleta falla por completo y conserva la asignación previa.
create function public.confirmar_programacion_027(p_fecha_id bigint,p_asignaciones jsonb,p_descanso integer,p_motivo text) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb; m record; vieja public.programacion_reservas; rid bigint; revision_actual integer;
begin
 if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
 if jsonb_typeof(p_asignaciones) is distinct from 'array' or jsonb_array_length(p_asignaciones) not between 1 and 100 or nullif(btrim(p_motivo),'') is null then raise exception 'Propuesta y motivo requeridos' using errcode='22023'; end if;
 perform public.bloquear_programacion_027();
 for item in select value from jsonb_array_elements(p_asignaciones) loop
   select * into m from public.programacion_partidos_027 where tipo=item->>'tipo' and id=(item->>'partido')::bigint and fecha_id=p_fecha_id;
   if m.id is null or not m.elegible then raise exception 'Partido cambiado o no elegible: recargue' using errcode='40001'; end if;
   if item->>'reserva_id' is not null then
     select * into vieja from public.programacion_reservas where id=(item->>'reserva_id')::bigint and fecha_id=p_fecha_id for update;
     if vieja.id is null or vieja.version is distinct from (item->>'version')::integer or vieja.estado<>'asignada' or coalesce(vieja.grupo_partido_id,vieja.eliminatoria_partido_id)<>m.id or (vieja.grupo_partido_id is null)<>(m.tipo='eliminatoria') then raise exception 'Reserva cambió: recargue' using errcode='40001'; end if;
     update public.programacion_reservas set estado='cancelada',version=version+1 where id=vieja.id;
   end if;
   if m.tipo='grupo' then
     perform 1 from public.partidos where id=m.id for update;
     if m.arbitro_id is distinct from (item->>'arbitro_id')::uuid then perform public.asignar_arbitro_partido(m.id,(item->>'arbitro_id')::uuid,p_motivo); end if;
   else
     select revision into revision_actual from public.eliminatorias_partidos where id=m.id for update;
     if m.arbitro_id is distinct from (item->>'arbitro_id')::uuid then perform public.operar_eliminatoria_018(m.id,'asignar',revision_actual,p_motivo,(item->>'arbitro_id')::uuid); end if;
   end if;
   insert into public.programacion_reservas(fecha_id,mesa_id,grupo_partido_id,eliminatoria_partido_id,inicio,fin,descanso_minutos,arbitro_id,jugadores,perfiles)
   values(p_fecha_id,(item->>'mesa_id')::bigint,case when m.tipo='grupo' then m.id end,case when m.tipo='eliminatoria' then m.id end,(item->>'inicio')::timestamptz,(item->>'fin')::timestamptz,p_descanso,(item->>'arbitro_id')::uuid,array[m.a,m.b],array[]::uuid[]) returning id into rid;
   insert into public.programacion_historial(fecha_id,reserva_id,evento,actor_id,motivo,detalle) values(p_fecha_id,rid,case when item->>'reserva_id' is null then 'asignada' else 'reprogramada' end,auth.uid(),p_motivo,item);
 end loop;
end $$;

create function public.operar_reserva_027(p_id bigint,p_version integer,p_operacion text,p_motivo text) returns void language plpgsql security definer set search_path='' as $$
declare r public.programacion_reservas; m record;
begin
 if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
 perform public.bloquear_programacion_027();
 select * into r from public.programacion_reservas where id=p_id for update;
 if r.id is null or r.version is distinct from p_version or nullif(btrim(p_motivo),'') is null then raise exception 'Reserva cambió o falta motivo' using errcode='40001'; end if;
 if r.grupo_partido_id is not null then perform 1 from public.partidos where id=r.grupo_partido_id for update;
 else perform 1 from public.eliminatorias_partidos where id=r.eliminatoria_partido_id for update; end if;
 select * into m from public.programacion_partidos_027 where tipo=case when r.grupo_partido_id is null then 'eliminatoria' else 'grupo' end and id=coalesce(r.grupo_partido_id,r.eliminatoria_partido_id);
 if p_operacion='comenzar' and r.estado='asignada' and m.elegible then
   if r.inicio>clock_timestamp() then raise exception 'Reprograme el inicio antes de comenzar' using errcode='55000'; end if;
   update public.programacion_reservas set estado='en_juego',version=version+1 where id=r.id;
 elsif p_operacion='liberar' and r.estado='asignada' and m.elegible then
   update public.programacion_reservas set estado='cancelada',version=version+1 where id=r.id;
 else raise exception 'No se puede liberar ni mover un partido iniciado o en revisión' using errcode='55000'; end if;
 insert into public.programacion_historial(fecha_id,reserva_id,evento,actor_id,motivo,detalle) values(r.fecha_id,r.id,p_operacion,auth.uid(),p_motivo,to_jsonb(r));
end $$;

-- Sin reemplazar RPC deportivas: observar el estado canónico después de cada cambio.
create function public.sincronizar_programacion_027() returns trigger language plpgsql security definer set search_path='' as $$
declare mid bigint; tipo_partido text; estado_actual text; r public.programacion_reservas; m record; personas uuid[];
begin
 perform public.bloquear_programacion_027();
 if tg_table_name='eliminatorias_partidos' then mid:=new.id; tipo_partido:='eliminatoria';
 elsif tg_table_name='resultados_partidos_eventos' then select partido_id into mid from public.resultados_partidos where id=new.resultado_id; tipo_partido:='grupo';
 else mid:=new.partido_id; tipo_partido:='grupo'; end if;
 select estado into estado_actual from public.programacion_partidos_027 where tipo=tipo_partido and id=mid;
 if estado_actual in ('en_desarrollo','revision','observado') and not exists(select 1 from public.programacion_reservas where estado not in ('cancelada','liberada') and (tipo_partido='grupo' and grupo_partido_id=mid or tipo_partido='eliminatoria' and eliminatoria_partido_id=mid)) then
   select * into m from public.programacion_partidos_027 where tipo=tipo_partido and id=mid;
   personas:=array_remove(array[m.perfil_a,m.perfil_b,m.arbitro_id],null);
   if exists(select 1 from public.programacion_reservas where estado not in ('cancelada','liberada') and (estado in ('en_juego','revision') or fin>clock_timestamp()) and
    (jugadores && array[m.a,m.b] or perfiles && personas) and (case when grupo_partido_id is null then 'eliminatoria' else 'grupo' end,coalesce(grupo_partido_id,eliminatoria_partido_id))<>(tipo_partido,mid))
   or exists(select 1 from public.programacion_partidos_027 otro where (otro.tipo,otro.id)<>(m.tipo,m.id) and otro.estado in ('en_desarrollo','revision','observado') and (array[otro.a,otro.b] && array[m.a,m.b] or array_remove(array[otro.perfil_a,otro.perfil_b,otro.arbitro_id],null) && personas)) then raise exception 'Persona ocupada en otro encuentro' using errcode='23P01'; end if;
 end if;
 for r in select * from public.programacion_reservas where (tipo_partido='grupo' and grupo_partido_id=mid or tipo_partido='eliminatoria' and eliminatoria_partido_id=mid) and estado<>'cancelada' order by id desc limit 1 loop
   if estado_actual='confirmado' then estado_actual:='liberada';
   elsif estado_actual in ('revision','observado') then estado_actual:='revision';
   elsif estado_actual='en_desarrollo' then estado_actual:='en_juego';
   else return new; end if;
   if r.estado<>estado_actual then
     update public.programacion_reservas set estado=estado_actual,version=version+1 where id=r.id;
     insert into public.programacion_historial(fecha_id,reserva_id,evento,actor_id,motivo,detalle) values(r.fecha_id,r.id,estado_actual,auth.uid(),'Transición deportiva',to_jsonb(new));
   end if;
 end loop;
 return new;
end $$;
create trigger sincronizar_resultado_027 after insert on public.resultados_partidos for each row execute function public.sincronizar_programacion_027();
create trigger sincronizar_confirmacion_027 after insert on public.resultados_partidos_eventos for each row execute function public.sincronizar_programacion_027();
create trigger sincronizar_eliminatoria_027 after update on public.eliminatorias_partidos for each row execute function public.sincronizar_programacion_027();

create function public.proteger_arbitro_programado_027() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.programacion_reservas;
begin
 perform public.bloquear_programacion_027();
 for r in select * from public.programacion_reservas booked where booked.estado not in ('liberada','cancelada') and
 ((tg_table_name='partidos_arbitros' and booked.grupo_partido_id=(to_jsonb(new)->>'partido_id')::bigint)
 or (tg_table_name='eliminatorias_partidos' and booked.eliminatoria_partido_id=(to_jsonb(new)->>'id')::bigint))
 and (booked.arbitro_id is distinct from new.arbitro_id or coalesce((to_jsonb(new)->>'activo')::boolean,true)=false) loop
   if coalesce((to_jsonb(new)->>'activo')::boolean,true)=false then raise exception 'La reserva requiere árbitro activo' using errcode='23514'; end if;
   update public.programacion_reservas set arbitro_id=new.arbitro_id,version=version+1 where id=r.id;
   insert into public.programacion_historial(fecha_id,reserva_id,evento,actor_id,motivo,detalle) values(r.fecha_id,r.id,'árbitro',auth.uid(),'Reasignación deportiva supervisada',to_jsonb(new));
 end loop;
 return new;
end $$;
create trigger proteger_arbitro_programado_027 after insert or update on public.partidos_arbitros for each row execute function public.proteger_arbitro_programado_027();
create trigger proteger_arbitro_llave_programado_027 after update on public.eliminatorias_partidos for each row execute function public.proteger_arbitro_programado_027();

-- Un vínculo jugador/cuenta cambiado por Administración no puede dejar reservas
-- con una identidad antigua ni habilitar autoarbitraje a través de otro panel.
create function public.sincronizar_identidad_programada_027() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.perfil_id is not distinct from old.perfil_id then return new; end if;
 perform public.bloquear_programacion_027();
 update public.programacion_reservas set version=version+1 where estado not in ('cancelada','liberada') and new.id=any(jugadores);
 return new;
end $$;
create trigger sincronizar_identidad_programada_027 after update of perfil_id on public.jugadores for each row execute function public.sincronizar_identidad_programada_027();
revoke all on function public.sincronizar_identidad_programada_027() from public,anon,authenticated,service_role;

alter table public.mesas_jornada enable row level security;
alter table public.programacion_reservas enable row level security;
alter table public.programacion_historial enable row level security;
create policy mesas_lectura_027 on public.mesas_jornada for select to authenticated using(public.es_juez_general());
create policy reservas_lectura_027 on public.programacion_reservas for select to authenticated using(public.es_juez_general());
create policy historial_lectura_027 on public.programacion_historial for select to authenticated using(public.es_juez_general());
revoke all on public.mesas_jornada,public.programacion_reservas,public.programacion_historial,public.programacion_partidos_027 from public,anon,authenticated,service_role;
grant select on public.mesas_jornada,public.programacion_reservas,public.programacion_historial to authenticated;
revoke all on function public.validar_reserva_027(),public.consultar_programacion_027(bigint),public.gestionar_mesa_027(bigint,integer,text),public.confirmar_programacion_027(bigint,jsonb,integer,text),public.operar_reserva_027(bigint,integer,text,text),public.sincronizar_programacion_027(),public.proteger_arbitro_programado_027() from public,anon,authenticated,service_role;
grant execute on function public.consultar_programacion_027(bigint),public.gestionar_mesa_027(bigint,integer,text),public.confirmar_programacion_027(bigint,jsonb,integer,text),public.operar_reserva_027(bigint,integer,text,text) to authenticated;
commit;
