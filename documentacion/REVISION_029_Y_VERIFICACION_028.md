# Revisión de 029 y verificación parcial de 028

## Resultado

La migración original [029](../supabase/migrations/029_editar_perfil_deportivo.sql) está corregida y validada en PostgreSQL aislado con 001–028. Está preparada para revisión y aplicación manual; no se aplicó remotamente. Las migraciones 001–028 permanecen idénticas al inicio de esta revisión. No se ejecutaron 030 ni 031.

029 permite actualizar únicamente nacimiento, club y localidad de la ficha vinculada a `auth.uid()`. No crea fichas, cambia vínculos, roles ni permisos arbitrales. Conserva el UPDATE administrativo y las políticas RLS anteriores.

Se corrigieron la posibilidad de borrar datos mediante NULL, la validación incompleta de `p_esperado` y la ausencia de protección de antecedentes deportivos. El formulario y la acción de servidor reflejan estos rechazos.

## Reglas y concurrencia

- `p_esperado` debe contener exactamente los tres campos editables y coincidir con la fila bloqueada. Una edición obsoleta devuelve `40001`.
- NULL solo conserva campos que ya estaban vacíos. No permite borrar información existente.
- Fecha finita, desde el año 1 y no posterior al día actual en Chile. Los nuevos clubes y localidades deben existir y estar activos; se puede conservar una asignación inactiva anterior.
- Criterio conservador: cualquier referencia deportiva mediante FK a jugadores exige revisión administrativa para realizar cambios. Incluye habilitaciones, inscripciones, participantes históricos, partidos, campeones y ranking. Guardar los mismos valores no modifica la ficha y está permitido.
- Reutiliza el bloqueo transaccional existente de habilitaciones/inscripciones y bloquea la ficha antes de comparar. Las pruebas incluyen formularios simultáneos, desvinculación administrativa y alta concurrente de habilitación.
- La función exige READ COMMITTED, usa `search_path` vacío y solo permite ejecución a `authenticated`; valida la identidad también dentro del servidor.

## Qué se comprobó realmente en Supabase

Mediante solicitudes GET/HEAD, sin recuperar filas personales ni realizar escrituras:

- Versión activa: `2026-11-19.1`.
- `estado_legal_028` responde con esa versión y aceptación falsa para sesión anónima.
- Sin filas de perfiles visibles para anónimo; acceso denegado a jugadores, aceptaciones y operaciones de jornadas.
- Consulta pública del calendario permitida.

Esto no demuestra escrituras reales de aceptación, altas Auth, creación/edición/eliminación de jornadas ni RLS de usuarios autenticados. No se crearon cuentas ni se modificaron datos para probarlo.

Para completar la revisión, ejecutar manualmente en el SQL Editor [028_solo_lectura.sql](../supabase/audits/028_solo_lectura.sql). Usa una transacción READ ONLY y consulta únicamente configuración legal y catálogos PostgreSQL: funciones, triggers, políticas, privilegios y defaults. Su sintaxis también pasó en la base aislada. No ejecuta las funciones de escritura.

El resultado incluye comparación de cuerpos de funciones contra la 028 local probada. `coincide_cuerpo = false` exige revisar la definición mostrada: comentarios o espacios también cambian el hash. Revisar especialmente triggers habilitados de Auth, fecha de aceptación del servidor, permisos de ejecución, RLS, doble confirmación, bloqueo y protección de historial de jornadas.

Con la evidencia remota disponible no se ha identificado una corrección SQL necesaria de 028. Tampoco se certifica toda su instalación sin esos resultados de catálogo. Si aparece una diferencia funcional, corresponde preparar una migración incremental basada en la definición instalada; nunca volver a ejecutar o editar 028.

## Bloqueo independiente en la aplicación

La configuración actual [legal.ts](../src/lib/legal.ts) mantiene `LEGAL_REVIEW_PENDING = true` y `PERSONAL_DATA_REVIEW_PENDING = true`. El primero impide registro/aceptación desde la aplicación aunque PostgreSQL anuncie la versión activa; el segundo conserva las restricciones independientes de datos personales y edición deportiva. Los documentos locales todavía distinguen una versión de borrador. Esta revisión no los relabela ni activa, y no presenta ese bloqueo como un fallo de 028. Antes de considerar funcional la aceptación en producción debe resolverse la correspondencia del contenido aprobado con su versión y configuración.

## Validación

- PostgreSQL aislado: aprobadas pruebas de 029 y regresión 023; instalación limitada a 001–029 y ejecución de la auditoría READ ONLY. Identidades y datos sintéticos; comparación de historial y cuentas antes/después.
- Node: 599/599 aprobadas.
- TypeScript: aprobado.
- ESLint: cero errores y cuatro advertencias preexistentes.
- No se ejecutó un nuevo build en esta revisión ni se desplegó o hizo push.

La aplicación debe conservar estos cambios mínimos de validación junto con 029. Su aplicación manual no activa las configuraciones legales pendientes. No ejecutar 030/031 como parte de esta entrega.
