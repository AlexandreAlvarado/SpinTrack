# Jornadas, aceptación legal y prueba integral — 028

> Actualización: la corrección del archivo original y sus comprobaciones finales se detallan en [Revisión técnica de 028](./REVISION_MIGRACION_028.md). Los apartados de despliegue y aprobación de este informe describen la entrega inicial, no una activación remota.

## Estado y alcance

Implementación local del 19-11-2026. La migración [028](../supabase/migrations/028_jornadas_y_aceptacion_legal.sql) está preparada y probada en PostgreSQL temporal; **no está aplicada remotamente**. No se borraron jornadas reales, no se modificó la jornada 8 ni Peneca Inicial, no hubo importaciones ni push. No se modificaron las migraciones 001–027 ni se incorporaron pagos.

Aplicar 028 manualmente después de revisión y respaldo, y desplegar el código coordinadamente. El panel requiere la consulta de aceptación de 028: si falta la migración, muestra la ruta de aceptación con aviso y opciones de reintentar, salir o consultar información pública. No se debe desplegar ese estado intermedio como servicio operativo.

## Jornadas

En `/panel/administrador` cada fila ofrece **Gestionar jornada N**. El destino es `/panel/administrador/jornadas/ID`, donde ID es la clave del registro, no su número visible.

1. Pulsar **1. Revisar jornada y dependencias**. La consulta es exclusiva del Administrador. Devuelve identidad, estado, archivo, cantidades de registros dependientes y condición de protección. No elimina datos.
2. Para una jornada eliminable, continuar a la segunda confirmación. Escribir exactamente `ELIMINAR JORNADA N`, sin cambiar mayúsculas ni añadir espacios.
3. La última operación valida nuevamente Administrador, token propio, plazo de 15 minutos, fotografía íntegra de dependencias y frase literal. Ante cambios, repetir la revisión.
4. Se eliminan solamente jornada, competencias y configuraciones explícitamente autorizadas, y mesas sin historial relacionado. No hay DELETE CASCADE nuevo. Usuarios, jugadores y catálogos compartidos permanecen.
5. Toda operación exitosa conserva autor, fecha, metadatos mínimos de la jornada y recuentos de dependencias en `jornadas_operaciones_028`. No guarda copias completas de actas o datos personales. El token es de un solo uso y no es una autorización transferible.

**Protección conservadora:** las nóminas, grupos, partidos, actas, aprobaciones, reservas, ranking, historiales o cualquier dependencia no incluida expresamente en la lista de borrado impiden la eliminación. También se protegen jornadas finalizadas y competencias en curso/finalizadas, aunque los datos estén incompletos. Por tanto, «sin resultados» por sí solo no autoriza borrar una jornada con decisiones deportivas auditadas. Se ofrece archivar.

**Archivar** marca el registro como archivado, conservando su estado, resultados, ranking y consulta histórica. No cancela partidos ni detiene una competencia en curso. **Despublicar** cambia a borrador únicamente cuando no hay dependencias protegidas; si todavía hay competencias con inscripciones habilitadas, debe cerrarse esa habilitación administrativa primero. El archivo no equivale a ocultar resultados históricos.

La RPC final bloquea filas de la jornada, sus competencias y configuraciones borrables. Solo toma un bloqueo de tabla SHARE sobre ranking_configuraciones_026 para proteger sus referencias por array sin FK. No bloquea todas las tablas públicas. Se rechazan transacciones con aislamiento distinto de READ COMMITTED. Las claves foráneas siguen siendo una última protección. Administración conserva INSERT y edición de los campos administrativos, incluido estado; un trigger impide despublicar o retroceder jornadas protegidas. Se conserva el avance legítimo a finalizada sujeto a las validaciones previas. DELETE directo y la edición directa de archivada quedan reservados a las operaciones seguras.

## Términos y privacidad

