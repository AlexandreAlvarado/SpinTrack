-- Contrato revisado: documentacion/RESULTADOS_SETS.md. Aplicación MANUAL pendiente.
-- Depende de 001–006, 009–011. Sin datos iniciales ni programación operativa.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create function public.calcular_resultado_sets_012(p_sets jsonb,p_mejor_de integer)
returns jsonb language plpgsql immutable set search_path='' as $$
declare s jsonb; a integer; b integer; wa integer:=0; wb integer:=0; objetivo integer;
begin
  if p_mejor_de is null or p_mejor_de not in (3,5) or p_sets is null or jsonb_typeof(p_sets)<>'array' then
    raise exception 'Formato o sets inválidos' using errcode='22023'; end if;
  objetivo:=p_mejor_de/2+1;
  if jsonb_array_length(p_sets) not between objetivo and p_mejor_de then
    raise exception 'Cantidad de sets incompleta o excesiva' using errcode='23514'; end if;
  for s in select value from jsonb_array_elements(p_sets) loop
    if wa=objetivo or wb=objetivo then raise exception 'Sets posteriores al ganador' using errcode='23514'; end if;
    if jsonb_typeof(s) is distinct from 'object' then raise exception 'Set inválido' using errcode='22023'; end if;
    if (select count(*) from jsonb_object_keys(s))<>2 or jsonb_typeof(s->'a') is distinct from 'number'
      or jsonb_typeof(s->'b') is distinct from 'number' or (s->>'a') !~ '^(0|[1-9][0-9]*)$'
      or (s->>'b') !~ '^(0|[1-9][0-9]*)$' then raise exception 'Puntos enteros no negativos requeridos' using errcode='22023'; end if;
    if (s->>'a')::numeric>2147483647 or (s->>'b')::numeric>2147483647 then raise exception 'Puntos fuera del rango técnico' using errcode='22023'; end if;
    a:=(s->>'a')::integer; b:=(s->>'b')::integer;
    if not ((greatest(a,b)=11 and least(a,b)<=9) or (greatest(a,b)>11 and abs(a-b)=2)) then
      raise exception 'Set no válido según ITTF 2.11.1' using errcode='23514'; end if;
    if a>b then wa:=wa+1; else wb:=wb+1; end if;
  end loop;
  if greatest(wa,wb)<>objetivo then raise exception 'Falta definir ganador' using errcode='23514'; end if;
  return jsonb_build_object('sets_a',wa,'sets_b',wb,'ganador',case when wa>wb then 'a' else 'b' end);
end $$;

create table public.resultados_partidos (
  id bigint generated always as identity primary key,
  partido_id bigint not null references public.partidos(id) on delete restrict,
  revision integer not null check(revision>0),
  tipo text not null check(tipo in ('ordinario','incomparecencia','retiro','suspension')),
  sets jsonb not null,
  mejor_de integer not null check(mejor_de in (3,5)),
  sets_a integer, sets_b integer, ganador_id bigint references public.jugadores(id) on delete restrict,
  descripcion text not null default '' check(char_length(descripcion)<=2000),
  referencia_reglas text not null check(char_length(btrim(referencia_reglas)) between 1 and 1000),
  referencia text not null check(char_length(btrim(referencia)) between 1 and 1000),
  motivo_correccion text check(char_length(btrim(motivo_correccion)) between 1 and 1000),
  autor_id uuid not null references public.perfiles(id) on delete restrict,
  creado_en timestamptz not null default clock_timestamp(),
  unique(partido_id,revision),
  check(revision=1 or nullif(btrim(motivo_correccion),'') is not null),
  check((tipo='ordinario' and sets_a is not null and sets_b is not null and ganador_id is not null)
    or (tipo<>'ordinario' and sets='[]'::jsonb and sets_a is null and sets_b is null and ganador_id is null and nullif(btrim(descripcion),'') is not null))
);
create table public.resultados_partidos_eventos (
  id bigint generated always as identity primary key,
  resultado_id bigint not null unique references public.resultados_partidos(id) on delete restrict,
  evento text not null default 'confirmado' check(evento='confirmado'),
  actor_id uuid not null references public.perfiles(id) on delete restrict,
  ocurrido_en timestamptz not null default clock_timestamp(),
  referencia text not null check(char_length(btrim(referencia)) between 1 and 1000)
);

