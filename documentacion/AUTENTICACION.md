# Autenticación: configuración y comprobación manual

## Configuración local (sin cambios remotos automáticos)

- `NEXT_PUBLIC_SITE_URL=http://localhost:3000`: origen canónico explícito, sin rutas ni parámetros. No se deriva de Host, Origin, forwarded headers ni `next`.
- `AUTH_RECOVERY_SECRET`: secreto exclusivo del servidor de al menos 32 caracteres aleatorios (recomendado 32 bytes aleatorios codificados en hexadecimal). No usar prefijo NEXT_PUBLIC, no versionar ni compartir. Es firma de autorización temporal, no almacenamiento de contraseñas. Mantener el mismo secreto entre instancias y reiniciar Next al configurarlo.
- Se conservan las variables públicas existentes de Supabase. Sin service_role ni Auth Admin.

## Supabase → Authentication → URL Configuration

Site URL: `http://localhost:3000`.
Redirect URLs exactas:

- `http://localhost:3000/auth/callback` (confirmación de registro PKCE existente).
- `http://localhost:3000/auth/recovery` (recuperación PKCE; RedirectTo incluye state).

Las rutas `/recuperar-contrasena`, `/restablecer-contrasena` y `/login` son pantallas internas: no necesitan autorizarse como destinos de correo.

Para usar otra máquina, elegir la IP real del servidor (por ejemplo `http://192.168.1.25:3000`), establecer ese origen en NEXT_PUBLIC_SITE_URL y autorizar sus dos callbacks exactos. No usar comodines. Abrir la PWA desde ese mismo origen en ambos equipos; localhost en un teléfono apunta al teléfono. Si se usa 127.0.0.1, configurarlo explícitamente y autorizar ambos callbacks con ese host. Registro PKCE requiere el navegador y origen donde se inició. La recuperacion PKCE requiere el mismo navegador y origen donde se solicito. Usar HTTPS en despliegue; las cookies de autorización son Secure en producción.

## Correo predeterminado y recuperación PKCE

Conservar la plantilla predeterminada Reset Password de Supabase Free:

```html
<a href="{{ .ConfirmationURL }}">Reset Password</a>
```

No editar plantillas ni contratar SMTP para adaptar este flujo. `createServerClient` usa PKCE, persistencia en cookies y detectSessionInUrl=false. `resetPasswordForEmail()` guarda el verificador PKCE con marcador recovery y envía RedirectTo al callback exclusivo con un state aleatorio. La aplicación guarda además una intención firmada HMAC HttpOnly de una hora en ese navegador. Una nueva solicitud reemplaza la intención anterior e invalida su autorización temporal.

ConfirmationURL lleva primero a Supabase, que valida el enlace y vuelve con code. El callback consume la intención firmada y exige coincidencia de state; intercambia code mediante exchangeCodeForSession (incluye sb_flow_id cuando existe). Supabase comprueba el código de un uso y su verificador. Una suscripción temporal exige PASSWORD_RECOVERY emitido por el SDK durante ese intercambio; SIGNED_IN, INITIAL_SESSION o type=recovery en la URL no autorizan. El listener solo establece una bandera, sin operaciones Auth que puedan bloquearlo, y se elimina incluso ante errores.

Solo con intercambio exitoso, evento de recuperación, usuario/sesión y claims verificados cuyo sub coincida con el usuario, se emite la autorización HMAC HttpOnly de 15 minutos vinculada a usuario y session_id. Página y acción comprueban getUser, errores de getClaims, sub, session_id y autorización antes de mostrar el formulario o llamar a updateUser. Una sesión normal no basta. Se ignoran destinos next externos; los errores y enlaces legacy token_hash se rechazan. Tras guardar se elimina la autorización y se intenta cerrar la sesión. Repetir el callback consume/rechaza la intención y elimina cualquier autorización anterior. No se guardan contraseñas ni tokens en las autorizaciones.

Es obligatorio solicitar y abrir el correo en el mismo navegador, perfil y origen (incluido puerto); una PWA instalada puede usar un contenedor distinto al navegador que abre el correo. No mezclar localhost y 127.0.0.1. No se admite el flujo implícito con tokens en el fragmento ni abrir en otro dispositivo. Un fallo, enlace usado/caducado, intención vencida o cookies borradas requiere otra solicitud. El plazo de una hora de intención no amplía la caducidad de Supabase.

