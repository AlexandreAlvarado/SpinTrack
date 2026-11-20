# Corrección del archivo original de la migración 028

## Estado

Se corrigió directamente [028_jornadas_y_aceptacion_legal.sql](../supabase/migrations/028_jornadas_y_aceptacion_legal.sql), por solicitud expresa del desarrollador. Lista para revisión manual sobre el esquema 001–027. No se aplicó en Supabase remoto, no se modificaron datos reales y no se ejecutaron 029–031. Las huellas SHA-256 de 001–027 se comprobaron antes y después y coinciden.

Esta tarea corrige el SQL original; no activa el frontend ni cambia el contenido de los documentos legales. Si 028 ya estuviera instalada en un entorno, no debe reaplicarse este archivo como una migración nueva: contiene CREATE y ALTER de instalación inicial. En ese caso debe prepararse una corrección incremental específica después de contrastar las definiciones instaladas.

## Problemas encontrados y cambios

1. **Bloqueos excesivos.** La operación bloqueaba todas las tablas del esquema público. Ahora bloquea filas de la jornada, sus competencias y las configuraciones eliminables. El único bloqueo de tabla es SHARE sobre `ranking_configuraciones_026`, porque sus referencias son arrays sin FK. El orden es fechas y luego ranking, coherente con la RPC de 026. Se comprobó que una escritura de catálogo independiente puede completar mientras se mantienen los bloqueos administrativos.
2. **Ranking sin FK.** La fotografía transitiva no detectaba `fecha_ids` de 026. Ahora los incluye expresamente. Una jornada vacía que integra el ranking queda protegida contra borrado y despublicación; puede archivarse conservando su estado.
3. **Retención innecesaria de datos.** Se copiaban filas completas, con motivos, actas y posibles datos personales, tanto en revisiones como en el historial permanente. Ahora la revisión conserva huellas SHA-256, estados necesarios y metadatos mínimos; las filas completas son temporales y se descartan antes de devolver el resultado. El historial permanente contiene únicamente identificador, número, fecha, estado/archivo y recuentos de dependencias. Se conserva el UUID del actor y la fecha de operación, necesarios para trazabilidad. Las revisiones vencidas se purgan al solicitar una revisión nueva; no se presupone un proceso periódico externo.
4. **Preparación ya entregada.** La clasificación de protección ahora refleja 022: una configuración aprobada o un estado deportivo distinto de pendiente no se ofrece como eliminable. Los resultados, campeones, actas, grupos, participantes, reservas, historiales y cualquier dependencia fuera de la lista cerrada siguen protegidos.
5. **Edición de jornadas.** Se conservan INSERT y edición de temporada, número, fecha, comuna, recinto y estado, bajo RLS administrativo. Un trigger impide eludir las comprobaciones de despublicación con UPDATE directo. No impide el avance legítimo a finalizada y conserva los controles anteriores, incluido el cierre de inscripciones cuando corresponde. ID, creado_en y archivada no se exponen como campos editables. El borrado requiere la RPC y sus dos pasos.
6. **Aceptación legal.** Se conserva exactamente `2026-11-19.1`. La ausencia de configuración se rechaza explícitamente. El registro exige un booleano JSON real y la versión vigente; el trigger posterior vuelve a contrastar la versión y registra la del servidor. Las fechas proceden de PostgreSQL, no de metadatos. Los triggers solo actúan en INSERT de Auth: una actualización usada para confirmar correo o mantener una cuenta no vuelve a exigir aceptación ni la fabrica. No se altera el trigger de creación de perfiles de 001 ni se confían roles recibidos del cliente.
7. **Formato y sintaxis.** Se normalizó SQL legible en UTF-8 sin BOM, comentarios y delimitadores. No se reprodujo un error de sintaxis independiente en la copia inicial recibida: los defectos reproducibles fueron de autorización, cobertura de dependencias, concurrencia y retención. La sintaxis final se comprobó ejecutando el archivo completo en PostgreSQL, no solo con inspección textual.

## Seguridad conservada

Administración sigue siendo la única autorizada a revisar y gestionar jornadas. Para eliminar se requiere un token emitido por la primera revisión, propio, vigente, de un solo uso, coincidencia con la fotografía actual y la frase exacta `ELIMINAR JORNADA N`. Se reevalúa el vencimiento después de esperar bloqueos. No hay un DELETE CASCADE nuevo ni se borran jugadores, cuentas o evidencias deportivas.

Archivar solo cambia `archivada`; conserva estado, resultados y consulta histórica. Despublicar requiere ausencia de dependencias protegidas y de inscripciones habilitadas. La edición administrativa directa del estado aplica esas mismas barreras, sin exigir una segunda confirmación para un cambio de estado que ya estaba permitido; la doble confirmación se mantiene para eliminación.

Las aceptaciones se vinculan a `auth.uid()`, versión y fecha del servidor. La repetición es idempotente y no renueva la fecha. Las tablas legales y de auditoría conservan RLS y deniegan escrituras directas desde clientes. La aceptación no concede roles ni sustituye autorizaciones independientes de menores.

## Pruebas

- [PostgreSQL aislado 028](../supabase/tests/028_jornadas_legal.test.mjs): aprobado en PostgreSQL 18 temporal, loopback y fixtures sintéticos. Instala únicamente el esquema previo hasta 027 y luego 028. Incluye la regresión deportiva 023, con final y avance de eliminatorias reales del fixture.
- Casos ampliados: registro válido/inválido, booleano incorrecto, fecha manipulada, UPDATE de Auth, configuración ausente, aceptación propia e idempotente, RLS, permisos administrativos, borrado directo rechazado, token vencido/usado, frase incorrecta, jornada modificada concurrentemente, historial insertado concurrentemente, ranking por array, archivo, despublicación, finalización y minimización del historial.
- Se comprobó conservación exacta de los partidos y resultados del fixture tras instalar y probar 028.
- `node --test tests/*.test.mjs`: **597/597** aprobadas. No ejecuta las migraciones PostgreSQL 029–031.
- `npm run typecheck`: aprobado.
- `npm run lint`: cero errores, cuatro advertencias preexistentes fuera del alcance.

## Límites y revisión antes de ejecutar

No se detectaron bloqueantes en el esquema aislado 001–027. Antes de una aplicación manual real se debe confirmar que 028 no está instalada y que las definiciones de destino corresponden al esquema probado; conservar el procedimiento de respaldo del entorno. Una diferencia de esquema o una 028 ya instalada requiere revisión incremental, no forzar la reaplicación.

No se probaron correos reales ni se ejecutaron registros o aceptaciones de personas reales. Las banderas y la correspondencia del contenido legal del frontend pertenecen a la tarea de activación, que sigue separada de esta corrección SQL.
