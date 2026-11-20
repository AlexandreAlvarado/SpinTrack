# Instalación controlada 029 y preparación para Vercel

> La [auditoría final y guía paso a paso](DESPLIEGUE_VERCEL_PASO_A_PASO.md) incorpora los resultados actuales de Node, TypeScript, ESLint, build, revisión Git y configuración pendiente de Supabase/Vercel.

## Decisión institucional pendiente

La Liga aún no ha entregado el procedimiento oficial de autorización de apoderados. Se pospone su implementación: NO crear 032 ni añadir bloqueos generales o selectivos en esta etapa. El riesgo de publicación de nombres/resultados de menores mediante las RPC públicas 025/026 continúa **abierto, pendiente de resolución institucional**; no se declara solucionado por aprobar los términos ni por instalar 029.

Se mantienen participación de todas las categorías, inscripciones administradas por la Liga, grupos, partidos, eliminatorias, resultados y las funciones originales de calendario/ranking 025/026. No se cambian resultados, migraciones ni autorizaciones existentes. Para pruebas públicas, utilizar exclusivamente datos ficticios o información con publicación autorizada. Preparar el entorno de pruebas con ese criterio antes de exponerlo; no limpiar, anonimizar ni editar automáticamente datos históricos para conseguirlo.

La configuración actual `PERSONAL_DATA_REVIEW_PENDING = true` ya limita la proyección personal en la interfaz y la edición del perfil; no se añade ni retira esa restricción en esta preparación. Instalar 029 conserva la RPC segura, pero no habilita por sí solo todos los campos de la interfaz. Las RPC originales siguen siendo invocables con sus permisos existentes. No se confunde ocultación de interfaz con autorización de publicación en PostgreSQL.

## Aplicar únicamente 029

030 y 031 están archivadas fuera de migraciones. No se reaplican 001–028 y no se ejecutan los archivos históricos. Según el estado comunicado por el desarrollador, únicamente 029 está pendiente. No se certifica su instalación remota hasta recibir el resultado de las comprobaciones posteriores.

