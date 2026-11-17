# Clasificación de grupos — revisión 2026-11-15

Se leyeron íntegramente las Bases Oficiales 2026 y la hoja Grupos del Excel de cuarta fecha. §7 define grupos de tres/cuatro y mejor de tres/cinco sets. El Excel contiene nóminas, sin reglas de clasificación. §9 puntúa puestos del ranking anual y sus desempates; no corresponde trasladarlos a grupos. §22 permite resolver dudas al Juez y comisión organizadora.

Quedan pendientes de confirmación documental: criterio principal (incluido ordenar por victorias), puntos por partido, desempates simples/múltiples, consecuencias de incidencias y número de clasificados. No se calculan puntos de clasificación, cocientes, enfrentamiento directo, sorteos ni plazas automáticas.

La tabla ordena provisionalmente por victorias como propuesta explícitamente pendiente de validación, sin posición deportiva definitiva. Los empates quedan pendientes, incluso si los sets o puntos difieren. Los puntos a favor/en contra son tantos de los sets, no puntos de ranking. La aprobación interna exige que el Juez documente expresamente el respaldo de la Liga al criterio de mayor cantidad de victorias, todos los cruces confirmados y ausencia de empate o revisión pendiente. No permite resolver empates manualmente.

## Persistencia propuesta y justificación de 015

Una tabla nueva `clasificaciones_grupos_aprobaciones` conserva snapshots inmutables, actor, fecha y referencia; es necesaria para registrar la aprobación solicitada. La RPC de consulta calcula indicadores en PostgreSQL desde `resultados_confirmados_grupos`, nunca desde capturas pendientes. Una captura nueva conserva los totales oficiales anteriores pero bloquea la aprobación y deja cualquier aprobación previa desactualizada hasta nueva revisión. No se borra historial.

La RPC de aprobación bloquea grupo y partidos en orden, recalcula y compara el snapshot mostrado; los mismos bloqueos de partidos serializan captura/confirmación. Si la aprobación obtiene primero esos bloqueos, una corrección concurrente espera y queda fuera de la transacción de aprobación; si la corrección los obtiene primero, la aprobación espera y recalcula después de su commit. Solo el Juez puede aprobar. RLS y permisos restringen lectura a Juez/Administrador; ninguna escritura directa del cliente. Sin acceso público ni integración con ranking. Todas las consultas usan la sesión; no hay clave de servicio. Datos ficticios no deben aprobarse: el flujo exige una declaración explícita del responsable sobre datos reales y respaldo documental, que queda auditada junto al actor y la referencia; la base no puede verificar la veracidad material de esa declaración. Incluso una aprobación interna no publica datos.

Los requisitos técnicos (grupo confirmado, cruces esperados, resultados ordinarios confirmados, ausencia de observaciones/revisiones pendientes y snapshot vigente) son precondiciones del sistema. No equivalen a una aprobación reglamentaria de la Liga. La aprobación solo registra que el Juez declara contar con el criterio deportivo validado; mientras ese criterio no exista, la tabla y el orden por victorias siguen siendo provisionales.

La migración 015 queda preparada para revisión y aplicación manual; no se ejecuta remotamente. No cambia 001–014. No implementa llaves ni avance. La actualización de pantalla usa consultas periódicas y al recuperar foco; no depende de habilitar Realtime.

## Comprobación y puesta en uso

Ejecutar `node supabase/tests/015_clasificacion_grupos.test.mjs` en Windows con PostgreSQL 18 instalado. Crea exclusivamente un clúster temporal en loopback:55415, con base sintética; incluye dependencias y pruebas 013/014. No usa variables de conexión remota. El runner detiene y elimina únicamente su clúster.

Revisar la migración completa antes de aplicarla manualmente una vez sobre 014. Hasta entonces la interfaz informa indisponibilidad, sin mostrar resultados parciales. Entrar como Juez, seleccionar temporada/jornada/competencia y abrir Clasificación de grupos. Verificar PJ/PG/PP, sets y tantos; confirmar un resultado en otra pestaña y volver a la tabla (actualización al enfocar o hasta 15 segundos). Probar ausencia de confirmación, observación, incidencia y corrección en entorno sintético. Un empate debe bloquear aprobación aunque cambien los sets.

En una competencia deportiva real, sin empate y con todos los resultados confirmados, revisar respaldo de la Liga al criterio de victorias, declarar datos reales y registrar referencia. Comprobar actor, fecha y referencia; una nueva revisión debe desactualizar la aprobación sin borrar historial. Peneca Inicial informado como prueba no debe aprobarse. No existe publicación pública desde este módulo.

Se revisó el indicador de desarrollo: los rechazos esperados por permisos, concurrencia o validación deportiva se registran con `console.warn`, conservando el mensaje de error de la interfaz; fallos técnicos/esquema/lectura siguen en `console.error`. No se desactiva el indicador de Next ni se ocultan errores. No se contó con una reproducción autenticada del indicador original; su comprobación visual sigue pendiente.

Los nombres de árbitros usan el perfil permitido por RLS con identificador corto para distinguir homónimos. Los nombres genéricos se señalan como pendientes, sin inventarlos; solo la administración autorizada debe corregirlos. El historial del Juez reutiliza el nombre del árbitro asignado (013 impide reemplazo tras iniciar actas). No se modifican perfiles, metadata, cargos ni políticas de seguridad.
