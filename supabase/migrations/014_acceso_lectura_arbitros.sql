-- Acceso de lectura acotado para árbitros asignados.
-- Requiere 001_base_segura.sql a 013_asignaciones_arbitros_resultados.sql aplicadas.
-- No modifica resultados, asignaciones, grupos ni reglas deportivas.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create policy lotes_arbitros_asignados_014 on public.lotes_partidos_grupos
  for select to authenticated
  using (exists (
    select 1
    from public.partidos p
    join public.partidos_arbitros pa on pa.partido_id = p.id
    where p.lote_id = lotes_partidos_grupos.id
      and pa.arbitro_id = (select auth.uid())
      and pa.activo
  ));

create policy partidos_arbitros_asignados_014 on public.partidos
  for select to authenticated
  using (exists (
    select 1
    from public.partidos_arbitros pa
    where pa.partido_id = partidos.id
      and pa.arbitro_id = (select auth.uid())
      and pa.activo
  ));

create policy jugadores_arbitros_asignados_014 on public.jugadores
  for select to authenticated
  using (exists (
    select 1
    from public.partidos p
    join public.partidos_arbitros pa on pa.partido_id = p.id
    where pa.arbitro_id = (select auth.uid())
      and pa.activo
      and (jugadores.id = p.jugador_a_id or jugadores.id = p.jugador_b_id)
  ));

commit;