1. Abrir el SQL Editor del proyecto correcto y ejecutar las consultas READ ONLY de preinstalación de [la revisión final](REVISION_FINAL_029.md#pasos-exactos-para-aplicar-solo-029). Deben devolver versión `2026-11-19.1`, funciones legales 028 presentes, función 029 ausente y cero vetos 030. Ante diferencias, detener y conservar el resultado.
2. Abrir [029_editar_perfil_deportivo.sql](../supabase/migrations/029_editar_perfil_deportivo.sql), copiar el archivo completo, incluido BEGIN/COMMIT, a una consulta nueva y ejecutarlo una sola vez. No concatenar otros archivos ni usar un push global de migraciones.
3. Ejecutar la consulta READ ONLY posterior del mismo informe. Debe existir la función con SECURITY DEFINER, `search_path` vacío y EXECUTE permitido a authenticated, denegado a anon/service_role. No probarla sobre una ficha real.
4. Guardar el resultado de ejecución. Si ya existe, no repetir CREATE FUNCTION ni borrarla para forzar la instalación. El SQL Editor no sincroniza automáticamente el historial de Supabase CLI; no marcar otras migraciones como aplicadas.

El archivo 029 valida identidad vinculada, catálogos, nacimiento, valores anteriores y antecedentes deportivos; no inserta fichas ni cambia roles. La instalación se realiza manualmente por el desarrollador; no se ejecuta SQL remoto desde esta preparación.

## Configuración de Vercel, todavía sin desplegar

El directorio raíz debe ser la carpeta que contiene este `package.json` y `package-lock.json`. En el checkout actual es `liga-tenis-mesa-pwa` dentro de la carpeta de trabajo exterior; al importar Git seleccionar el equivalente real, no asumir que será el raíz del repositorio remoto.

Usar el preset Next.js, instalación `npm ci`, build `npm run build` y salida predeterminada del framework. No convertirlo en exportación estática: utiliza Server Actions, cookies y rutas Auth del servidor. No hace falta añadir redirecciones manuales de HTTPS ni un archivo vercel.json para este alcance. Vercel sirve despliegues por HTTPS y redirige HTTP automáticamente, según [su documentación de TLS](https://vercel.com/docs/cdn-security/encryption).

Configurar de forma privada en el entorno adecuado de Vercel:

| Variable | Valor requerido |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL HTTPS del proyecto Supabase correcto. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública de ese mismo proyecto. |
| `NEXT_PUBLIC_SITE_URL` | Origen HTTPS real de producción, sin rutas, parámetros ni fragmentos. No usar localhost ni una URL supuesta. |
| `AUTH_RECOVERY_SECRET` | Secreto aleatorio del servidor, mínimo 32 caracteres. No publicarlo, compartirlo en el chat ni ponerle prefijo NEXT_PUBLIC_. Mantenerlo estable para las solicitudes de recuperación en curso. |

`.env.example` incluye ahora el nombre del secreto de recuperación que ya exige el código. No contiene un secreto generado ni credenciales. No copiar `.env.local` a un repositorio o al cliente. Esta aplicación no requiere service_role para registro, aceptación o perfil 029. Las credenciales SMTP se configuran en Supabase Auth, no como variables públicas de Next.js.

Separar las variables de Development, Preview y Production: una prueba pública debe apuntar a datos ficticios o autorizados. No conectar una preview pública a datos reales sin revisar su publicación. El código exige explícitamente NEXT_PUBLIC_SITE_URL HTTPS cuando NODE_ENV es production; no deriva el origen de cabeceras manipulables. Cambios de variables deben incorporarse al siguiente despliegue autorizado, según [la documentación de variables de Vercel](https://vercel.com/docs/environment-variables).

## Supabase Auth y correo

Pendiente de confirmar por el desarrollador: dominio/origen final y proveedor/remitente SMTP autorizado. El correo institucional de contacto no se presume configurado como remitente SMTP ni se selecciona un proveedor por cuenta de la Liga.

En Auth → URL Configuration, establecer Site URL al origen HTTPS confirmado. Añadir como destinos permitidos de producción:

- `https://DOMINIO_CONFIRMADO/auth/callback` para confirmación de registro.
- `https://DOMINIO_CONFIRMADO/auth/recovery?state=*` para recuperación con nonce dinámico; comprobar el patrón en la configuración y mediante una solicitud real autorizada. `*` queda limitado al parámetro de esa ruta, sin abrir todos los hosts. La aplicación valida además el nonce firmado y la sesión de recuperación.

Los anteriores son patrones a sustituir, no dominios reales configurados. Para desarrollo usar el host real local y las mismas rutas. Mantener entornos separados cuando sea posible y no usar un comodín global de dominios en producción. [Supabase documenta la lista permitida y sus patrones](https://supabase.com/docs/guides/auth/redirect-urls).

Conservar habilitado el proveedor Email y la confirmación de correo. Las plantillas de confirmación/recuperación deben conservar un enlace funcional `{{ .ConfirmationURL }}` compatible con el flujo PKCE existente; no sustituirlo directamente por `/panel`, no añadir otra implementación de token y no perder `redirect_to` o el state de recuperación. Abrir el correo en el mismo navegador que inició el flujo para conservar las cookies/verificador PKCE.

Configurar SMTP personalizado con host, puerto, usuario, contraseña y remitente verificado del proveedor confirmado. Validar SPF/DKIM y requisitos de dominio según ese proveedor; no inventar entradas DNS. El correo predeterminado de Supabase está limitado a direcciones autorizadas del equipo y no está destinado a producción; por ello un build correcto no demuestra entrega a jugadores. Fuente: [SMTP de Supabase](https://supabase.com/docs/guides/auth/auth-smtp).

## Prueba real posterior, solo autorizada y con datos de prueba

1. Verificar certificado HTTPS, ausencia de contenido mixto, apertura de términos/privacidad/calendario sin sesión y que la navegación pública solo usa datos ficticios o autorizados.
2. Registrar una cuenta de prueba con datos ficticios y un buzón controlado. Confirmar recepción (incluido spam), abrir enlace en el navegador inicial y verificar panel Jugador sin repetir aceptación 2026-11-19.1.
3. Con cuenta de prueba existente sin aceptación, aceptar, entrar a su panel, cerrar sesión y reingresar sin repetición. Un operador autorizado comprueba la fila persistida, sin editarla. No usar la cuenta abierta de una persona para aceptar en su nombre.
4. Solicitar recuperación con el mismo buzón, abrir enlace en el navegador inicial, cambiar contraseña, comprobar nuevo login y rechazo de enlace reutilizado. La respuesta genérica «enviado» por sí sola no confirma entrega del proveedor.
5. Comprobar los logs de Auth/SMTP sin compartir tokens, contraseñas ni datos personales. Si falla, conservar códigos y tiempos, no desactivar confirmación, RLS o validación de nonce.

Hasta completar configuración y prueba real, el estado es **preparado para configurar y probar**, no «correo funcional en producción verificado». No se crea una cuenta, envía correo ni despliega durante esta tarea.

## Validación de esta preparación

Build de producción aprobado. Pruebas focalizadas de autenticación, aceptación legal y secuencia de migraciones: 54/54 aprobadas. Las migraciones existentes conservan sus hashes; no existe 032. Solo se modificaron esta documentación y el ejemplo de variables, sin cambios de lógica deportiva, diseño, filtros de privacidad o datos. La validación PostgreSQL 029 de la revisión anterior sigue siendo el antecedente de instalación; no se presenta como una nueva ejecución remota.
