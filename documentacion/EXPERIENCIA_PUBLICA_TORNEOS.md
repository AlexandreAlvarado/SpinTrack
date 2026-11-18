# Experiencia pública de torneos — 025

## Pantallas implementadas

- Inicio: temporada del año vigente cuando tiene jornadas publicables, próximas jornadas, jornada más reciente, acceso a categorías y últimos campeones.
- Calendario: selección de temporada, fecha, recinto, comuna, estado y categorías publicadas.
- Jornada: categorías disponibles con estado, inicio programado y acceso a resultados.
- Competencia: participantes de grupos confirmados, enfrentamientos de lotes confirmados, resultados oficiales, clasificación aprobada vigente, dos clasificados por grupo, eliminatorias, campeón y subcampeón.
- Llave: todas las rondas confirmadas, participantes pendientes, ganadores destacados y final única. No calcula nuevos cruces ni crea tercer lugar. Usa el avance deportivo existente. El detalle refresca la lectura cada 30 segundos mientras la página está visible.

Se reutilizan las tablas deportivas, las confirmaciones existentes, DateList, estilos e identidad visual. No hay otro motor de clasificación, resultados o eliminatorias. Los componentes administrativos conservan sus acciones y permisos.

## Frontera de publicación

La [migración 025](../supabase/migrations/025_lectura_torneos_publicos.sql) agrega únicamente un RPC de lectura. **No se ha aplicado en Supabase.** No modifica migraciones anteriores, tablas, políticas existentes ni datos.

El RPC `consultar_torneos_publicos_025` tiene `SECURITY DEFINER` y `search_path=''`, referencias de esquema explícitas, sin SQL dinámico ni escrituras. Se revoca EXECUTE de PUBLIC y se otorga exclusivamente a anon y authenticated. El resultado usa campos explícitos; no se entregan filas privadas completas al visitante. La proyección filtra igual para anónimos, jugadores y operadores.

- Jornada: `publicada` o `finalizada`. Las finalizadas permanecen consultables.
- Competencia: `publicada`, `activo` y configuración deportiva aprobada, bajo una jornada publicable.
- Grupos: exclusivamente confirmados; partidos de lotes confirmados.
- Resultados grupales: reutiliza `resultados_confirmados_grupos`, que requiere el evento oficial de confirmación. Una nueva revisión pendiente no publica su marcador; puede seguir visible la última versión oficialmente confirmada.
- Clasificación: última aprobación, con mismo conjunto de integrantes, estado, resultados y revisiones que su snapshot. Una corrección pendiente oculta la clasificación obsoleta. Solo se proyectan nombre y estadísticas deportivas; no se publica el snapshot.
- Eliminatorias: llave confirmada. Marcadores y sets del acta se incorporan únicamente cuando el partido está confirmado y coincide la revisión.
- Podio: cuadro finalizado y final confirmada con ganador y perdedor coincidentes. No se calcula campeón desde una clasificación grupal.

No se amplía SELECT de las tablas privadas. No se exponen cuentas, correos, perfiles, árbitros asignados, actores, referencias documentales, auditorías ni resultados sin confirmar. Las consultas web usan la clave pública y el cliente normal de sesión; nunca service_role.

## Verificación realizada

- `npm run typecheck`: correcto.
- `npx eslint src tests/public-pages.test.mjs tests/public-tournaments.test.mjs supabase/tests/025_lectura_publica.test.mjs`: correcto.
- `node --test tests/public-pages.test.mjs tests/public-tournaments.test.mjs`: 16/16.
- `node --test tests/*.test.mjs`: 473/475. Los dos fallos están en navegación del Juez: secuencia esperada «Preparación deportiva» y aria-current de esa ruta. El componente de navegación ya tenía modificaciones al comenzar esta tarea y no fue modificado por este trabajo.
- `npm run lint`: 17 errores y 3 advertencias en scripts anteriores de Supabase y archivos temporales; los archivos de esta entrega pasan la comprobación enfocada.
- `node supabase/tests/025_lectura_publica.test.mjs`: correcto en un clúster PostgreSQL 18 temporal local. Reutiliza sin modificar el escenario deportivo 023, instala 001–025 y añade puntos de comprobación de lectura pública. No lee credenciales ni conecta a Supabase.
- PostgreSQL: visitante anon y operador authenticated, competencia oculta, jornada borrador, jornada finalizada, competencia sin grupos, grupos sin resultados, acta pendiente oculta, clasificación aprobada y obsoleta, final única, podio confirmado, semifinales de múltiples grupos y avance automático. Comprueba denegación de acceso directo a perfiles, actas y aprobaciones.
- Navegador: calendario real sin sesión en contexto móvil de 390 × 844, sin desbordamiento horizontal. El servidor muestra el estado de lectura no disponible porque 025 aún no está instalada. Vista de competencia con clasificación, final y podio revisada con HTML renderizado de fixtures locales y CSS real; no se insertaron fixtures en Supabase. Las tablas conservan desplazamiento horizontal dentro de su contenedor.

## Pendiente para habilitar con datos reales

1. Revisar y aplicar manualmente 025 sobre un entorno con las migraciones deportivas anteriores. Coordinar con los pendientes de 022–024; no saltar dependencias del esquema.
2. Repetir el recorrido completo en Supabase real sin sesión, después de aplicar la migración. Hasta entonces, las nuevas lecturas muestran un aviso de indisponibilidad, no datos ficticios ni un error técnico.
3. Resolver por separado los dos fallos previos de navegación del Juez y el lint de scripts heredados.

El esquema actual no tiene un indicador administrativo de «temporada activa». El inicio usa la temporada real del año civil de America/Santiago solo si tiene jornadas publicables; si no existe, dice «Temporada por confirmar». No se agregó un estado inventado ni una configuración paralela. Si la Liga necesita activar una temporada distinta del año vigente, falta definir esa configuración explícita.

## Archivos de esta entrega

- [Inicio](../src/app/page.tsx), [calendario](../src/app/calendario/page.tsx), [jornada](../src/app/calendario/[id]/page.tsx) y [competencia](../src/app/competencias/[id]/page.tsx).
- [Tarjetas de jornadas](../src/components/date-list.tsx), [presentación deportiva pública](../src/components/public-tournament.tsx), [actualización automática](../src/components/public-live-refresh.tsx) y [lectura pública](../src/lib/public-tournaments.ts).
- [Migración](../supabase/migrations/025_lectura_torneos_publicos.sql), [pruebas PostgreSQL](../supabase/tests/025_lectura_publica.test.mjs), [pruebas públicas existentes](../tests/public-pages.test.mjs) y [pruebas públicas nuevas](../tests/public-tournaments.test.mjs).

Los demás cambios presentes en el árbol de trabajo pertenecen a trabajo previo o concurrente y no se sobrescribieron.