-- Punto de extensión: una futura migración verificará asignación por partido y
-- ausencia de autoarbitraje. El mero rol Árbitro NO autoriza capturar cualquier partido.
create function public.puede_capturar_resultado_012(p_partido_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and public.es_juez_general()
    and exists(select 1 from public.partidos where id=p_partido_id)
$$;

create function public.proteger_resultados_012() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.partidos; l public.lotes_partidos_grupos; r public.resultados_partidos; resumen jsonb; ultima integer;
begin
  if tg_op<>'INSERT' then raise exception 'Actas y eventos inmutables: cree una revisión autorizada' using errcode='55000'; end if;
  if tg_table_name='resultados_partidos' then
    if auth.uid() is null or public.puede_capturar_resultado_012(new.partido_id) is distinct from true then
      raise exception 'Captura sin asignación verificada o rol autorizado' using errcode='42501'; end if;
    select * into p from public.partidos where id=new.partido_id for update;
    select * into l from public.lotes_partidos_grupos where id=p.lote_id for share;
    if l.estado is distinct from 'confirmado' then raise exception 'Solo partidos confirmados' using errcode='55000'; end if;
    select coalesce(max(revision),0) into ultima from public.resultados_partidos where partido_id=p.id;
    if new.revision<>ultima+1 or new.autor_id is distinct from auth.uid() or new.mejor_de<>l.mejor_de then
      raise exception 'Revisión, autor o formato incompatibles' using errcode='40001'; end if;
    if ultima>0 and public.es_juez_general() is distinct from true then raise exception 'Corrección exclusiva del Juez' using errcode='42501'; end if;
    if new.tipo='ordinario' then
      resumen:=public.calcular_resultado_sets_012(new.sets,l.mejor_de);
      if new.sets_a is distinct from (resumen->>'sets_a')::integer or new.sets_b is distinct from (resumen->>'sets_b')::integer
        or new.ganador_id is distinct from (case when resumen->>'ganador'='a' then p.jugador_a_id else p.jugador_b_id end) then
        raise exception 'Resumen no coincide con los sets' using errcode='23514'; end if;
    end if;
    new.creado_en:=clock_timestamp();
  else
    if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General confirma' using errcode='42501'; end if;
    select * into r from public.resultados_partidos where id=new.resultado_id;
    perform 1 from public.partidos where id=r.partido_id for update;
    if r.tipo is distinct from 'ordinario' or new.actor_id is distinct from auth.uid()
      or r.revision is distinct from (select max(revision) from public.resultados_partidos where partido_id=r.partido_id) then
      raise exception 'Revise la última captura ordinaria; incidencia pendiente de resolución' using errcode='55000'; end if;
    perform public.calcular_resultado_sets_012(r.sets,r.mejor_de);
    if not exists(select 1 from public.partidos partido join public.lotes_partidos_grupos lote on lote.id=partido.lote_id where partido.id=r.partido_id and lote.estado='confirmado' and lote.mejor_de=r.mejor_de) then
      raise exception 'Partido o formato no disponible' using errcode='55000'; end if;
    new.ocurrido_en:=clock_timestamp();
  end if;
  return new;
end $$;
create trigger proteger_resultados_012 before insert or update or delete on public.resultados_partidos for each row execute function public.proteger_resultados_012();
create trigger proteger_eventos_resultados_012 before insert or update or delete on public.resultados_partidos_eventos for each row execute function public.proteger_resultados_012();
create trigger proteger_truncate_resultados_012 before truncate on public.resultados_partidos for each statement execute function public.proteger_resultados_012();
create trigger proteger_truncate_eventos_012 before truncate on public.resultados_partidos_eventos for each statement execute function public.proteger_resultados_012();

-- Conserva identidad deportiva aunque una escritura privilegiada intentara mover
-- el partido a otro lote. Permite futuras columnas de programación independientes.
create function public.proteger_identidad_resultado_012() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.resultados_partidos where partido_id=old.id) then
    if tg_op='DELETE' then raise exception 'Partido con actas: identidad protegida' using errcode='55000'; end if;
    if row(new.id,new.lote_id,new.competencia_id,new.grupo_id,new.jugador_a_id,new.jugador_b_id)
      is distinct from row(old.id,old.lote_id,old.competencia_id,old.grupo_id,old.jugador_a_id,old.jugador_b_id) then
      raise exception 'Partido con actas: identidad protegida' using errcode='55000'; end if;
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger aa_proteger_identidad_resultado_012 before update or delete on public.partidos for each row execute function public.proteger_identidad_resultado_012();

create function public.capturar_resultado_partido(p_partido_id bigint,p_revision_esperada integer,p_tipo text,p_sets jsonb,
  p_referencia text,p_referencia_reglas text,p_reglas_confirmadas boolean,p_descripcion text default '',p_motivo text default null)
