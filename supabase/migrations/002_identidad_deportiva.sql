-- Identidad deportiva exclusivamente individual. Sin importaciones ni datos iniciales.
-- Requiere 001_base_segura.sql aplicada. Ejecutar una sola vez, como propietario.
-- No cambia perfiles, temporadas, fechas ni las funciones/políticas de la migración 001.
begin;

create table public.localidades (
  id bigint generated always as identity primary key,
  nombre text not null,
  region text,
  pais text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint localidades_nombre_valido check (
    char_length(nombre) between 1 and 150 and nombre ~ '[^[:space:]]'
  ),
  constraint localidades_region_valida check (
    region is null or (char_length(region) between 1 and 150 and region ~ '[^[:space:]]')
  ),
  constraint localidades_pais_valido check (
    pais is null or (char_length(pais) between 1 and 100 and pais ~ '[^[:space:]]')
  )
);

create table public.asociaciones (
  id bigint generated always as identity primary key,
  nombre text not null,
  localidad_id bigint references public.localidades(id) on delete restrict,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint asociaciones_nombre_valido check (
    char_length(nombre) between 1 and 150 and nombre ~ '[^[:space:]]'
  )
);

create table public.clubes (
  id bigint generated always as identity primary key,
  nombre text not null,
  localidad_id bigint references public.localidades(id) on delete restrict,
  asociacion_id bigint references public.asociaciones(id) on delete restrict,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint clubes_nombre_valido check (
    char_length(nombre) between 1 and 150 and nombre ~ '[^[:space:]]'
  )
);

create table public.jugadores (
  id bigint generated always as identity primary key,
  perfil_id uuid unique references public.perfiles(id) on delete set null,
  nombre_completo text not null,
  fecha_nacimiento date,
  localidad_procedencia_id bigint references public.localidades(id) on delete restrict,
  club_id bigint references public.clubes(id) on delete restrict,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint jugadores_nombre_valido check (
    char_length(nombre_completo) between 1 and 160 and nombre_completo ~ '[^[:space:]]'
  ),
  constraint jugadores_nacimiento_valido check (
    fecha_nacimiento is null or (
      isfinite(fecha_nacimiento) and fecha_nacimiento <= current_date
    )
  )
);

comment on table public.jugadores is
  'Registro deportivo individual independiente de Auth. Los nombres NO son identificadores únicos.';
comment on column public.jugadores.perfil_id is
  'Vínculo opcional 1:1 con una cuenta de cualquier rol. Solo un administrador puede establecerlo. Borrar la cuenta conserva el jugador.';
comment on column public.jugadores.fecha_nacimiento is
  'Dato privado opcional. NULL significa desconocido: no inventar fechas a partir de nombres o categorías del Excel. La elegibilidad futura requerirá verificación.';
comment on column public.jugadores.localidad_procedencia_id is
  'Procedencia actual, independiente del club. La representación histórica se conservará en futuras inscripciones.';
comment on column public.jugadores.club_id is
  'Club actual opcional. No implica condición federativa; esta se gestionará por temporada. No sustituye el historial futuro de afiliaciones.';
comment on table public.asociaciones is
  'Entidad distinta de club y localidad. No interpretar automáticamente los códigos Asoc. del Excel.';

-- Las PK y UNIQUE(perfil_id) ya tienen índice. Indexar las otras FK.
create index asociaciones_localidad_idx on public.asociaciones(localidad_id);
create index clubes_localidad_idx on public.clubes(localidad_id);
create index clubes_asociacion_idx on public.clubes(asociacion_id);
create index jugadores_procedencia_idx on public.jugadores(localidad_procedencia_id);
create index jugadores_club_idx on public.jugadores(club_id);
-- Búsqueda exacta normalizada; deliberadamente NO UNIQUE (permite homónimos).
create index jugadores_nombre_idx on public.jugadores(lower(nombre_completo));

alter table public.localidades enable row level security;
alter table public.asociaciones enable row level security;
alter table public.clubes enable row level security;
alter table public.jugadores enable row level security;

create policy localidades_lectura_autenticada on public.localidades
  for select to authenticated using (true);
create policy localidades_crear_admin on public.localidades
  for insert to authenticated with check ((select public.es_administrador()));
create policy localidades_editar_admin on public.localidades
  for update to authenticated
  using ((select public.es_administrador())) with check ((select public.es_administrador()));

create policy asociaciones_lectura_autenticada on public.asociaciones
  for select to authenticated using (true);
create policy asociaciones_crear_admin on public.asociaciones
  for insert to authenticated with check ((select public.es_administrador()));
create policy asociaciones_editar_admin on public.asociaciones
  for update to authenticated
  using ((select public.es_administrador())) with check ((select public.es_administrador()));

create policy clubes_lectura_autenticada on public.clubes
  for select to authenticated using (true);
create policy clubes_crear_admin on public.clubes
  for insert to authenticated with check ((select public.es_administrador()));
create policy clubes_editar_admin on public.clubes
  for update to authenticated
  using ((select public.es_administrador())) with check ((select public.es_administrador()));

-- El árbitro no recibe acceso global a nacimientos ni perfiles ajenos.
-- Las futuras vistas deportivas deberán publicar solo columnas autorizadas.
create policy jugadores_lectura_autorizada on public.jugadores
  for select to authenticated using (
    perfil_id = (select auth.uid())
    or (select public.es_administrador())
    or (select public.es_juez_general())
  );
create policy jugadores_crear_admin on public.jugadores
  for insert to authenticated with check ((select public.es_administrador()));
create policy jugadores_editar_admin on public.jugadores
  for update to authenticated
  using ((select public.es_administrador())) with check ((select public.es_administrador()));

-- Revocar los privilegios automáticos que pudiera heredar cada tabla en Supabase.
-- Sin DELETE ni políticas de borrado: usar activo=false y conservar identidad.
revoke all on table public.localidades, public.asociaciones, public.clubes, public.jugadores
  from public, anon, authenticated;
grant select on table public.localidades, public.asociaciones, public.clubes, public.jugadores
  to authenticated;
-- Privilegios por columna: los clientes no pueden alterar IDs ni creado_en.
grant insert (nombre, region, pais, activo), update (nombre, region, pais, activo)
  on public.localidades to authenticated;
grant insert (nombre, localidad_id, activo), update (nombre, localidad_id, activo)
  on public.asociaciones to authenticated;
grant insert (nombre, localidad_id, asociacion_id, activo),
  update (nombre, localidad_id, asociacion_id, activo) on public.clubes to authenticated;
grant insert (perfil_id, nombre_completo, fecha_nacimiento, localidad_procedencia_id, club_id, activo),
  update (perfil_id, nombre_completo, fecha_nacimiento, localidad_procedencia_id, club_id, activo)
  on public.jugadores to authenticated;

revoke all on sequence public.localidades_id_seq, public.asociaciones_id_seq,
  public.clubes_id_seq, public.jugadores_id_seq from public, anon, authenticated;
grant usage on sequence public.localidades_id_seq, public.asociaciones_id_seq,
  public.clubes_id_seq, public.jugadores_id_seq to authenticated;

commit;
