-- Contrato revisado: documentacion/PARTIDOS_GRUPOS.md. Aplicación manual pendiente.
-- Solo cruces individuales; confirmado no significa programado en mesa/horario.
begin;
create table public.lotes_partidos_grupos (
  id bigint generated always as identity primary key,
  competencia_id bigint not null references public.competencias(id) on delete restrict,
  estado text not null default 'borrador' check (estado in ('borrador','descartado','confirmado')),
  formato text not null default 'todos_contra_todos_una_vuelta' check (formato='todos_contra_todos_una_vuelta'),
  mejor_de integer not null check (mejor_de in (3,5)),
  referencia_formato text not null check (char_length(btrim(referencia_formato)) between 1 and 1000),
  creado_por uuid not null references public.perfiles(id),
  creado_en timestamptz not null default clock_timestamp(),
  confirmado_por uuid references public.perfiles(id), confirmado_en timestamptz,
  descartado_por uuid references public.perfiles(id), descartado_en timestamptz,
  motivo_descarte text,
  unique(id,competencia_id),
  check ((estado='borrador' and confirmado_por is null and confirmado_en is null and descartado_por is null and descartado_en is null and motivo_descarte is null)
    or (estado='descartado' and confirmado_por is null and confirmado_en is null and descartado_por is not null and descartado_en is not null and nullif(btrim(motivo_descarte),'') is not null)
    or (estado='confirmado' and confirmado_por is not null and confirmado_en is not null and descartado_por is null and descartado_en is null and motivo_descarte is null))
);
create unique index lotes_partidos_grupos_activo_011 on public.lotes_partidos_grupos(competencia_id) where estado in ('borrador','confirmado');
-- Las FK compuestas impiden cruces ajenos al grupo/lote aun bajo escrituras privilegiadas.
alter table public.grupos_competencia add constraint grupos_id_competencia_011 unique(id,competencia_id);
create table public.partidos (
  id bigint generated always as identity primary key,
  lote_id bigint not null,
  competencia_id bigint not null,
  grupo_id bigint not null,
  jugador_a_id bigint not null,
  jugador_b_id bigint not null,
  foreign key(lote_id,competencia_id) references public.lotes_partidos_grupos(id,competencia_id) on delete restrict,
  foreign key(grupo_id,competencia_id) references public.grupos_competencia(id,competencia_id) on delete restrict,
  foreign key(grupo_id,jugador_a_id) references public.grupo_participantes(grupo_id,jugador_id) on delete restrict,
  foreign key(grupo_id,jugador_b_id) references public.grupo_participantes(grupo_id,jugador_id) on delete restrict,
  check(jugador_a_id < jugador_b_id),
  unique(competencia_id,jugador_a_id,jugador_b_id)
);
create index partidos_grupo_011 on public.partidos(grupo_id);
create table public.partidos_grupos_historial (
  id bigint generated always as identity primary key,
  lote_id bigint not null references public.lotes_partidos_grupos(id),
  competencia_id bigint not null references public.competencias(id),
  evento text not null check(evento in ('generado','descartado','confirmado')),
  actor_id uuid not null references public.perfiles(id),
  ocurrido_en timestamptz not null default clock_timestamp(),
  referencia text not null check(char_length(btrim(referencia)) between 1 and 1000),
  motivo text,
  instantanea jsonb not null
);

create function public.revisar_contexto_partidos_011(p_competencia_id bigint) returns integer
language plpgsql security definer set search_path='' as $$
declare v_grupos jsonb; v_sets integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(2026003,2);
  perform 1 from public.competencias where id=p_competencia_id for update;
  if not exists(select 1 from public.grupos_competencia where competencia_id=p_competencia_id)
    or exists(select 1 from public.grupos_competencia where competencia_id=p_competencia_id and estado<>'confirmado') then
    raise exception 'Se requieren exclusivamente grupos confirmados' using errcode='23514';
  end if;
  select jsonb_agg(jsonb_build_object('numero',g.numero,'jugador_ids',
    (select jsonb_agg(gp.jugador_id order by gp.posicion) from public.grupo_participantes gp where gp.grupo_id=g.id)) order by g.numero)
    into v_grupos from public.grupos_competencia g where g.competencia_id=p_competencia_id;
  perform public.validar_grupos_competencia(p_competencia_id,v_grupos);
  select mejor_de into v_sets from public.competencia_formatos_sets where competencia_id=p_competencia_id and etapa='grupos' for share;
  if v_sets is null then raise exception 'Falta configuración aprobada de sets' using errcode='23514'; end if;
  return v_sets;
end $$;

