# Mesas: interfaz compacta y validación con 12 mesas

## Jornada 8: comprobación previa en lectura

Se consultaron las páginas públicas existentes de la jornada 8 del 14-11-2026 y de Peneca Inicial Mixta, sin escribir datos:

- Jornada publicada con Peneca Inicial Mixta finalizada.
- Seis encuentros de grupo y una final: siete resultados confirmados.
- Clasificación aprobada, campeón y subcampeón publicados.

Los cero pendientes informados por el usuario son coherentes con este torneo terminado. No se alteró la elegibilidad ni se recrearon encuentros para que aparezcan propuestas. La sesión disponible del navegador tenía permisos de árbitro y redirigió el acceso al panel del juez: la comprobación remota realizada fue pública, no una auditoría de capturas/reservas privadas o competencias no publicadas.

El usuario informó que 027 ya está instalada. No se modificó ni se ejecutó remotamente ninguna migración. No se modificaron resultados de Peneca Inicial, cuentas, mesas ni datos deportivos remotos.

## Cambios de presentación

- Indicadores de total, disponibles, ocupadas y fuera de servicio, calculados desde la fotografía de reservas existente.
- Cuadrícula de dos, tres o cuatro columnas según el ancho; las doce mesas vacías ya no muestran doce formularios grandes.
- Detalle y acciones de la mesa seleccionada en un panel de ancho completo: se conservan inicio, liberación, cambio de mesa y reprogramación.
- Campos de fecha/hora, duración y descanso alineados, con referencia explícita a `America/Santiago`. Se conserva el tratamiento existente de horas repetidas.
- Cinco eventos recientes visibles y el resto de los eventos recibidos en un desplegable. La RPC existente entrega hasta 30; este cambio no amplía ese límite.
- Estados vacíos distintos para jornada sin partidos, todos confirmados y todos los encuentros restantes ya reservados. No se ofrece generar otra propuesta cuando no hay encuentros elegibles.
- La hora de consulta procede del servidor, evitando discrepancias del reloj entre el renderizado inicial y la hidratación.

No se modificaron el algoritmo de asignación, las Server Actions, los roles ni otros paneles.

## Validación automática

**543/543 pruebas Node**, TypeScript aprobado y ESLint con **0 errores / 4 advertencias preexistentes**.

El escenario Node de doce mesas generó doce asignaciones de tres competencias, distribuidas en mesas distintas y sin repetir jugadores o árbitros. También verificó exclusión de un árbitro ocupado, jugadores compartidos, final indefinida, indicadores y conservación de las fuentes recibidas.

El runner PostgreSQL temporal creó doce mesas y dos competencias con partidos reales de las fixtures locales, incluyendo jugadores compartidos y un árbitro con un resultado en revisión. Usó el algoritmo TypeScript sobre la fotografía de la RPC: produjo tres encuentros compatibles de ambas competencias. Se validó:

1. Confirmación atómica de la propuesta generada.
2. Reprogramación de una reserva a la mesa 12 con id y versión.
3. Retención de la mesa al enviar el resultado.
4. Liberación de las tres mesas tras las confirmaciones deportivas existentes.
5. Reversión completa de las fixtures y conservación de los registros previos.

Tener doce mesas no obliga a proponer doce encuentros: los jugadores y árbitros disponibles pueden limitar la tanda.

El runner de regresión histórica también pasó: conservó íntegros partidos, actas, confirmaciones, campeones y ranking 026 de torneos terminados al instalar 027 exclusivamente en PostgreSQL temporal. Ambos runners reutilizan la regresión deportiva existente.

La vista se renderizó con fixtures locales y estilos del proyecto. En navegador se verificaron las doce tarjetas, cuatro columnas a ancho de escritorio, disposición móvil sin desbordamiento a 320 px, alineación inferior de los campos y cinco eventos visibles inicialmente. Las pruebas de renderizado verifican que las acciones originales siguen presentes en el detalle.

## Pendiente de comprobación manual autorizada

Con una sesión de Juez General y una competencia real pendiente o una prueba expresamente autorizada:

1. Abrir la jornada y verificar contadores, estado de mesas y pendientes privados.
2. Seleccionar árbitros disponibles, hora de Santiago, duración estimada y descanso; generar y revisar la propuesta.
3. Confirmar la tanda y comprobar que el detalle permita reprogramar o liberar una reserva no iniciada.
4. Enviar un resultado con el árbitro asignado: la mesa debe permanecer retenida.
5. Confirmarlo como juez: debe liberarse la mesa, conservando el resultado y el historial.

Este recorrido no se ejecutó desde el navegador contra Supabase. No se crearon fixtures remotas ni se eludieron los permisos para realizarlo.

## Archivos

- [Interfaz](../src/components/scheduling.tsx).
- [Indicadores y estado de presentación](../src/lib/programacion-vista.ts).
- [Hora de consulta del servidor](../src/app/panel/juez-general/programacion/page.tsx).
- [Pruebas Node de doce mesas](../tests/programacion-12-mesas.test.mjs).
- [Pruebas de interfaz](../tests/programacion-ui.test.mjs).
- [Recorrido integrado en PostgreSQL temporal](../supabase/tests/programacion_12_mesas.test.mjs).

Comandos ejecutados:

```text
npm run typecheck
npm run lint
node --test tests/*.test.mjs
node supabase/tests/programacion_12_mesas.test.mjs
node supabase/tests/027_regresion_historica.test.mjs
```
