# Hallazgos pendientes: Ranking Liga Regional 6.0

## Procedencia y estado

Hallazgos reportados por el desarrollador el 18-11-2026 tras analizar el archivo «Ranking Liga Regional 6.0». Ese archivo no está entre las referencias locales disponibles y no fue inspeccionado en esta revisión. Las observaciones siguientes no son autorizaciones de Liga, ni sustituyen las Bases 2026. No se importaron sus puntuaciones.

| Hipótesis | Indicio reportado | Estado operativo |
| --- | --- | --- |
| 3.º–8.º según eliminador | Posible criterio para distinguir eliminados de la misma ronda | Pendiente de respaldo; deshabilitada |
| 15 puntos por eliminación en grupos | Puntuaciones de 15 observadas en el Excel | Pendiente de comprobar causa, alcance y respaldo; deshabilitada |
| 71 puntos por banda 33.º–64.º | En fechas de TC Federado y TC Aficionado aparecen exactamente 32 jugadores con al menos 78 puntos y otros con 71 | Correlación reportada, sin prueba de puesto o ronda; deshabilitada |

La cantidad de jugadores por puntaje no demuestra cómo se resolvieron pases, retiros, incomparecencias, sanciones o excepciones. Tampoco permite trasladar el criterio entre categorías, fechas o temporadas. Las Bases no definen expresamente 15 ni 71 puntos. Continúan vigentes exclusivamente las reglas confirmadas de [ranking 2026](./RANKING_2026.md).

## Hipótesis de posiciones

| Puesto hipotético | Resultado confirmado requerido | Puntos de la escala vigente si el puesto llegara a autorizarse |
| --- | --- | --- |
| 3.º | Perdió semifinal frente al campeón | 95 |
| 4.º | Perdió semifinal frente al subcampeón | 93 |
| 5.º | Perdió cuartos frente al campeón | 90 |
| 6.º | Perdió cuartos frente al subcampeón | 88 |
| 7.º | Perdió cuartos frente al tercero obtenido por este mismo criterio | 86 |
| 8.º | Perdió cuartos frente al cuarto obtenido por este mismo criterio | 84 |

Los números de puntos para 3.º–8.º están en las Bases; lo pendiente es la forma de adjudicar esos puestos. La hipótesis no se justifica por sí sola con las dos medallas de tercero. No modifica eliminación directa ni genera partidos adicionales.

## Preparación técnica

[Simulador puro](../src/lib/ranking-hypotheses.ts): tres opciones independientes, todas apagadas por defecto. Solo calcula propuestas cuando se solicita expresamente una simulación. Exige competencia finalizada, final inequívoca y encuentros confirmados; rechaza identidades duplicadas por ronda, derrotas repetidas y avances posteriores a la eliminación. No modifica el snapshot recibido ni hace consultas o escrituras.

- 3.º/4.º: requiere dos semifinales reales compatibles con la final. 5.º–8.º: requiere cuatro cuartos reales compatibles con los cuatro primeros. Ante pases o encuentros faltantes conserva los puestos no demostrables pendientes, sin rellenar huecos.
- 15: requiere una lista explícita de no clasificados de grupos proveniente de clasificaciones aprobadas y vigentes; no deduce eliminación de la ausencia en una llave. No admite a un jugador que aparece en la llave. No adjudica puesto individual. La futura integración deberá obtener y revalidar esa lista desde fuentes canónicas, no desde datos del navegador.
- 71: requiere un cuadro inicial completo y conectado de 64 jugadores, sin pases, con todas sus rondas confirmadas. Propone solo la banda 33.º–64.º para los 32 perdedores de esa ronda. Cuadros incompletos, pases o rondas previas de mayor tamaño siguen pendientes de interpretación oficial. No crea una escala después de 64.º.

