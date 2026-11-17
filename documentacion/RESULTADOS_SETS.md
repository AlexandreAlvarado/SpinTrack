# Registro de resultados por set: contrato de 012 y flujo 013

Se reutilizan los partidos y lotes confirmados de 011. La migración 012 define las revisiones inmutables y la 013 agrega la asignación verificable de árbitros y el flujo de revisión del Juez General. Ninguna de las dos debe ejecutarse automáticamente en Supabase desde este proyecto.

## Fuentes y límites deportivos

- Las Bases Oficiales 2026 determinan grupos al mejor de tres o cinco sets. El formato se toma de `lotes_partidos_grupos.mejor_de`, ya aprobado, nunca del navegador.
- La puntuación ordinaria usa el reglamento ITTF: 11 puntos y diferencia de dos desde 10–10; gana quien obtiene la mayoría del número impar de sets. No se inventan excepciones por categoría.
- Se rechazan sets incompletos, empates, puntuaciones inválidas y sets posteriores al decisivo. Las incidencias de incomparecencia, retiro y suspensión quedan pendientes, sin ganador ni consecuencia reglamentaria automática.
- No se implementan todavía criterios de clasificación, desempates, ranking, llaves ni programación de mesas.

## Flujo operativo de 013

- El Juez General asigna un árbitro a cada partido confirmado mediante `partidos_arbitros`. La asignación y sus reemplazos quedan auditados; no se permite reemplazarla después de iniciar el historial de resultados.
- El Árbitro solo ve partidos con asignación activa, registra los puntos y envía una revisión al Juez General.
- El Juez General consulta partido, categoría, jugadores, árbitro, marcador y fecha. Confirma o devuelve con observación sin reescribir los sets.
- Una corrección crea una nueva revisión del Árbitro con motivo. La revisión confirmada anterior conserva vigencia hasta confirmar la nueva.

## Persistencia, permisos y concurrencia

- `resultados_partidos` conserva cada revisión con sets, resumen calculado por PostgreSQL, autor, fecha, referencias y motivo de corrección.
- `resultados_partidos_eventos` registra la confirmación oficial, exclusivamente por el Juez General. `resultados_partidos_observaciones` registra devoluciones auditables.
- RPC, triggers, RLS, bloqueo del partido y revisión esperada protegen identidad, formato, permisos y concurrencia. Las escrituras directas incompatibles se rechazan.
- El Administrador mantiene lectura operativa. El Árbitro captura solo sus partidos asignados y nunca confirma resultados. El Juez General asigna, revisa, observa y confirma.

## Verificación local

Las verificaciones usan datos sintéticos y un clúster PostgreSQL temporal aislado. No leen credenciales, no ejecutan SQL remoto y no registran resultados reales.