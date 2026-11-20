# Nómina de participantes: alcance mínimo de tesis

SpinTrack administra una nómina deportiva; la Liga mantiene sus medios habituales de inscripción. Este flujo no exige pagos, tarifas, comprobantes ni solicitudes autónomas. No se eliminan módulos heredados ni se incorporan funcionalidades financieras.

## Cobertura existente

| Requisito | Implementación existente |
| --- | --- |
| Seleccionar jugadores registrados | Juez General en `/panel/juez-general/participantes`, con búsqueda y selección. El Administrador mantiene la identidad de los jugadores. |
| Competencia y categoría válidas | La categoría proviene de la competencia. PostgreSQL exige competencia activa y publicada, jornada publicada, preparación aprobada y reglamento validado. |
| Evitar duplicados | Restricción única jugador/competencia y rechazo de identificadores repetidos en la RPC. |
| Requisitos deportivos aprobados | Jugador activo, categoría y nivel activos, habilitación documentada y validada para esa categoría, criterio de nacimiento configurado; excepción documentada cuando corresponda. No se añaden reglas deportivas. |
| Revisar y confirmar antes de grupos | Confirmación explícita de nómina con trazabilidad. El organizador usa solamente participantes confirmados y revalida la distribución completa. |
| Integridad posterior | Al confirmar grupos se bloquean altas, retiros y cambios de nómina, antes de generar partidos y resultados. Los bloqueos transaccionales serializan cambios concurrentes. |

El sistema no tiene un estado independiente «nómina cerrada». La confirmación permite preparar grupos; el cierre definitivo ocurre al confirmar los grupos. Antes de ese cierre se permiten correcciones supervisadas y retiros con motivo. Un borrador que haya quedado obsoleto por cambiar la nómina no puede confirmarse. Este mecanismo cubre el alcance mínimo sin introducir otro ciclo de estados.

## Correcciones imprescindibles

- [Formulario existente](../src/components/participant-roster-form.tsx): envía toda la selección mediante campos ocultos, incluidos jugadores ocultos por la búsqueda y casillas confirmadas deshabilitadas. Las casillas visibles dejan de duplicar los campos enviados. La presentación no cambia.
- [Acción existente](../src/app/panel/juez-general/participantes/actions.ts): rechaza la solicitud completa si contiene identificadores inválidos o repetidos, sin descartar silenciosamente participantes. Mantiene autorización, RPC, validaciones deportivas y retiros con motivo existentes.

No se requieren migraciones nuevas ni cambios en roles, RLS o reglas de avance. Las migraciones aplicadas permanecen intactas. No se realizan operaciones sobre datos remotos.

## Validación reproducible

- [Pruebas nuevas](../tests/participantes-integridad.test.mjs): autorización, solicitud inválida mixta, duplicados, RPC existente sin datos financieros, retiro total motivado, rechazo deportivo y conservación de selección al buscar/corregir.
- [PostgreSQL temporal existente](../supabase/tests/009_participantes_competencia.test.mjs): duplicados, jugadores inválidos, habilitaciones, correcciones auditadas, retiro total, grupos, permisos, bloqueo posterior y carreras nómina/grupos.
- Suite Node completa, TypeScript y ESLint.

Resultado local del 19-11-2026: **555/555 pruebas Node**, incluidas seis nuevas; TypeScript aprobado; ESLint sin errores y con cuatro advertencias preexistentes; PostgreSQL temporal aprobado, incluidas concurrencia y revalidación de borradores. No se ejecutaron escrituras en Supabase.

La prueba visual manual pendiente consiste en seleccionar jugadores, filtrar por nombre, añadir otro jugador y confirmar que se conserva toda la nómina. Debe hacerse con una competencia autorizada de prueba, sin usar competencias históricas. La cobertura automática del formulario usa renderizado y estados simulados, no una sesión completa de navegador.
