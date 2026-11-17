-- SpinTrack 024: regularización administrativa excepcional del respaldo 021.
-- No modifica resultados, clasificaciones, llaves ni participantes.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $$ begin
  if to_regprocedure('public.autorizar_preparacion_022()') is null
     or to_regclass('public.competencia_formato_final_021') is null then
    raise exception '024 requiere 022 y 021 instaladas' using errcode='3F000';
  end if;
end $$;

create table if not exists public.competencia_final_regularizaciones_024 (
  competencia_id bigint primary key references public.competencias(id) on delete restrict,
  referencia_deportiva text not null check (length(btrim(referencia_deportiva)) between 1 and 1000),
  motivo text not null check (length(btrim(motivo)) between 1 and 1000),
  regularizado_por uuid not null references public.perfiles(id) on delete restrict,
  regularizado_en timestamptz not null default clock_timestamp()
);
alter table public.competencia_final_regularizaciones_024 enable row level security;
revoke all on public.competencia_final_regularizaciones_024 from public,anon,authenticated,service_role;
grant select on public.competencia_final_regularizaciones_024 to authenticated;
drop policy if exists regularizaciones_final_admin_024 on public.competencia_final_regularizaciones_024;
create policy regularizaciones_final_admin_024 on public.competencia_final_regularizaciones_024
  for select to authenticated using ((select public.es_administrador()));

-- 022 conserva la preparación como propiedad del Administrador, pero esta
-- validación evita entregar una competencia sin formato/respaldo de la final.
create or replace function public.validar_entrega_preparacion_024() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.configuracion_aprobada and not exists(
    select 1 from public.competencia_formatos_sets f
    where f.competencia_id=new.competencia_id and f.etapa='final'
      and f.mejor_de=5 and nullif(btrim(f.referencia_resolucion),'') is not null
  ) and not exists(
    select 1 from public.competencia_formato_final_021 f
    where f.competencia_id=new.competencia_id and f.mejor_de=5
      and nullif(btrim(f.referencia_resolucion),'') is not null
  ) then
    raise exception 'La preparación no puede entregarse: falta respaldo de la final al mejor de 5' using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists z_validar_entrega_024 on public.competencia_control_deportivo;
create trigger z_validar_entrega_024 before insert or update on public.competencia_control_deportivo
for each row execute function public.validar_entrega_preparacion_024();

create or replace function public.regularizar_respaldo_final_024(
  p_competencia_id bigint, p_referencia text, p_motivo text
) returns boolean language plpgsql security definer set search_path='' as $$
declare c public.competencia_control_deportivo; f public.competencia_formatos_sets; key_id bigint;
begin
  if auth.uid() is null or public.es_administrador() is distinct from true then
    raise exception 'Solo Administrador puede regularizar el respaldo de la final' using errcode='42501';
  end if;
  if p_competencia_id is null or nullif(btrim(p_referencia),'') is null or length(p_referencia)>1000
     or nullif(btrim(p_motivo),'') is null or length(p_motivo)>1000 then
    raise exception 'Referencia y motivo son obligatorios y deben ser verificables' using errcode='22023';
  end if;
  perform 1 from public.competencias where id=p_competencia_id for update;
  select * into c from public.competencia_control_deportivo where competencia_id=p_competencia_id for update;
  if c.competencia_id is null or c.configuracion_aprobada is distinct from true or c.estado_deportivo<>'preparada' then
    raise exception 'La competencia no está preparada y aprobada' using errcode='55000';
  end if;
  select * into f from public.competencia_formatos_sets where competencia_id=p_competencia_id and etapa='final' for update;
  if f.competencia_id is null or f.mejor_de<>5 then
    raise exception 'La final no está configurada al mejor de 5' using errcode='55000';
  end if;
  if nullif(btrim(f.referencia_resolucion),'') is not null
     or exists(select 1 from public.competencia_formato_final_021 where competencia_id=p_competencia_id) then
    raise exception 'La referencia de la final ya existe; no se sobrescribe' using errcode='23505';
  end if;
  if exists(select 1 from public.competencia_final_regularizaciones_024 where competencia_id=p_competencia_id) then
    raise exception 'La regularización ya fue registrada' using errcode='23505';
  end if;
  if exists(
    select 1 from public.eliminatorias_cuadros q
    join public.eliminatorias_partidos p on p.llave_id=q.llave_id
    where q.competencia_id=p_competencia_id and p.ronda_numero=1 and p.estado<>'pendiente'
  ) then
    raise exception 'La final ya tiene una operación incompatible o confirmada' using errcode='55000';
  end if;
  perform set_config('spintrack.regularizacion_024','on',true);
  update public.competencia_formatos_sets set referencia_resolucion=btrim(p_referencia)
    where competencia_id=p_competencia_id and etapa='final' and referencia_resolucion is null;
  if not found then raise exception 'La referencia ya cambió; recargue' using errcode='40001'; end if;
  insert into public.competencia_formato_final_021(competencia_id,mejor_de,referencia_resolucion,actualizado_por)
    values(p_competencia_id,5,btrim(p_referencia),auth.uid());
  insert into public.competencia_final_regularizaciones_024(competencia_id,referencia_deportiva,motivo,regularizado_por)
    values(p_competencia_id,btrim(p_referencia),btrim(p_motivo),auth.uid());
  return true;
end $$;
revoke all on function public.regularizar_respaldo_final_024(bigint,text,text) from public,anon,authenticated,service_role;
grant execute on function public.regularizar_respaldo_final_024(bigint,text,text) to authenticated;
commit;