- `/terminos` y `/privacidad` son públicas; existen enlaces en registro y pie de página.
- `/registro` exige casilla desmarcada inicialmente y versión vigente. La acción del servidor rechaza la ausencia de aceptación antes de llamar a Auth.
- 028 también valida nuevos registros en `auth.users`, incluidas solicitudes que evadan Next.js; el registro de aceptación se inserta en la misma transacción. No se toma un rol enviado por el navegador.
- Los usuarios existentes acceden a `/aceptar-terminos` antes de entrar a los paneles. Esta ruta usa su sesión y perfil, sin invocar el guard que exige aceptación; así pueden aceptar y continuar. Pueden cerrar sesión o seguir consultando información pública sin aceptar.
- `aceptaciones_legales_028` conserva usuario, versión, fecha del servidor y origen. No permite al usuario insertar, modificar o borrar directamente. Repetir la aceptación no cambia la fecha original.
- Una actualización de metadatos de Auth no sustituye el registro de aceptación. Solo se exige otra aceptación cuando cambia la versión obligatoria en `version_legal_028`.
- Cambiar la versión exige publicar el texto revisado, actualizar [LEGAL_VERSION](../src/lib/legal.ts) y la configuración obligatoria de base de datos de forma coordinada. No modificar una migración aplicada para hacerlo: preparar un cambio incremental o actualización administrativa expresamente autorizada. Una discrepancia entre versiones se informa y permite reintentar, sin borrar la cuenta ni registrar una aceptación falsa.
- Las altas que se efectúen directamente mediante otros mecanismos de Auth también quedan sujetas a esta validación. No asignar metadatos de aceptación en nombre de otra persona para eludirla. Las cuentas existentes no reciben aceptación automática ni cambios de rol.

### Datos institucionales por completar antes de publicar

1. Responsable del tratamiento, identificación, domicilio y canal de privacidad.
2. Finalidades y bases jurídicas por tipo de dato; obligatoriedad y consecuencias de no aportarlo.
3. Procedimiento para derechos, verificación de identidad y respuesta; comunicación de cambios e incidencias.
4. Verificación de edad/representación y autorizaciones de menores, con información comprensible y mínima exposición pública.
5. Proveedores efectivos, regiones, encargados, destinatarios y transferencias internacionales con sus garantías.
6. Criterios y plazos reales de conservación, respaldos y supresión; inventario de cookies/almacenamiento y eventual analítica.
7. Información de reclamaciones ante la autoridad según su vigencia y aprobación institucional de ambos documentos.

La aceptación contractual y lectura de privacidad no son un consentimiento general de tratamiento. Fotografías, publicidad, comunicaciones opcionales, datos sensibles y autorizaciones de representantes requieren procedimientos separados cuando correspondan; no se implementaron ni se simularon esas autorizaciones.

