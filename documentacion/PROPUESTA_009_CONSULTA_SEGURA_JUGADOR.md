# Propuesta archivada: consulta segura del Jugador

La migración anterior `009_consulta_segura_jugador.sql` no se aplicó en Supabase, según el estado documentado y la revisión realizada antes de este cambio. Su contenido queda archivado conceptualmente aquí porque la primera versión ya no usará solicitudes individuales.

La propuesta original contemplaba una RPC `SECURITY DEFINER` identificada por `auth.uid()`, competencias publicadas, disponibilidad deportiva y la RPC `solicitar_inscripcion` de 004. Se conserva como referencia para una futura versión; no debe ejecutarse ni recrearse como migración 009.

La implementación vigente es `009_participantes_competencia.sql`, que separa catálogo de jugadores y nómina oficial confirmada por competencia.
