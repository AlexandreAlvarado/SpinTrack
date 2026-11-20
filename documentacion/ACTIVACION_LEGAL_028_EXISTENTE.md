# Activación de la versión aprobada con 028 existente

La Liga confirmó la aprobación institucional de `2026-11-19.1`. La aplicación activa esa misma versión mediante `LEGAL_REVIEW_PENDING = false`. No se cambia la versión registrada en PostgreSQL ni se requiere aplicar 030 o 031 para este flujo sobre 028.

Los documentos públicos muestran la versión vigente y su aprobación. Se actualizaron sus avisos de estado; se conservan las cláusulas sustantivas y las decisiones operativas independientes todavía pendientes. No se inventan autorizaciones de menores, proveedores o plazos. `PERSONAL_DATA_REVIEW_PENDING = true` sigue restringiendo publicación de identidades deportivas y edición personal. La aceptación general no habilita esos tratamientos.

## Persistencia y seguridad

- Registro: el servidor exige casilla y versión vigente, valida los datos y llama a Supabase Auth con el booleano de aceptación y la versión constantes. Los triggers de 028 validan e insertan usuario, versión, fecha del servidor y origen `registro` en la misma transacción. Continúa el correo de confirmación y su callback.
- Cuentas existentes: la acción autenticada llama realmente a `aceptar_terminos_028`, sin caché ni aceptación simulada. PostgreSQL obtiene la identidad de `auth.uid()`, valida la versión vigente y genera la fecha. No se envían usuario ni fecha desde el formulario.
- El panel contrasta `estado_legal_028` y redirige a la aceptación si falta. Una aceptación ya registrada durante el alta o una sesión anterior permite entrar sin repetirla. La clave compuesta hace idempotente el registro.
- La redirección posterior utiliza `/panel`, que resuelve el rol autorizado del perfil. No se modifican roles, habilitación arbitral o políticas RLS.
- La casilla es obligatoria y comienza desmarcada. Una versión falsa, casilla ausente, fallo de RPC o versión distinta no se anuncia como aceptación exitosa. Ante un fallo se puede reintentar.

## Validación y prueba real

Suite Node: 599/599. TypeScript aprobado. ESLint sin errores, cuatro advertencias preexistentes. Build de producción aprobado. Se ejecutan las pruebas PostgreSQL de 028 en una base temporal local con datos sintéticos, sin instalar 029–031. Cubren registro, fecha del servidor, rechazo de metadata falsa, aceptación propia, repetición idempotente y permisos RLS.

En el navegador local con una sesión existente, se comprobó que aparece la versión vigente, la casilla desmarcada y el botón disponible, sin bloqueo de revisión ni error de configuración legal. No se envió el formulario ni se creó una cuenta remota. No se ejecutó SQL remoto.

Preparado para una prueba real autorizada:

1. Con una cuenta de prueba existente sin aceptación, marcar la casilla y enviar. Debe entrar al panel de su rol.
2. Cerrar sesión y volver a ingresar: no debe pedir la misma versión. Revisar la aceptación propia en Supabase con personal autorizado, sin editarla.
3. Desde una sesión nueva, registrar una cuenta de prueba y confirmar el correo. Tras el callback debe reconocer la aceptación del registro y entrar al panel Jugador.
4. Confirmar que cancelar/no marcar la aceptación impide entrar a paneles, y que términos, privacidad y calendario siguen públicos.

No se certifica entrega real del correo ni persistencia en la instancia remota sin completar esa prueba. Para Vercel, configurar `NEXT_PUBLIC_SITE_URL` con el origen HTTPS correcto y las URLs permitidas de Supabase Auth. No se realizó despliegue ni push.

No se detectó necesidad de una migración correctiva para este bloqueo de configuración. Las migraciones 001–029 permanecen intactas. La auditoría de catálogos pendiente de la revisión anterior sigue disponible en [028_solo_lectura.sql](../supabase/audits/028_solo_lectura.sql); no se ejecutó remotamente en esta tarea.
