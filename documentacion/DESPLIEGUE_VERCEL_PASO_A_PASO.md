# SpinTrack: auditoría final y publicación controlada

Revisión del 20 de noviembre de 2026. No se ejecutaron SQL remoto, push, despliegues, altas de usuarios ni envíos de correo. No se modificaron migraciones ni lógica deportiva. Este documento es la guía vigente para preparar la publicación; no certifica una instancia de producción ya operativa.

## Qué hacer primero

**Abrir el proyecto correcto de Supabase y comprobar su estado de migraciones antes de aplicar 029 o pulsar Deploy.** La versión legal remota responde `2026-11-19.1`, pero eso no demuestra que todas las migraciones 001–028 coincidan con las copias locales. La instalación de 028 fue informada por el desarrollador; no se dispone de acceso administrativo de lectura para certificar toda la historia instalada.

Para empezar, ejecutar manualmente estas consultas de lectura en SQL Editor:

```sql
begin transaction read only;
select version from public.version_legal_028 where id;
select to_regprocedure('public.estado_legal_028()') as estado_028,
       to_regprocedure('public.aceptar_terminos_028(text,boolean)') as aceptar_028,
       to_regprocedure('public.editar_mi_perfil_deportivo_029(bigint,date,bigint,bigint,jsonb)') as perfil_029;
select count(*) as vetos_030 from pg_trigger
where tgname in ('resguardo_alta_revision_030','resguardo_aceptacion_revision_030')
  and not tgisinternal;
select to_regclass('supabase_migrations.schema_migrations') as historial_cli;
commit;
```

Esperado: versión .1, funciones 028 presentes, perfil_029 NULL si sigue pendiente y cero vetos. Si el historial CLI existe, consultar aparte `select version, name from supabase_migrations.schema_migrations order by version;`. Ese historial puede no reflejar instalaciones manuales por SQL Editor y no sustituye revisar definiciones. No repararlo ni marcar versiones automáticamente.

Completar la comparación de 028 con [028_solo_lectura.sql](../supabase/audits/028_solo_lectura.sql), y la revisión de las consultas públicas con [025_026_solo_lectura.sql](../supabase/audits/025_026_solo_lectura.sql). Para 001–027, contrastar el registro de ejecuciones conservado por el desarrollador con los objetos instalados; esta tarea no los ha certificado remotamente. Ante diferencias, revisar antes de continuar y nunca reaplicar toda la carpeta.

## Resultado de la auditoría local

| Área | Resultado y límite |
| --- | --- |
| Next.js | 16.4.6 en manifest y lockfile; dependencias raíz coherentes. Node local 22.20.0; usar Node 22.x en Vercel para reproducir el entorno probado. |
| Arquitectura | App Router, Server Actions, rutas Auth y cookies del servidor; usar preset Next.js, sin exportación estática. No hace falta vercel.json para este alcance. |
| Build | `npm run build` aprobado. No despliega ni ejecuta migraciones. |
| Node | `node --test tests/*.test.mjs`: 602/602 aprobadas. |
| TypeScript | `npm run typecheck`: aprobado. |
| ESLint | `npm run lint`: cero errores, cuatro advertencias preexistentes. |
| Git y secretos | 321 archivos no ignorados examinados; ocho commits locales examinados con patrones de credenciales, JWT service_role y coincidencias de valores privados locales. Sin hallazgos en las reglas examinadas. Es heurístico; no certifica todos los secretos posibles ni repositorios remotos. |
| Archivos privados | `.env.local` está ignorado y no rastreado; no se encontraron archivos `.env.local`, `.env.*local`, `.pem` o `.key` rastreados ni en el historial local examinado. `.env.example` contiene ejemplos, no credenciales privadas. |
| Estado Git | Hay cambios y archivos esenciales aún sin seguimiento, incluidos documentos legales, perfil y migraciones recientes. El GitHub actual no se debe dar por equivalente a este checkout hasta revisar y preparar el commit. |
| Migraciones | Solo 029 sigue a 028 en la carpeta activa. 030/031 están fuera, en referencias-retiradas; no se crea 032. No hay scripts npm que ejecuten SQL ni workflows de GitHub presentes que apliquen esas referencias. |
| Verificación remota limitada | Solo GET/HEAD: versión legal .1 disponible; RPC públicas 025/026 accesibles; jugadores, aceptaciones y operaciones sin lectura anónima; perfiles sin filas visibles. No se descargaron nombres/resultados ni se probaron escrituras reales. |
| PWA | Service worker limita su caché al fallback offline e iconos; no almacena paneles ni resultados deportivos. |
| HTTPS | El código exige un origen HTTPS explícito en producción. El origen local actual HTTP sirve para desarrollo y no se debe copiar como origen de producción. |
| Correo | Flujo revisado y probado con dobles/fixtures; proveedor, plantilla instalada y entrega real no comprobados administrativamente. |

