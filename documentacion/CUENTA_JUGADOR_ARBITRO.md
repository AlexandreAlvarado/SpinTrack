# Cuenta única Jugador y Árbitro

## Arquitectura incremental 023

Se mantienen `perfiles.rol`, `jugadores` y su vínculo opcional `perfil_id`. La identidad deportiva conserva su ID, inscripciones e historial. La nueva columna `perfiles.arbitraje_habilitado` concede arbitraje independientemente del rol principal. No crea cuentas, cambia correos, modifica `auth.users` ni concede cargos de Juez General o Administrador.

La migración [023_habilitacion_arbitraje_cuenta.sql](../supabase/migrations/023_habilitacion_arbitraje_cuenta.sql) habilita inicialmente los perfiles cuyo rol anterior es Árbitro. Después, una revocación prevalece sobre ese rol: no se utiliza una condición alternativa `rol = arbitro` que la anule. Las cuentas Jugador siguen sin arbitraje hasta habilitación administrativa explícita. No cambian las asignaciones anteriores.

El Administrador accede a «Arbitraje por cuenta», un listado paginado con nombre, UUID y estado para distinguir homónimos. La [acción](../src/app/panel/administrador/arbitraje/actions.ts) llama a `habilitar_arbitraje_023`, que comprueba Administrador y compara el estado esperado para evitar sobrescrituras concurrentes. El trigger registra actor, instante y nuevo estado en `arbitraje_habilitaciones_historial`, incluso cuando un Administrador actualiza directamente la columna. El historial solo admite lectura administrativa desde clientes y no permite cambios/borrados. No hay autoasignación desde registro, metadatos ni actualización propia del perfil.

## Una sesión y permisos en servidor

La identidad de servidor consulta la habilitación actual en PostgreSQL. Las rutas arbitrales y las acciones de captura requieren habilitación; las RPC comprueban también la asignación y los participantes actuales. Las políticas de lectura operativa de grupos y eliminatorias reconocen esa habilitación. Solo Juez General confirma resultados oficiales.

Los enlaces «Mi panel de Jugador» y «Mis arbitrajes» navegan sin modificar roles ni cerrar sesión. Se conserva el diseño actual. Una cuenta con rol Árbitro puede consultar su ficha vinculada desde el panel deportivo; si no existe ficha se muestra la solicitud de vinculación administrativa existente. Esto no crea una identidad deportiva automáticamente. Una cuenta revocada no accede a arbitraje por URL ni envía nuevas capturas, aunque conserve sus asignaciones y actas históricas.

## Autoarbitraje, reasignación y concurrencia

La autorización de grupos y el comienzo/envío eliminatorio comparan el vínculo actual `jugadores.perfil_id` con los dos participantes actuales. La asignación y preparación de finales usan la misma habilitación independiente. La propagación de ganadores conserva su funcionamiento: no se bloquea el avance por un árbitro incompatible, pero este no puede actuar en el encuentro de destino. Debe reasignarlo el Juez.

La reasignación conserva actas y eventos. En eliminatorias solo se puede sustituir un árbitro revocado o convertido en participante: antes de capturas (pendiente/en desarrollo) o después de observar la captura pendiente. Una revisión enviada debe observarse antes de reemplazar al asignado. Las asignaciones de árbitros aptos conservan la protección de 020 contra sustituciones normales. En grupos se conserva el bloqueo de asignación tras iniciar historial salvo si el asignado perdió autorización o se convirtió en participante.

Habilitaciones, revocaciones, cambios de vínculo y RPC arbitrales comparten un advisory lock transaccional conservador. Se mantienen los bloqueos anteriores de cuadro/partido y los conflictos de asignaciones operativas eliminatorias de 020. Este diseño serializa brevemente estas operaciones; no inventa intervalos, duraciones ni un planificador horario. Un conflicto transaccional se rechaza y requiere recargar.

La selección visual se evalúa por encuentro; no descarta a todas las personas inscritas en una competencia o jornada. PostgreSQL decide finalmente la elegibilidad, incluyendo finales y participantes resueltos después de asignar.

## Cuentas duplicadas: procedimiento supervisado

1. Verificar titularidad de ambas cuentas mediante canales autenticados y documentar consentimiento, responsable, UUID origen/destino y respaldo.
2. Inventariar ficha, inscripciones, resultados, asignaciones pendientes e historial de ambas identidades. Elegir la cuenta de acceso que se conservará.
3. Habilitar esa cuenta mediante la RPC administrativa y vincular la ficha existente solo tras comprobar unicidad y conflictos. Si ambas cuentas poseen fichas/historial distintos, detener y resolver individualmente: nunca borrar o fusionar fichas por coincidencia de nombres/correos.
4. Revisar y reasignar encuentros pendientes con el Juez. Conservar actores y UUID históricos. No trasladar autorías ni reescribir auditorías.
5. Mantener la cuenta secundaria mientras exista historia referenciada. Cualquier eventual cierre de acceso requiere un procedimiento separado de Auth con titularidad verificada. 023 no fusiona cuentas ni ejecuta ese cierre.