Fuentes oficiales consultadas: [Ley 19.628](https://www.bcn.cl/leychile/navegar?idNorma=141599) y [Ley 21.719](https://www.bcn.cl/leychile/navegar?idNorma=1209272). Esta última entra en vigencia el **1 de diciembre de 2026**. Los textos son borradores institucionales con marcadores; la implementación no certifica por sí sola cumplimiento normativo ni prueba autorizaciones de menores.

## Plantilla de 64 jugadores

No se encontró `SpinTrack_Plantilla_Torneo_64_Participantes.xlsx` en el proyecto ni en Descargas durante la revisión; se solicitó su ruta. Las cantidades indicadas por el usuario se consideran descripción del escenario, no una inspección de sus hojas o validación de categorías oficiales.

Existe importación masiva de **fichas de jugadores**, en `/panel/administrador/jugadores?importar=si`, implementada por [PlayerImport](../src/components/player-import.tsx), [acciones](../src/app/panel/administrador/jugadores/import-actions.ts) y [lector Excel](../src/lib/excel-jugadores.ts). No es importación de nóminas, competencias, grupos, partidos ni resultados.

En un backend separado y autorizado de prueba:

1. Como Administrador, abrir **Jugadores → Importar Excel**. Cargar el `.xlsx` y elegir hoja/fila de encabezado y mapeo. No usar automáticamente todas sus hojas como jugadores.
2. Mapear nombre y, si corresponde, fecha de nacimiento `AAAA-MM-DD`, club y localidad a catálogos reales de ese entorno. Los IDs ficticios de una plantilla no son IDs válidos de SpinTrack: dejar vacío el ID de jugador para altas nuevas. El modo de bloques de grupos también extrae fichas; no crea grupos deportivos.
3. Revisar la vista previa: errores, coincidencias, duplicados y filas seleccionadas. Los nombres/IDs de clubes y localidades deben resolverse sin ambigüedad. Las coincidencias quedan para revisión individual, sin sobrescribir fichas existentes.
4. Confirmar expresamente solo filas válidas. Se vuelve a validar en servidor y en la RPC existente. Límites: archivo `.xlsx` de hasta 2 MB, 2000 filas, 50 columnas y 20 hojas. Fórmulas/vínculos no se importan. No hay importación CSV en este flujo.
5. Como Administrador, preparar temporada, jornada y cuatro competencias usando categorías del catálogo y reglas aprobadas en `/panel/juez-general/preparacion`. No convertir las etiquetas de ejemplo en categorías oficiales.
6. Como Juez General, validar habilitaciones en `/panel/juez-general/habilitaciones`, elegir cada competencia en `/panel/juez-general/participantes` y confirmar sus 16 jugadores. La categoría deriva de la competencia; no se importa del Excel. Revisar que los 64 IDs correspondan a las fichas creadas y no haya repeticiones involuntarias.
7. Continuar en `/panel/juez-general/grupos`, `/panel/juez-general/partidos` y `/panel/juez-general/programacion`, reutilizando el flujo existente. Registrar 12 mesas de la jornada, proponer y confirmar. Seguir la [guía integral de mesas](./ACEPTACION_MESAS_NAVEGADOR.md) para arbitraje, resultado, confirmación y liberación.

Cuatro competencias con cuatro grupos de cuatro producen 96 partidos de grupos si se aplica el todos-contra-todos existente. Las 28 eliminatorias descritas corresponden aritméticamente a cuatro cuadros de ocho en eliminación simple; hay que verificar que el formato aprobado de las competencias permita ese escenario. No se crean clasificados ni resultados para forzar esa cantidad.

Una futura importación de **nóminas** podría reutilizar la vista previa y la RPC de confirmación: mapear competencia/categoría/jugador a registros reales, validar habilitaciones, mostrar duplicados y diferencias de nómina y exigir confirmación. No debe ejecutar retiros implícitos, generar resultados o importar categorías de ejemplo. No se implementa ese alcance adicional en esta entrega.

## Validación y navegador

Resultado local: **564/564 pruebas Node**, TypeScript aprobado, ESLint sin errores con cuatro advertencias preexistentes, **build de producción aprobado**. [PostgreSQL aislado 028](../supabase/tests/028_jornadas_legal.test.mjs) aprobó permisos, eliminación doble, tokens vencidos y usados, borrador/publicada, competencias relacionadas, archivo, cambio concurrente, conservación de resultados, registro sin aceptación y aceptación idempotente/versionada. Incluye la regresión deportiva 023 completa. Las [pruebas Node nuevas](../tests/jornadas-legal-028.test.mjs) cubren acciones de servidor, pantalla doble, aceptación de usuarios existentes, navegación pública y HTTPS. En el navegador se comprobó `/terminos`, `/privacidad` y `/registro` con casilla inicialmente desmarcada y enlaces; el registro a 390 px no presentó desbordamiento horizontal. No se enviaron registros remotos.

Prueba manual pendiente, exclusivamente con backend separado/autorizado y 028 instalada:

1. Crear una jornada vacía de prueba como Administrador; revisar, cancelar y comprobar que persiste. Repetir, escribir frase incorrecta y verificar rechazo. Con frase correcta verificar eliminación y auditoría.
2. Repetir con una jornada publicada sin historial protegido. Si otro administrador modifica la jornada tras la revisión, exigir una revisión nueva.
3. Usar una competencia local con resultado confirmado: verificar bloqueo de eliminación y archivo conservando su consulta. No usar jornada 8 como objetivo de una escritura.
4. Como Juez/Árbitro/Jugador, verificar que la ruta administrativa no permite gestionar jornadas.
5. Intentar registrarse sin marcar términos; con aceptación, comprobar confirmación de correo y registro de versión/fecha. Con cuenta existente sin aceptación, comprobar entrada a `/aceptar-terminos`, aceptación y posterior login sin repetir la solicitud.
6. Comprobar la navegación pública sin cuenta y, en móvil, tabla desplazable, revisión y formularios. La vista se integra con los componentes y clases actuales.

## Vercel

El código **compila para producción**, pero todavía no se considera listo para habilitar operación pública. Faltan 028 aplicada por el responsable, textos legales completos/aprobados, archivo de prueba revisado y aceptación integral con backend autorizado.

Configurar en Vercel el directorio raíz de este proyecto, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL=https://DOMINIO-DEFINITIVO` y `AUTH_RECOVERY_SECRET` aleatorio de al menos 32 caracteres. No publicar secretos ni usar service-role en navegador. `authOrigin` rechaza HTTP u origen ausente en producción y no deriva el destino de cabeceras o parámetros aportados por el visitante.

En Supabase Auth configurar Site URL y permitir las rutas HTTPS `/auth/callback` y `/auth/recovery` (incluida la query de estado que genera recuperación). Revisar las plantillas para conservar el flujo PKCE con código; no sustituirlo por una redirección arbitraria. La intención de recuperación usa cookie HttpOnly, SameSite y Secure en producción. Confirmación y recuperación deben iniciarse desde el mismo navegador donde se completará el enlace. Autorizar entornos preview solo si se usarán; no dar por configurado el dominio futuro.

Las pruebas automáticas verifican construcción y validación de URLs y el flujo de callbacks; **no prueban entrega real de correo, configuración remota de Auth ni el futuro dominio TLS**. Probar registro, confirmación, recuperación, enlace vencido/reutilizado y cierre de sesión en HTTPS antes del lanzamiento. El frontend localhost actualmente apunta al backend configurado en `.env.local`: localhost no acredita aislamiento de los datos. No usar la plantilla ficticia allí sin verificar un backend separado.

## Archivos de esta entrega

Código:

- [Administración de jornadas](../src/app/panel/administrador/page.tsx), [ruta de gestión](../src/app/panel/administrador/jornadas/[id]/page.tsx), [acción](../src/app/panel/administrador/jornadas/actions.ts) y [componente](../src/components/date-management.tsx).
- [Términos](../src/app/terminos/page.tsx), [privacidad](../src/app/privacidad/page.tsx), [página de aceptación](../src/app/aceptar-terminos/page.tsx), [acción de aceptación](../src/app/aceptar-terminos/actions.ts) y [versión legal](../src/lib/legal.ts).
- [Registro](../src/app/actions.ts), [formulario de autenticación](../src/components/auth-form.tsx), [guard de panel](../src/lib/auth.ts), [origen y mensajes](../src/lib/auth-flow.ts) y [pie público](../src/app/layout.tsx).
- [Migración 028](../supabase/migrations/028_jornadas_y_aceptacion_legal.sql).

Pruebas nuevas: [Node 028](../tests/jornadas-legal-028.test.mjs) y [PostgreSQL 028](../supabase/tests/028_jornadas_legal.test.mjs). Fixtures/mocks actualizados para aceptación legal: [autenticación](../tests/auth-flow.test.mjs), [encabezado/autorización](../tests/auth-header.test.mjs), [preparación deportiva](../tests/preparacion-deportiva.test.mjs) y [páginas públicas](../tests/public-pages.test.mjs). Este informe documenta la entrega. Las otras modificaciones que ya estaban en el árbol de trabajo no forman parte de este cambio.
