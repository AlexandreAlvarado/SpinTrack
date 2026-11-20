# Mesas y programación supervisada — 027

## Alcance y fuentes existentes

Ya existían los partidos de grupos y sus lotes confirmados, los encuentros de eliminatorias con sus fuentes y participantes resueltos, las asignaciones e historial de árbitros, la habilitación de arbitraje por cuenta, las capturas por revisión y sus confirmaciones. No existían reservas de mesas ni programación de intervalos de partidos. El texto del módulo de partidos indicaba que mesas y horarios seguían pendientes.

Se conservan esas fuentes. La preparación aprobada puede seguir en estado `preparada`: no se exige una transición global nueva para utilizar partidos que el flujo actual ya habilita. No se calculan clasificados, sets, ganadores ni avances en este módulo.

## Implementación

- Ruta del Juez General: `/panel/juez-general/programacion`, accesible desde «Mesas y programación» y con contexto de jornada.
- Mesas numeradas por jornada, habilitadas o fuera de servicio. «Ocupada» se deriva de las reservas y del uso efectivo; no se guarda un indicador independiente que pueda quedar desactualizado.
- Propuesta editable de una tanda para todas las competencias de la jornada. El juez selecciona los árbitros disponibles y define inicio, minutos estimados y descanso. No hay duración oficial predeterminada.
- Confirmación expresa de la tanda, en una única transacción; edición manual de mesa/árbitro, reprogramación, cancelación de reservas no iniciadas e historial de los últimos 30 cambios.
- Marcar «En juego» ocupa recursos. Las operaciones de árbitro y confirmación existentes también sincronizan automáticamente las reservas.
- Formularios y tarjetas adaptables a móvil. Se reutilizan las clases visuales existentes; el único cambio de navegación es un enlace en el panel del juez.
- Las horas civiles usan las utilidades existentes de `America/Santiago`. Solo una hora repetida por cambio estacional exige elegir ocurrencia. Se transmiten y guardan instantes con zona horaria.

## Algoritmo

1. El servidor obtiene una fotografía nueva de todas las competencias, partidos, mesas, árbitros y reservas de la jornada mediante una RPC privada. La lista no queda limitada a una categoría ni a 1000 filas de PostgREST.
2. Ordena los candidatos por inicio configurado de competencia y luego por identificador/tipo, con resultado determinista. Descarta duplicados, partidos ya reservados, resultados pendientes de revisión y encuentros sin elegibilidad o participantes definitivos.
3. Revisa los jugadores por identidad deportiva y las cuentas vinculadas. Una persona ocupada como jugador también queda excluida del arbitraje y viceversa.
4. Escoge una mesa habilitada sin solapamiento y un árbitro seleccionado disponible, conservando al ya asignado si es compatible. Incorpora cada asignación a los recursos de la propuesta antes de evaluar el siguiente encuentro.
5. Devuelve propuesta y advertencias. No escribe datos hasta la confirmación explícita del juez. La propuesta es una tanda viable, no una optimización de toda la jornada ni una predicción de duración real.

Los intervalos estimados son `[inicio, fin)`. El descanso es configurable; también se respeta el descanso guardado en una reserva anterior, aun después de confirmarse su resultado y liberarse la mesa. La referencia temporal para ese descanso es la liberación real registrada, sin inferir un final deportivo a partir del reloj estimado.

## Integridad, concurrencia y permisos

La migración agrega `mesas_jornada`, `programacion_reservas`, `programacion_historial`, una vista privada de los partidos existentes y una fila técnica de serialización en `programacion_guardia_027`. Esta última no almacena información deportiva.

Las RPC exigen Juez General en PostgreSQL y las Server Actions también verifican ese rol. Las tablas tienen RLS; los clientes autenticados no reciben permisos directos de escritura. Las funciones internas no tienen permisos de ejecución públicos. Los árbitros conservan sus RPC y permisos existentes.