La salida está marcada `simulacion_no_oficial` / `hipotesis_no_autorizada` y utiliza `hypotheticalPoints`, no el contrato de resultados confirmados. No se conecta al RPC público, a los totales de temporada ni al historial de resoluciones. El motor oficial continúa rechazando 15, 71 y resultados hipotéticos. La selección de una opción de simulación **no autoriza una regla**.

[Panel de pendientes](../src/components/ranking-pending-rules.tsx): Administrador y Juez ven las tres hipótesis como información de solo lectura, incluso cuando 026 no está instalada. Sin interruptores, formularios ni acciones de activación.

## Requisitos para habilitar posteriormente

Se prepara el contrato `FutureRankingAuthorization`, todavía sin persistencia ni función de habilitación. Antes de integrar una regla se requiere:

1. Contrastar el Excel original e identificar hoja, rango/celdas, fecha, categoría e identidades deportivas; adjuntar la referencia documental verificable.
2. Resolución formal que indique criterio exacto, autoridad, temporada, categorías/modalidades individuales, fechas oficiales alcanzadas, versión y tratamiento de excepciones y pases. Resolver especialmente si 15 distingue eliminación deportiva de retiro/ausencia y si 71 corresponde realmente a 33.º–64.º.
3. Registrar una autorización inmutable y versionada mediante una futura migración incremental revisada, con permisos de Administrador comprobados en servidor y PostgreSQL. Conservar autor, instante, referencia y vínculo con la versión anterior; nunca aceptar un booleano del cliente como respaldo.
4. Definir expresamente la aplicación histórica. Una autorización nueva no se aplicará a fechas previas por omisión. Las fechas afectadas deben estar enumeradas dentro del padrón oficial de siete; la jornada 8 sigue excluida.
5. Recalcular una proyección de ranking usando resultados canónicos confirmados y registrar qué versión la produjo. Conservar partidos, actas, resultados y resoluciones anteriores. Ante conflicto con una resolución deportiva existente, dejarlo pendiente de revisión del Juez; no sobrescribirla silenciosamente.
6. Extender y verificar PostgreSQL, RPC y validador oficial conjuntamente, antes de publicar puntos nuevos. Revisar los cambios de mejores seis, total siete, victorias y desempates. Una versión nueva no cambia por sí sola resultados históricos.

No se modificó ninguna migración, eliminatoria, resultado ni total oficial en esta preparación. No se ejecutó SQL en Supabase. La activación productiva y su mecanismo persistente quedan deliberadamente pendientes de la autorización y del alcance exacto; no existe una autorización inventada lista para usar.

## Archivos de esta continuación

- Nuevos: [motor de hipótesis y contratos](../src/lib/ranking-hypotheses.ts), [panel informativo](../src/components/ranking-pending-rules.tsx), [pruebas](../tests/ranking-hypotheses.test.mjs) y este documento.
- Actualizados: [gestión de ranking](../src/components/ranking-management.tsx) para mostrar el panel, y [documentación principal](./RANKING_2026.md) para enlazar esta revisión.

## Verificación de esta continuación

- 30/30 pruebas focalizadas de ranking, acciones e hipótesis. Incluyen selección independiente, apagado por defecto, identidad sin ordenar por nombre/ID, conservación del snapshot histórico, bloqueo de resultados pendientes, pases, clasificaciones obsoletas, cuadro completo de 64 y rechazo de puntos hipotéticos en el ranking oficial.
- Suite Node completa: 506 pruebas, 504 pasan; permanecen únicamente los dos fallos previos de navegación del Juez documentados en la revisión anterior. No se cambiaron esas pruebas.
- TypeScript sin errores. ESLint sin errores, con las mismas tres advertencias previas de los runners SQL 009, 013 y 018. Diagnósticos del editor sin errores en los tres módulos afectados.
- Sin cambios SQL en esta continuación: no se necesitó migración adicional ni ejecución de PostgreSQL. No se ejecutó ninguna migración ni operación de escritura en Supabase.
