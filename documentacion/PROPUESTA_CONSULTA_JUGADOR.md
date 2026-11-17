# Consulta mínima para completar el Panel del Jugador — propuesta para revisión

## Bloqueo comprobado en SQL local

003 concede SELECT a authenticated, pero sus políticas de lectura de competencias,
categorías, control deportivo y habilitaciones solo admiten Administrador/Juez.
001–006 aplicadas según confirmación del desarrollador; 006 no amplía estas lecturas.
008 está documentada como preparada y NO aplicada; es independiente de este panel.
004 permite leer solicitudes propias, pero no motivo/referencia ni historial privado.
El snapshot propio incluye categoría, sin relación con la jornada.
No es posible completar con seguridad la disponibilidad usando solo estos permisos.

## Contrato propuesto (sin generar ni ejecutar migraciones)

Agregar en una futura migración distinta de 007 y 008 una consulta autenticada
restringida al rol jugador y a su vínculo jugadores.perfil_id = auth.uid().
Debe devolver únicamente competencias individuales activas/publicadas de jornadas
publicadas, categoría, jornada, fecha, inicio confirmado, estado propio y motivo
breve de indisponibilidad. Nunca devolver fichas ajenas, documentos, actores,
referencias privadas, historial, snapshots completos ni campos financieros.
Para solicitudes históricas propias, devolver categoría/jornada mínima aun si ya
no están publicadas, sin habilitar consulta general de borradores.

La disponibilidad debe calcularse en PostgreSQL con las mismas condiciones del
validador vigente tras 006: publicación, preparación/aprobación, reglamento y
catálogos activos, habilitación documentada propia, nacimiento/excepción, ficha
activa, inicio futuro dentro de jornada, plazo [abre,cierra), habilitación de nuevas
solicitudes y ausencia de inscripción histórica (incluidas rechazadas/canceladas).
No introducir cupos ni deducir elegibilidad por nombre. Devolver motivos seguros.

La escritura seguirá usando solicitar_inscripcion(p_jugador_id bigint,
p_competencia_id bigint,p_referencia_representacion text default null), que devuelve
bigint. Derivar jugador en servidor desde sesión; enviar referencia null para sí
mismo. Confirmación explícita, nunca INSERT directo. La RPC y sus triggers revalidan
bajo bloqueo transaccional; 23505 significa solicitud ya existente, no éxito nuevo.
Comprobar lectura posterior del ID propio; si falla, resultado desconocido y recargar.
No agregar cancelación. La resolución sigue en resolver_inscripcion del Juez.

Revisar contrato antes de generar SQL, según AGENTS.md. Probar permisos, aislamiento,
concurrencia y divergencia del validador en PostgreSQL local antes de aplicación
manual autorizada. No retirar políticas existentes ni usar service_role.

## Flujo manual pendiente

Hoy: cuenta Jugador real → ficha propia o aviso de vínculo → jornadas → solicitudes
propias existentes → Actualizar estado → ranking. Verificar 320/390px y teclado.
Con la consulta revisada, aplicada manualmente y conectada a la interfaz: Jugador →
competencia disponible → confirmación de solicitud pendiente → Juez General →
Inscripciones → aceptar/rechazar con evidencia → Jugador → Actualizar estado.
Usar únicamente datos y plazo reales autorizados; nunca abrir plazos para probar.
El flujo nuevo de solicitud todavía no está implementado ni probado realmente.