La confirmación completa es atómica. Los triggers revisan de nuevo participantes, dependencias, habilitación y asignación del árbitro, mesa, personas e intervalos. Los índices únicos impiden reservas activas duplicadas del mismo encuentro. Un UPDATE de la fila técnica serializa escrituras de recursos compartidos y rechaza fotografías antiguas también bajo `REPEATABLE READ`/`SERIALIZABLE`. No se mantiene un bloqueo durante la disputa del encuentro.

La reprogramación y liberación exigen id y versión de reserva. Las operaciones deportivas existentes, las reasignaciones de árbitro y los cambios de vínculo jugador/cuenta participan en las validaciones. Los encuentros heredados en juego/revisión sin mesa siguen reteniendo a sus personas.

## Ciclo de vida y retrasos

`Partido existente elegible → reserva asignada → en juego → captura enviada/revisión → confirmación deportiva existente → mesa liberada`.

- Enviar u observar un resultado no libera la mesa. Una incidencia sin resolución tampoco la libera.
- Se consulta la última captura: una confirmación antigua no oculta una corrección más reciente. Una corrección reabre la revisión y debe volver a validar los recursos.
- Un encuentro en juego/revisión no pierde su mesa al vencer el fin estimado.
- Una reserva posterior ya planificada puede mantenerse mientras se juega el encuentro anterior. No podrá comenzar hasta que se liberen realmente los recursos. La vista advierte el bloqueo; los retrasos requieren supervisión y eventual reprogramación.
- Iniciar o enviar el resultado del encuentro anterior no falla solo por existir una reserva futura compatible con su intervalo estimado.
- Solo una reserva no iniciada y con partido todavía elegible puede cancelarse o reprogramarse desde esta vista. No se cancela un acta ni se modifica un resultado para liberar una mesa.

## Archivos del módulo

- [Algoritmo y tipos](../src/lib/programacion.ts).
- [Server Actions](../src/app/panel/juez-general/programacion/actions.ts) y [página](../src/app/panel/juez-general/programacion/page.tsx).
- [Interfaz](../src/components/scheduling.tsx) y enlace en [navegación del juez](../src/components/judge-navigation.tsx).
- [Migración incremental](../supabase/migrations/027_mesas_programacion.sql).
- [Pruebas del algoritmo](../tests/programacion.test.mjs), [servidor](../tests/programacion-actions.test.mjs) e [interfaz](../tests/programacion-ui.test.mjs).
- [PostgreSQL operativo](../supabase/tests/027_programacion.test.mjs) y [regresión histórica](../supabase/tests/027_regresion_historica.test.mjs).

## Validación y habilitación

Comandos locales:

```text
npm run typecheck
npm run lint
node --test tests/*.test.mjs
node supabase/tests/027_programacion.test.mjs
node supabase/tests/027_regresion_historica.test.mjs
```

Los runners PostgreSQL crean clústeres temporales con puertos locales propios y fixtures sintéticas; no leen credenciales ni se conectan a Supabase. Cubren mesas/personas/árbitros compartidos, categorías simultáneas, autoarbitraje, tandas atómicas, reservas futuras, reprogramación/versiones, liberación, revisión/correcciones, dependencias sin resolver y carreras concurrentes, incluido aislamiento repetible. La regresión histórica instala 027 después de finalizar torneos y compara íntegramente partidos, actas, confirmaciones, campeones y ranking 026 antes/después.

Resultado final local: **535/535 pruebas Node**, TypeScript aprobado, ambos runners PostgreSQL aprobados. ESLint: **0 errores y 4 advertencias preexistentes** ajenas al módulo. La interfaz se comprobó con renderizado de fixtures y lectura del navegador a ancho móvil, sin desbordamiento horizontal. No se ejecutó una confirmación en la aplicación contra Supabase remoto.

**Habilitación remota pendiente:** se necesita revisar y aplicar manualmente 027 sobre sus dependencias existentes. La vista informa la migración pendiente si la RPC no está instalada. No se ejecutó SQL remoto, no se cambiaron datos deportivos de Supabase y no se modificaron migraciones 001–026.