create function public.generar_partidos_grupos(p_competencia_id bigint,p_formato_confirmado boolean,p_referencia text)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_sets integer; v_lote bigint;
begin
  if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
  if p_formato_confirmado is distinct from true or nullif(btrim(p_referencia),'') is null then
    raise exception 'Confirme el formato respaldado por la Liga e indique su referencia' using errcode='22023'; end if;
  v_sets := public.revisar_contexto_partidos_011(p_competencia_id);
  if exists(select 1 from public.lotes_partidos_grupos where competencia_id=p_competencia_id and estado in ('borrador','confirmado')) then
    raise exception 'Ya existe un lote activo; descarte el borrador antes de regenerar' using errcode='55000'; end if;
  insert into public.lotes_partidos_grupos(competencia_id,mejor_de,referencia_formato,creado_por)
    values(p_competencia_id,v_sets,btrim(p_referencia),auth.uid()) returning id into v_lote;
  insert into public.partidos(lote_id,competencia_id,grupo_id,jugador_a_id,jugador_b_id)
    select v_lote,p_competencia_id,g.id,a.jugador_id,b.jugador_id from public.grupos_competencia g
    join public.grupo_participantes a on a.grupo_id=g.id
    join public.grupo_participantes b on b.grupo_id=g.id and a.jugador_id<b.jugador_id
    where g.competencia_id=p_competencia_id;
  insert into public.partidos_grupos_historial(lote_id,competencia_id,evento,actor_id,referencia,instantanea)
    select v_lote,p_competencia_id,'generado',auth.uid(),btrim(p_referencia),
      jsonb_build_object('mejor_de',v_sets,'partidos',jsonb_agg(to_jsonb(p) order by p.id)) from public.partidos p where lote_id=v_lote;
  return v_lote;
end $$;

create function public.descartar_partidos_grupos(p_competencia_id bigint,p_lote_id bigint,p_motivo text,p_referencia text)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_lote public.lotes_partidos_grupos;
begin
  if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
  if nullif(btrim(p_motivo),'') is null or nullif(btrim(p_referencia),'') is null then raise exception 'Motivo y referencia son obligatorios' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(2026003,2);
  select * into v_lote from public.lotes_partidos_grupos where id=p_lote_id and competencia_id=p_competencia_id for update;
  if not found or v_lote.estado <> 'borrador' then raise exception 'Solo se puede descartar un borrador' using errcode='55000'; end if;
  update public.lotes_partidos_grupos set estado='descartado',descartado_por=auth.uid(),descartado_en=pg_catalog.clock_timestamp(),motivo_descarte=btrim(p_motivo) where id=p_lote_id;
  insert into public.partidos_grupos_historial(lote_id,competencia_id,evento,actor_id,referencia,motivo,instantanea)
    select p_lote_id,p_competencia_id,'descartado',auth.uid(),btrim(p_referencia),btrim(p_motivo),jsonb_build_object('partidos',jsonb_agg(to_jsonb(p) order by p.id)) from public.partidos p where p.lote_id=p_lote_id;
  delete from public.partidos where lote_id=p_lote_id;
  return p_lote_id;
end $$;

create function public.confirmar_partidos_grupos(p_competencia_id bigint,p_lote_id bigint,p_referencia text)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_sets integer; v_lote public.lotes_partidos_grupos;
begin
  if auth.uid() is null or public.es_juez_general() is distinct from true then raise exception 'Solo Juez General' using errcode='42501'; end if;
  if nullif(btrim(p_referencia),'') is null then raise exception 'Referencia obligatoria' using errcode='22023'; end if;
  v_sets := public.revisar_contexto_partidos_011(p_competencia_id);
  select * into v_lote from public.lotes_partidos_grupos where id=p_lote_id and competencia_id=p_competencia_id for update;
  if not found or v_lote.estado<>'borrador' or v_lote.mejor_de<>v_sets then raise exception 'Lote ausente, confirmado o desactualizado' using errcode='55000'; end if;
  -- Cobertura exacta; también detecta alteraciones privilegiadas del borrador.
  if exists(select g.id,a.jugador_id,b.jugador_id from public.grupos_competencia g
      join public.grupo_participantes a on a.grupo_id=g.id
      join public.grupo_participantes b on b.grupo_id=g.id and a.jugador_id<b.jugador_id
      where g.competencia_id=p_competencia_id
      except select grupo_id,jugador_a_id,jugador_b_id from public.partidos where lote_id=p_lote_id)
    or (select count(*) from public.partidos where lote_id=p_lote_id) < 3 then
    raise exception 'Cruces incompletos' using errcode='23514'; end if;
  update public.lotes_partidos_grupos set estado='confirmado',confirmado_por=auth.uid(),confirmado_en=pg_catalog.clock_timestamp() where id=p_lote_id;
  insert into public.partidos_grupos_historial(lote_id,competencia_id,evento,actor_id,referencia,instantanea)
    select p_lote_id,p_competencia_id,'confirmado',auth.uid(),btrim(p_referencia),
      jsonb_build_object('mejor_de',v_sets,'partidos',jsonb_agg(to_jsonb(p) order by p.id)) from public.partidos p where lote_id=p_lote_id;
  return p_lote_id;