La integración [Next.js de Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs) soporta esta arquitectura. Esta revisión no incluye auditoría exhaustiva de dependencias, penetración o inspección del panel remoto de Supabase/Vercel.

## 1. Instalar solo 029, manualmente

Si las comprobaciones previas son correctas y 029 sigue ausente:

1. Abrir [029_editar_perfil_deportivo.sql](../supabase/migrations/029_editar_perfil_deportivo.sql).
2. Copiar **todo** el archivo original, BEGIN–COMMIT, a una consulta nueva del SQL Editor y ejecutar una sola vez. No concatenar otros archivos ni usar un push global de migraciones.
3. Comprobar función, SECURITY DEFINER, search_path vacío y permisos authenticated=true, anon=false, service_role=false mediante la consulta posterior de [REVISION_FINAL_029.md](REVISION_FINAL_029.md#pasos-exactos-para-aplicar-solo-029).
4. Conservar el resultado. Si ya existe o falla, detener y revisar; no borrarla ni reescribirla para forzar instalación.

030/031 no se ejecutan por estar archivadas: npm/Vercel no ejecutan SQL por encontrarlo en el repositorio, y esta preparación no incorpora ningún comando de migración. No ejecutar manualmente sus copias ni los runners históricos 030/031 como parte de la publicación. Los tests Node de la secuencia comprueban que están fuera de migraciones.

## 2. Preparar GitHub sin publicar secretos

1. Revisar `git status --short` y los diffs en VS Code. Incluir expresamente los nuevos archivos necesarios de src, public, scripts, tests, configuración, lockfile y migraciones activas; no publicar solo los archivos que ya estaban rastreados.
2. No añadir `.env.local`, archivos ignorados de resultados de prueba, claves, documentación privada ni documentos reales de jugadores. No usar `git add -f`. La revisión de documentos/binarios sigue siendo manual.
3. Revisar los cambios preparados con `git diff --cached --stat` y `git diff --cached --check`; examinar el contenido preparado localmente antes del commit. Un escaneo anterior no cubre secretos añadidos después.
4. Crear el commit local revisado. Elegir o crear el repositorio GitHub y la rama de publicación. Cuando el desarrollador decida continuar, él realiza el push; esta tarea no lo hace.
5. No subir ZIP con `.env.local` para sustituir este proceso. Las credenciales se introducen por separado en los paneles de los servicios.

La raíz Git comprobada es la carpeta de esta aplicación, la que contiene package.json. Si el repositorio GitHub conserva esa estructura, Root Directory en Vercel será `./`. Solo seleccionar una subcarpeta si en GitHub package.json está realmente dentro de ella.

## 3. Configurar Supabase Auth y SMTP

Confirmar el origen final: por ejemplo un dominio elegido o el dominio estable asignado al proyecto en Vercel. No se ha inventado ni reservado uno en esta revisión. Con ese valor:

1. En Auth → URL Configuration, Site URL debe ser `https://DOMINIO_CONFIRMADO`.
2. Permitir `https://DOMINIO_CONFIRMADO/auth/callback` para registro. Para recuperación, el código envía `/auth/recovery?state=NONCE`: configurar el patrón limitado a esa ruta, `https://DOMINIO_CONFIRMADO/auth/recovery?state=*`, y verificar su coincidencia en una solicitud autorizada. No usar comodines globales de dominios para producción. Los anteriores son ejemplos a sustituir, no valores configurados.
3. Mantener proveedor Email habilitado y confirmación de correo activada. Las plantillas deben conservar `{{ .ConfirmationURL }}` compatible con el flujo PKCE actual, no enlazar directamente al panel ni eliminar redirect_to/state. La ruta callback actual intercambia `code` por sesión; no se está implementando una ruta alternativa token_hash.
4. Configurar SMTP personalizado con el proveedor aprobado: host, puerto/TLS, usuario, contraseña, dirección remitente verificada y nombre de remitente. Configurar DNS SPF/DKIM y demás requisitos del proveedor, si corresponden. El Gmail institucional de contacto no implica que ese remitente esté autorizado para SMTP.
5. Introducir las credenciales SMTP solo en Supabase; no en variables NEXT_PUBLIC_, Git o chat. Revisar las restricciones de destinatarios, sandbox, cuotas y modificaciones de enlaces del proveedor. No desactivar confirmación de correo para ocultar fallos de entrega.

Según [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), el servicio predeterminado está limitado a destinatarios preautorizados del equipo y no está destinado a producción. No se puede afirmar que el registro enviará correos a jugadores externos sin configurar y probar un proveedor apropiado. Las [URL permitidas de Supabase](https://supabase.com/docs/guides/auth/redirect-urls) deben corresponder a los destinos del código.

## 4. Conectar GitHub a Vercel y configurar antes de Deploy

Cuando se haya decidido publicar, siguiendo la [integración oficial GitHub/Vercel](https://vercel.com/docs/git/vercel-for-github):

1. Ingresar en el equipo/cuenta Vercel correcto y seleccionar Add New → Project.
2. Conectar GitHub y autorizar el acceso al repositorio elegido; preferir conceder acceso únicamente al repositorio necesario. Importarlo y comprobar la rama de producción.
3. Preset Next.js; Root Directory según GitHub; Node 22.x; Install Command `npm ci`; Build Command `npm run build`; Output Directory predeterminado de Next.js. No usar `out` ni `next export`.
4. Antes de pulsar Deploy, introducir las variables del proyecto:

| Nombre | Valor, introducido privadamente |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | URL HTTPS del proyecto Supabase correcto. |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Clave pública del mismo proyecto. No sustituir por service_role o sb_secret. |
| NEXT_PUBLIC_SITE_URL | Origen HTTPS confirmado, sin rutas, parámetros ni fragmentos. |
| AUTH_RECOVERY_SECRET | Secreto aleatorio estable del servidor, al menos 32 caracteres. Sin prefijo NEXT_PUBLIC_. |

5. Separar Production/Preview/Development. No copiar el origen localhost de `.env.local` a Production. Las previews no deben escribir en producción por accidente ni exponer datos no autorizados. Usar un proyecto de prueba con datos ficticios o autorizados para validación pública.
6. Si todavía no se conoce el dominio estable, detener antes del primer despliegue y confirmar el dominio previsto/asignado; no dar por verificada una URL temporal. Hacer coincidir el origen de la app con Site URL y callbacks. No es obligatorio comprar un dominio para usar el dominio de Vercel.
7. Revisar configuración y datos publicables. El desarrollador pulsa Deploy solo cuando decida hacerlo. Vercel gestiona HTTPS y la redirección desde HTTP, según [TLS de Vercel](https://vercel.com/docs/cdn-security/encryption). No se ha comprobado un certificado concreto porque todavía no hay despliegue autorizado.
8. Una vez conectado Git, nuevos pushes pueden disparar despliegues automáticamente. Tenerlo presente antes de futuras modificaciones. Los cambios de variables deben incluirse en un nuevo despliegue autorizado; véanse [variables de Vercel](https://vercel.com/docs/environment-variables).

## 5. Prueba de aceptación real después del despliegue autorizado

La cadena automatizada revisada es: formulario obligatorio → validación del servidor → Supabase signUp con versión .1 → triggers 028 persisten aceptación con fecha del servidor → correo y PKCE callback → sesión → guarda del panel consulta estado_legal_028 → panel del rol. Una cuenta existente usa aceptar_terminos_028. No se confía en fechas, roles o una aceptación local enviados por el navegador; la misma versión aceptada no se solicita de nuevo.

Falta ejecutar esa cadena en el servicio real con un buzón controlado. Usar datos ficticios y una cuenta de prueba autorizada:

1. Abrir términos/privacidad/calendario sin sesión. Verificar certificado, navegación y ausencia de contenido mixto. Para calendario/ranking usar solo datos ficticios o autorizados.
2. Registrar la cuenta con casilla inicialmente desmarcada; comprobar rechazo de datos inválidos y de ausencia de aceptación. Confirmar que llega el correo y que no se permite login antes de confirmarlo.
3. Abrir el enlace en el mismo navegador que inició el registro para conservar PKCE. Confirmar acceso al panel Jugador sin pedir nuevamente .1.
4. Cerrar sesión, entrar otra vez y confirmar ausencia de nueva solicitud de la misma versión.
5. Con una cuenta de prueba anterior sin aceptación, aceptar y comprobar acceso al panel correspondiente, sin cambio de rol. Un operador autorizado verifica usuario, versión y fecha persistidos, sin editar la aceptación.
6. Probar recuperación con ese mismo buzón y navegador; el correo debe llegar, el enlace permitir cambiar contraseña y no poder reutilizarse. La respuesta genérica «enviado» no prueba entrega real.
7. Revisar errores de Auth/SMTP y runtime de Vercel con datos sensibles ocultos. No compartir enlaces con tokens ni credenciales. No aceptar por la cuenta personal abierta en el navegador.

Hasta completar estos pasos, registro/correo en producción están **pendientes de validación real**, aunque el build y los tests pasen.

## Menores: riesgo abierto, sin nuevos bloqueos

La decisión actual es posponer el procedimiento de autorización de apoderados hasta que la Liga lo defina. No se crea 032 ni se modifica 025/026 ni la participación deportiva. El acceso directo a esas RPC puede publicar nombres/resultados sin verificar autorización individual; el riesgo documentado sigue sin resolver. HTTPS, SMTP y aceptación legal no lo solucionan.

Se conserva la configuración de protección personal ya existente, sin añadir ni levantar bloqueos en esta auditoría. Puede limitar ranking/identidades en la interfaz y la edición del perfil aunque 029 esté instalada; las funciones originales permanecen intactas. Solo se prueban públicamente datos ficticios o autorizados. La revisión no certifica autorización de ningún dato histórico real.

## Datos que faltan para continuar

- GitHub: URL del repositorio, rama de publicación y confirmación de que el commit incluye los archivos necesarios revisados.
- Vercel: equipo/cuenta, nombre del proyecto, dominio HTTPS previsto o asignado y si el primer entorno será de pruebas o producción. No hacen falta tokens de acceso en el chat.
- Supabase: referencia del proyecto que debe usarse, resultados de las comprobaciones READ ONLY, estado real de 029, Site URL y destinos permitidos configurados, confirmación de Email/Confirm email habilitados. No compartir claves privadas o contraseña de la base.
- Correo: proveedor SMTP elegido, remitente autorizado, estado de verificación de dominio/DNS y si sigue en sandbox; un buzón de prueba controlado y confirmación posterior de entrega. Host/puerto no secretos pueden describirse; usuario/contraseña se introducen directamente en Supabase.
- Variables: confirmar que las cuatro están configuradas en el entorno Vercel adecuado; no enviar sus valores privados.

Esta tarea solo incorpora documentación de auditoría y guía. No modifica archivos de la aplicación, migraciones instaladas, permisos, cuentas o resultados.