Referencias: [Password-based Auth](https://supabase.com/docs/guides/auth/passwords), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [exchangeCodeForSession](https://supabase.com/docs/reference/javascript/auth-exchangecodeforsession). Se contrastó también el SDK instalado: resetPasswordForEmail genera el verificador recovery y el intercambio emite PASSWORD_RECOVERY; @supabase/ssr persiste las cookies en ese evento. No hace falta un listener de recuperación en la pantalla cliente.

La validación local exige mínimo 8 caracteres, máximo 1024 y coincidencia. Supabase aplica además su política remota de longitud, complejidad y contraseñas filtradas; sus rechazos se presentan sin detalles internos. Revisar manualmente la política configurada: no se consultó ni modificó.

## Correo y límites

Fuente oficial revisada: https://supabase.com/docs/guides/auth/auth-smtp

El proveedor predeterminado solo envía a direcciones de miembros del equipo del proyecto, actualmente con 2 mensajes/hora y sin garantía de entrega. Para probar correos externos configurar SMTP propio, remitente y dominio verificados (SPF/DKIM/DMARC según proveedor). Supabase documenta un límite inicial de 30 mensajes/hora al habilitar SMTP; revisar Authentication → Rate Limits y límites del proveedor. No desactivar confirmación para eludir estas limitaciones.

La respuesta de recuperación es uniforme aunque no exista la cuenta, falle SMTP o se alcance un límite: no garantiza envío. Explica revisar spam, esperar, reintentar o contactar a administración. Las respuestas de login/registro distinguen credenciales, correo sin confirmar, política y límites sin incluir el error interno.

## Seguridad operativa

No se registran datos sensibles desde el código. Next omite logs de solicitudes a ambos callbacks para evitar URLs con tokens/códigos. En hosting/proxy/APM configurar también exclusión o redacción de query strings de `/auth/recovery` y `/auth/callback`; la aplicación no controla esos logs. Callback de recuperación devuelve no-store y no-referrer y redirige inmediatamente a una URL sin token. No copiar enlaces reales en incidencias ni capturas.

## Pruebas manuales pendientes (cuentas de prueba autorizadas)

1. Verificar origen local y AUTH_RECOVERY_SECRET; reiniciar servidor. Los callbacks deben estar ya permitidos en Supabase. No cambiar plantillas ni SMTP. No se modificó configuración remota; si Supabase descarta RedirectTo por no estar autorizado, el código local no puede corregir esa configuración.
2. Registrar cuenta de prueba; confirmar correo y comprobar rol jugador. Probar login incorrecto, correo pendiente y acceso a panel de cada rol. El encabezado existente debe sustituir Ingresar por menú de usuario.
3. Desde /recuperar-contrasena solicitar un correo NUEVO para una cuenta de prueba autorizada. Mantener ese navegador abierto; abrir Reset Password del último correo en ese mismo navegador/perfil/origen. En la PWA, si el correo abre otro contenedor, hacer toda la prueba en una pestaña del navegador. Debe terminar en /restablecer-contrasena sin parámetros, con el formulario visual existente. Guardar contraseña coincidente que cumpla la política: debe llevar a /login?info=restablecida. Comprobar login con la nueva y rechazo de la anterior. Correos anteriores a esta corrección no tienen la intención y requieren otra solicitud.
4. Probar enlace caducado, reutilizado, modificado, código signup, acceso directo con sesión normal y otro navegador: rechazo. type=recovery agregado manualmente no autoriza. Intentar guardar después de 15 minutos y desde otra sesión: rechazo y opción de pedir otro enlace. Una nueva solicitud invalida la anterior.
5. Probar fallo de red, SMTP y límites. Revisar correos en spam y que los enlaces no sean consumidos por escáneres del proveedor; desactivar seguimiento de enlaces en correos de Auth.
6. Verificar teclado, mostrar/ocultar contraseña, indicador de carga, foco y contraste en móvil físico. Si está habilitada autenticación adicional/reauthentication, comprobar sus requisitos con la política real.

Las simulaciones no prueban entrega, configuración remota, caducidad real ni revocación de sesiones de Supabase. No se ejecutó SQL ni se alteraron usuarios reales, RLS, triggers, migraciones, portada, navegación o módulos deportivos.