end $$;

create function public.proteger_grupos_confirmados_011() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_id bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(2026003,2);
  if tg_table_name='grupos_competencia' then
    if old.estado='confirmado' then raise exception 'Grupo confirmado inmutable' using errcode='55000'; end if;
  else
    v_id := case when tg_op='DELETE' then old.grupo_id else new.grupo_id end;
    if exists(select 1 from public.grupos_competencia where id=v_id and estado='confirmado') then raise exception 'Integrantes confirmados inmutables' using errcode='55000'; end if;
    if tg_op='UPDATE' and exists(select 1 from public.grupos_competencia where id=old.grupo_id and estado='confirmado') then raise exception 'Integrantes confirmados inmutables' using errcode='55000'; end if;
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger proteger_grupo_011 before update or delete on public.grupos_competencia for each row execute function public.proteger_grupos_confirmados_011();
create trigger proteger_integrantes_011 before insert or update or delete on public.grupo_participantes for each row execute function public.proteger_grupos_confirmados_011();

create function public.proteger_preparacion_partidos_011() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(2026003,2);
  if exists(select 1 from public.lotes_partidos_grupos where competencia_id=old.competencia_id and estado='confirmado') then
    if tg_op='DELETE' or tg_table_name='competencia_formatos_sets' then raise exception 'Hay partidos: configuración bloqueada' using errcode='55000'; end if;
    if (to_jsonb(new)-'actualizado_en'-'actualizado_por'-'estado_deportivo') is distinct from
       (to_jsonb(old)-'actualizado_en'-'actualizado_por'-'estado_deportivo') then
      raise exception 'Hay partidos: preparación bloqueada' using errcode='55000'; end if;
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger aa_proteger_preparacion_011 before update or delete on public.competencia_control_deportivo for each row execute function public.proteger_preparacion_partidos_011();
create trigger aa_proteger_sets_011 before update or delete on public.competencia_formatos_sets for each row execute function public.proteger_preparacion_partidos_011();

create function public.proteger_lote_partidos_011() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_lote_estado text;
begin
  if tg_table_name='lotes_partidos_grupos' then
    if tg_op in ('UPDATE','DELETE') and old.estado='confirmado' then raise exception 'Lote confirmado inmutable' using errcode='55000'; end if;
  else
    select estado into v_lote_estado from public.lotes_partidos_grupos where id=case when tg_op='DELETE' then old.lote_id else new.lote_id end;
    if v_lote_estado='confirmado' then raise exception 'Partido de lote confirmado inmutable' using errcode='55000'; end if;
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger proteger_lote_011 before update or delete on public.lotes_partidos_grupos for each row execute function public.proteger_lote_partidos_011();
create trigger proteger_partido_011 before insert or update or delete on public.partidos for each row execute function public.proteger_lote_partidos_011();

alter table public.lotes_partidos_grupos enable row level security;
alter table public.partidos enable row level security;
alter table public.partidos_grupos_historial enable row level security;
revoke all on public.lotes_partidos_grupos,public.partidos,public.partidos_grupos_historial from public,anon,authenticated,service_role;
grant select on public.lotes_partidos_grupos,public.partidos,public.partidos_grupos_historial to authenticated;
create policy lotes_operadores_011 on public.lotes_partidos_grupos for select to authenticated using ((select public.es_juez_general()) or (select public.es_administrador()));
create policy partidos_operadores_011 on public.partidos for select to authenticated using ((select public.es_juez_general()) or (select public.es_administrador()));
create policy historial_operadores_011 on public.partidos_grupos_historial for select to authenticated using ((select public.es_juez_general()) or (select public.es_administrador()));
revoke all on sequence public.lotes_partidos_grupos_id_seq,public.partidos_id_seq,public.partidos_grupos_historial_id_seq from public,anon,authenticated,service_role;
revoke all on function public.revisar_contexto_partidos_011(bigint),public.generar_partidos_grupos(bigint,boolean,text),public.descartar_partidos_grupos(bigint,bigint,text,text),public.confirmar_partidos_grupos(bigint,bigint,text),public.proteger_grupos_confirmados_011(),public.proteger_preparacion_partidos_011(),public.proteger_lote_partidos_011() from public,anon,authenticated,service_role;
grant execute on function public.generar_partidos_grupos(bigint,boolean,text),public.descartar_partidos_grupos(bigint,bigint,text,text),public.confirmar_partidos_grupos(bigint,bigint,text) to authenticated;
commit;