## Aplicación manual y pruebas

La documentación local indica que [022](../supabase/migrations/022_separar_preparacion_administrador.sql) está preparada y pendiente de aplicación manual; no se consultó el estado remoto. 023 comprueba su función `autorizar_preparacion_022()`. Revisar y respaldar el esquema real, aplicar manualmente las dependencias faltantes en orden y después 023. No reaplicar migraciones ya instaladas. Desplegar el código que consulta la columna después de instalar 023: antes de ello la consulta de identidad falla cerrada.

El [runner PostgreSQL 023](../supabase/tests/023_habilitacion_arbitraje.test.mjs) utiliza PostgreSQL 18 temporal en loopback y fixtures sintéticos con las migraciones reales (004 histórica de prueba; 007 reservada). Comprueba cuentas Jugador/Árbitro/doble función, autohabilitación rechazada, RLS/RPC, revocación, grupos, sets, revisión, clasificación real, final 019/020, conflicto tras cambiar el vínculo, reasignación y concurrencia. No lee credenciales ni conecta a Supabase. El directorio temporal se comprueba antes de eliminarlo y el clúster se detiene al finalizar.

Las pruebas Node comprueban guard de URL, metadatos manipulados, navegación sin formularios de cambio de rol/cierre de sesión y capturas con doble función. La comprobación visual autenticada en una instalación con 023 queda para después de su aplicación manual; no utilizar producción para ensayos ficticios.

## Resultado de verificación local (2026-11-17)

- PostgreSQL 18 temporal 023: aprobado con migraciones reales disponibles, incluido 008 (su BOM se retira solo al leer el archivo en el runner; la migración original no cambia), 022 y 023. Verifica conservación exacta de asignaciones e historial creados antes de aplicar 023, dos competencias de la misma jornada, semifinales, avance real a una final preasignada y reasignación. La carrera entre asignación válida y autoarbitraje deja únicamente la asignación válida.
- Node: 165 pruebas relacionadas aprobadas (158 del conjunto focalizado y siete de la acción administrativa). Tras el último ajuste de navegación se repitieron sus 31 pruebas, todas aprobadas.
- Suite Node completa: 467/467 aprobadas. Los fixtures de preparación rápida reflejan la regla vigente de final al mejor de cinco y su referencia obligatoria.
- TypeScript, diagnósticos del editor y ESLint de src, pruebas modificadas y runner 023: sin errores ni advertencias.
- ESLint global ejecutado: 17 errores y dos advertencias en scripts históricos (runner 005, advertencias 009/018 y scripts anteriores de test-results). No se alteran esos scripts.
- Sin migraciones remotas, escrituras de producción, cuentas nuevas ni modificaciones de auth.users. No se editaron migraciones 001–022. La verificación visual autenticada y móvil requiere una instalación local con 023 aplicada; la página compartida no se usó para alterar el esquema ni datos reales.

| Caso solicitado | Evidencia local |
| --- | --- |
| 1–3. Solo Jugador, solo Árbitro, ambas funciones | PostgreSQL: habilitación inicial, compatibilidad del Árbitro anterior y doble función sin cambiar rol. Node: guard de autorización. |
| 4. Administrador habilita | RPC real y prueba de Server Action, con estado esperado e historial. |
| 5. Jugador intenta autohabilitarse | RPC rechazada; UPDATE propio mediante RLS no cambia permisos; metadatos ignorados. |
| 6. Cambiar panel sin cerrar sesión | Node: mismo perfil abre ambos guards; render de enlaces sin formularios de cambio de rol/cierre de sesión. Verificación visual autenticada pendiente. |
| 7. Otra competencia | La cuenta vinculada a jugador de 4004 arbitra los doce partidos de grupos de 4005. |
| 8. Partido propio | Asignación de grupos/final rechazada; actuación eliminatoria bloqueada tras cambiar vínculo y tras propagación real de semifinal a final. |
| 9. Revocación | Captura/comienzo rechazados y lecturas operativas RLS retiradas, conservando actas y asignaciones. |
| 10. Final | Propuesta/confirmación 019 y preparación/asignación 020 reales; final multigrupo tras semifinales. |
| 11. Sets y revisión | Envío, observación, corrección y confirmación del Juez; el Jugador habilitado no confirma. |
| 12. Compatibilidad | Comparación JSON exacta de asignaciones/historial anterior a 023 y habilitación del Árbitro anterior. |
| 13. RLS/RPC | Autohabilitación, manipulación del historial, captura, lectura operativa, confirmación y acceso directo a rutas. |
| 14. Concurrencia | Dos habilitaciones sobre la misma revisión, asignaciones válida/inválida simultáneas y confirmación de final idempotente. |