returns bigint language plpgsql security definer set search_path='' as $$
declare p public.partidos; l public.lotes_partidos_grupos; ultima integer; resumen jsonb; nuevo bigint;
begin
  if auth.uid() is null or public.puede_capturar_resultado_012(p_partido_id) is distinct from true then raise exception 'Sin rol autorizado o asignación verificada' using errcode='42501'; end if;
  if p_revision_esperada is null or p_revision_esperada<0 or p_tipo is null or p_tipo not in ('ordinario','incomparecencia','retiro','suspension')
    or nullif(btrim(p_referencia),'') is null or nullif(btrim(p_referencia_reglas),'') is null
    or p_reglas_confirmadas is distinct from true then raise exception 'Confirme reglas aplicables y referencias' using errcode='22023'; end if;
  select * into p from public.partidos where id=p_partido_id for update;
  select * into l from public.lotes_partidos_grupos where id=p.lote_id for share;
  if l.estado is distinct from 'confirmado' then raise exception 'Solo partidos confirmados' using errcode='55000'; end if;
  select coalesce(max(revision),0) into ultima from public.resultados_partidos where partido_id=p.id;
  if ultima<>p_revision_esperada then raise exception 'La captura cambió: recargue' using errcode='40001'; end if;
  if ultima>0 and (public.es_juez_general() is distinct from true or nullif(btrim(p_motivo),'') is null) then
    raise exception 'Corrección requiere Juez y motivo' using errcode='42501'; end if;
  if p_tipo='ordinario' then resumen:=public.calcular_resultado_sets_012(p_sets,l.mejor_de);
  elsif p_sets is distinct from '[]'::jsonb or nullif(btrim(p_descripcion),'') is null then
    raise exception 'Incidencia requiere descripción, sin sets ni ganador automático' using errcode='22023'; end if;
  insert into public.resultados_partidos(partido_id,revision,tipo,sets,mejor_de,sets_a,sets_b,ganador_id,descripcion,referencia_reglas,referencia,motivo_correccion,autor_id)
    values(p.id,ultima+1,p_tipo,p_sets,l.mejor_de,(resumen->>'sets_a')::integer,(resumen->>'sets_b')::integer,
      case when resumen->>'ganador'='a' then p.jugador_a_id when resumen->>'ganador'='b' then p.jugador_b_id end,
      coalesce(btrim(p_descripcion),''),btrim(p_referencia_reglas),btrim(p_referencia),nullif(btrim(p_motivo),''),auth.uid()) returning id into nuevo;
  return nuevo;
end $$;

create function public.confirmar_resultado_partido(p_partido_id bigint,p_resultado_id bigint,p_revision_esperada integer,p_referencia text)
returns bigint language plpgsql security definer set search_path='' as $$
declare r public.resultados_partidos;
begin
  if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
  if nullif(btrim(p_referencia),'') is null then raise exception 'Referencia de validación requerida' using errcode='22023'; end if;
  perform 1 from public.partidos where id=p_partido_id for update;
  select * into r from public.resultados_partidos where id=p_resultado_id and partido_id=p_partido_id;
  if not found or r.revision is distinct from p_revision_esperada or r.revision<>(select max(revision) from public.resultados_partidos where partido_id=p_partido_id)
    or exists(select 1 from public.resultados_partidos_eventos where resultado_id=r.id) then
    raise exception 'Captura obsoleta o ya confirmada: recargue' using errcode='40001'; end if;
  insert into public.resultados_partidos_eventos(resultado_id,actor_id,referencia) values(r.id,auth.uid(),btrim(p_referencia));
  return r.id;
end $$;

alter table public.resultados_partidos enable row level security;
alter table public.resultados_partidos_eventos enable row level security;
revoke all on public.resultados_partidos,public.resultados_partidos_eventos from public,anon,authenticated,service_role;
grant select on public.resultados_partidos,public.resultados_partidos_eventos to authenticated;
create policy resultados_operadores_012 on public.resultados_partidos for select to authenticated using ((select public.es_juez_general()) or (select public.es_administrador()));
create policy eventos_resultados_operadores_012 on public.resultados_partidos_eventos for select to authenticated using ((select public.es_juez_general()) or (select public.es_administrador()));
revoke all on sequence public.resultados_partidos_id_seq,public.resultados_partidos_eventos_id_seq from public,anon,authenticated,service_role;
revoke all on function public.calcular_resultado_sets_012(jsonb,integer),public.puede_capturar_resultado_012(bigint),public.proteger_resultados_012(),public.proteger_identidad_resultado_012(),
  public.capturar_resultado_partido(bigint,integer,text,jsonb,text,text,boolean,text,text),public.confirmar_resultado_partido(bigint,bigint,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.capturar_resultado_partido(bigint,integer,text,jsonb,text,text,boolean,text,text),public.confirmar_resultado_partido(bigint,bigint,integer,text) to authenticated;

-- SECURITY INVOKER conserva RLS de todas las tablas de origen.
create view public.resultados_confirmados_grupos with (security_invoker=true) as
  select distinct on (p.id) p.id as partido_id,p.competencia_id,p.grupo_id,p.jugador_a_id,p.jugador_b_id,
    r.id as resultado_id,r.revision,r.sets,r.sets_a,r.sets_b,r.ganador_id,e.actor_id as validado_por,e.ocurrido_en as validado_en
  from public.partidos p join public.resultados_partidos r on r.partido_id=p.id
  join public.resultados_partidos_eventos e on e.resultado_id=r.id
  where r.tipo='ordinario' order by p.id,r.revision desc;
revoke all on public.resultados_confirmados_grupos from public,anon,authenticated,service_role;
grant select on public.resultados_confirmados_grupos to authenticated;
commit;
