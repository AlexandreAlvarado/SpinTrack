> Preparacion historica: NO ejecutar 031. La aprobacion y activacion de 028 ya fueron confirmadas. Consultar [secuencia vigente](RETIRO_030.md).

# Activación legal 031 — preparación y comprobación de versión

## Estado de esta revisión

El desarrollador confirma la aprobación institucional del Presidente. Sin embargo, hay una discrepancia de identificación que debe resolverse antes de activar el contenido:

- El mecanismo de aceptación y el registro inicial de 028 usan `2026-11-19.1`.
- Los textos públicos actuales se identifican con `2026-11-19.2-borrador`.
- No se dispone de un archivo aprobado separado ni de una huella de contenido de la versión .1 para contrastar ambos textos.

Se solicitó confirmar si el contenido actualmente visible en ambas páginas es exactamente el aprobado y si su identificación institucional autorizada es `2026-11-19.1`, retirando únicamente los avisos de borrador/aprobación pendiente. Hasta recibir esa confirmación, no se cambia el texto, no se inventa una versión ni se atribuyen aceptaciones históricas a un documento distinto. `LEGAL_REVIEW_PENDING` sigue activo. La activación todavía no está terminada.

## Trabajo preparado

- [Configuración legal](../src/lib/legal.ts): se separa la revisión del documento del resguardo de datos personales. Activar la aceptación no debe reabrir automáticamente publicación o edición de datos que requieran otras autorizaciones.
- [Control privado](../src/lib/auth.ts): exige aceptación y coincidencia exacta con la versión del servidor. Un booleano `aceptada` de otra versión no permite entrar.
- [Pantalla de aceptación](../src/app/aceptar-terminos/page.tsx): reconoce solo la versión coincidente, conservando casilla obligatoria desmarcada y opciones de reintento/salida ante configuración incompleta.
- [SQL manual 031](../supabase/referencias-retiradas/031_activar_aceptacion_aprobada.sql): instala o repara exclusivamente el subsistema legal definido en 028, sin incorporar las operaciones de jornadas de esa migración. Puede ejecutarse con el subsistema legal ausente, con 028 instalada o con el bloqueo 030 instalado. Rechaza una versión instalada distinta en lugar de sobrescribirla.

## Operación manual pendiente

Solo después de resolver la correspondencia del contenido aprobado con .1 y coordinar la configuración de la aplicación, ejecutar en el SQL Editor de Supabase el archivo completo [031_activar_aceptacion_aprobada.sql](../supabase/referencias-retiradas/031_activar_aceptacion_aprobada.sql). No ejecutar fragmentos ni modificar migraciones anteriores.

El archivo crea las tablas legales si faltan, asegura configuración única para .1, instala las RPC y los triggers legales, mantiene RLS de lectura propia, niega escrituras directas a las aceptaciones y retira únicamente los vetos generales de alta y aceptación de 030. Si existe otra versión configurada, toda la transacción se detiene y debe revisarse.

No toca cuentas existentes, contraseñas, perfiles, roles, fichas, partidos o resultados. No borra ni rellena aceptaciones históricas. No convierte metadatos editables de cuentas antiguas en prueba de aceptación: si falta el registro real, el titular debe aceptar. No restaura la publicación identificable ni la RPC de edición personal revocadas por 030.

Las nuevas aceptaciones toman `auth.uid()` de la sesión y la versión de la configuración contrastada con el parámetro recibido. PostgreSQL genera la fecha; no se acepta una fecha enviada por el navegador. Repetir una aceptación conserva el registro y fecha originales. En el registro, la aceptación se guarda mediante triggers en la misma transacción que crea Auth. Los roles siguen siendo los establecidos por los mecanismos existentes.

## Validación realizada

- 593 pruebas Node generales aprobadas.
- Cuatro [pruebas de activación](../tests/legal-acceptance-activation.test.mjs) aprobadas en un escenario de documento activo simulado: botón habilitado para versión coincidente, casilla desmarcada, reconocimiento de aceptación previa, rechazo de versiones distintas y acceso privado protegido.
- [PostgreSQL temporal 031](../supabase/tests/031_activar_aceptacion_aprobada.test.mjs): instalación legal independiente, reparación de configuración ausente, registro nuevo, cuenta existente, aceptación persistente entre sesiones SQL, RLS, rechazo de versiones/fechas manipuladas, idempotencia y conservación de permisos e historial. Incluye las regresiones 023 de arbitraje y cuenta única.
- TypeScript y build de producción aprobados.
- ESLint sin errores; cuatro advertencias preexistentes.
- Las pruebas existentes de Auth verifican el origen HTTPS requerido en producción y el flujo de confirmación. No se ha desplegado en Vercel ni se han enviado correos reales.

No se ejecutó SQL remoto ni se pulsó la aceptación de una cuenta real. Tras la operación manual y la activación del código, el propio titular debe aceptar desde el navegador; esa aceptación es la comprobación pendiente del entorno remoto. El registro de correo y login reales deben probarse con una cuenta de pruebas autorizada, sin alterar cuentas existentes.
