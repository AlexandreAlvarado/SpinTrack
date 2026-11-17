# Verificación técnica de 008 (PostgreSQL temporal)

Ejecutar desde la raíz del proyecto:

```powershell
node supabase/tests/008_importar_fichas_jugadores.test.mjs
npm run typecheck
npx eslint supabase/tests/008_importar_fichas_jugadores.test.mjs tests/importacion-jugadores.test.mjs
node --test --test-reporter=dot tests/importacion-jugadores.test.mjs tests/jugadores.test.mjs tests/admin-presentation.test.mjs
```

El runner utiliza PostgreSQL 18 local, un directorio temporal exclusivo, puerto
55408 en 127.0.0.1 y bases desechables. Elimina variables PG heredadas, fija
host/puerto/base/usuario y verifica data_directory antes de instalar fixtures.
Nunca lee .env ni direcciones Supabase. Detiene el clúster y elimina únicamente
su directorio temporal verificado. Requiere binarios en
C:/Program Files/PostgreSQL/18/bin; una colisión de puerto aborta el arranque.

## Alcance y orden

Orden recomendado de revisión/aplicación manual: 001 → 002 → 003 → **004 histórica
ya aplicada** → 005 → 006 → 008. No reaplicar la 004 local sobre producción.
007 permanece reservada para programación deportiva: no crear un archivo vacío
ni ejecutarla para completar la secuencia. La prueba instala también 008 sobre
001–005 y aplica 006 después: 008 es independiente de tarifa/006 y de 007.
Usar selección explícita de archivos para aplicación manual; un futuro despliegue
con CLI deberá revisar su historial de migraciones y el orden de la futura 007.

008 usa CREATE FUNCTION, sin OR REPLACE: una segunda aplicación falla y revierte
la transacción. No modifica tablas, políticas, grants anteriores, funciones
anteriores, constraints ni triggers. El runner compara esos objetos y comprueba
que las otras tablas (incluidos Auth, perfiles, inscripciones/historial y
habilitaciones deportivas) conservan sus datos. Los fixtures son sintéticos y
existen únicamente en las bases temporales.

## Correcciones acotadas a 008

- NULL/tipos de lote, tipos JSON de filas, columnas inesperadas, nombres, booleano
  activo y fecha ISO se validan en PostgreSQL, incluso al llamar directamente a RPC.
- Desbordamientos de IDs y otros errores de datos se recuperan por fila; no abortan
  los registros válidos vecinos. Los fallos de autorización/infraestructura no se
  convierten en éxitos parciales.
- Normalización Unicode NFD antes de lower: tildes y mayúsculas funcionan también
  con locale C y grafías Unicode descompuestas. No verifica identidad de personas.
- Se exige READ COMMITTED: REPEATABLE READ/SERIALIZABLE podrían conservar un
  snapshot anterior a la espera del advisory lock y se rechazan explícitamente.
- El límite temporal de espera por bloqueo se restaura tras adquirirlo, conservando
  la configuración previa de la sesión. El bloqueo dura hasta terminar la transacción.

## Evidencia y límites

La suite comprueba Administrador autenticado; anónimo, sesión/perfil ausentes,
Juez, Árbitro y Jugador rechazados tanto por RPC como por INSERT directo/RLS.
Usa los roles PostgreSQL y auth.uid() sobre claims simulados: prueba autorización
real de PostgreSQL, no firma de JWT ni el transporte HTTP de PostgREST.

Comprueba 500 creaciones/500 omisiones al repetir, catálogo activo/inactivo,
conservación de fichas previas, homónimos existentes sin fusión, errores parciales,
IDs fuera de rango, fechas inválidas, columnas no autorizadas y límites de lote.
Dos conexiones reales importando el mismo nombre generan una sola ficha.

Límites deliberados y probados:

- El advisory lock coordina exclusivamente llamadas a esta RPC. Una creación
  manual simultánea puede producir dos fichas con igual nombre; esto no puede
  impedirse con el esquema actual sin cambiar el flujo manual o la estrategia.
- La RPC compara nombres normalizados exactos. Variantes como Mansilla/Mancilla
  pueden crear dos fichas; la revisión de similitud del asistente es una capa
  preventiva, no una garantía transaccional de identidad.
- Un nombre igual se omite como coincidencia, sin fusionar ni modificar personas.
  Homónimos realmente distintos se registran individualmente con IDs independientes.
- No hay historial persistente de lotes: renombrar una ficha y repetir una planilla
  vieja puede crear otra. El ID y la revisión siguen siendo necesarios.
- Ante respuesta de red perdida no se conoce el resultado desde el cliente:
  revisar listado y previsualizar antes de reintentar. No registrar manualmente
  las mismas personas durante una carga. Un fallo global revierte la transacción;
  los errores recuperables por fila dejan resultados explícitos.

## Comprobación posterior de solo lectura

```sql
SELECT p.oid::regprocedure AS rpc,
       NOT p.prosecdef AS security_invoker,
       p.proconfig,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS autenticados,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anonimos,
       (SELECT relrowsecurity FROM pg_class
        WHERE oid = 'public.jugadores'::regclass) AS rls_jugadores
FROM pg_proc p
WHERE p.oid = to_regprocedure('public.importar_fichas_jugadores(jsonb)');
```

Esperado: una fila, security_invoker=true, search_path vacío, autenticados=true,
anonimos=false, rls_jugadores=true. La autorización por cargo se comprueba dentro
de la función con auth.uid() y es_administrador(); EXECUTE para authenticated por
sí solo no permite importar a los otros cargos. Esta consulta verifica presencia
y configuración, no sustituye revisar la definición ni las pruebas.

No se ejecutó SQL en Supabase ni se alteraron registros de producción.

## Resultado final

Suite SQL real aprobada en PostgreSQL 18.1 temporal: ambos órdenes con 006,
permisos/RLS, 500 jugadores y su reintento, errores parciales, homónimos,
normalización Unicode, catálogos activos/inactivos, desbordamientos, tipos y
límites, dos conexiones concurrentes, límites frente a escritura manual y
renombrado, aislamiento y conservación de datos/objetos anteriores.
TypeScript y ESLint focalizado correctos; las 63 pruebas Node relacionadas
siguen aprobadas. Migraciones 001–006 sin cambios y 007 sin crear.

008 está lista para revisión y aplicación manual sobre el esquema verificado,
con los límites anteriores. No reaplicar las migraciones previas ya instaladas.
Esta evidencia local no certifica que producción no tenga diferencias de esquema;
no se consultó ni modificó Supabase real.
