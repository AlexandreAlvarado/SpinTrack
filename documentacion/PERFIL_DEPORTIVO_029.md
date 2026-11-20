# Registro y perfil deportivo — 029

> Actualización: consultar [la revisión vigente de 029 y verificación de 028](REVISION_029_Y_VERIFICACION_028.md). Añade rechazo de borrados mediante NULL, revisión administrativa cuando existe cualquier antecedente deportivo y validación de concurrencia. Las cifras y comprobaciones siguientes describen la entrega anterior; no certifican la configuración actual de aceptación legal.

## Revisión y decisión mínima

Ya existían el registro con aceptación legal (028), consulta de ficha en el panel Jugador, vínculo opcional único `jugadores.perfil_id → perfiles.id → auth.users.id`, catálogos y habilitación arbitral independiente del rol (023). La creación de perfiles fija Jugador; no toma roles del navegador. Se conserva Supabase Auth, callback de confirmación y política legal existente.

La consulta deportiva se reutiliza. Se incorpora `/panel/jugador/perfil`, accesible desde Mi perfil deportivo y para cuentas de cualquier rol con sesión y aceptación vigente. Permite editar exclusivamente nacimiento, club y localidad de la ficha propia ya vinculada. Todos son opcionales; nacimiento se solicita para validar categorías por edad cuando corresponda, sin imponer una edad mínima inventada. Club utiliza el catálogo actual, que ya contiene su relación con asociaciones; no se crea una afiliación paralela. No concede habilitación deportiva ni modifica participaciones confirmadas o antecedentes históricos.

Sin ficha, se solicita verificación y vinculación administrativa antes de completar esos datos. Se evita una segunda ficha provisional y la duplicación de información personal. El usuario no puede crear fichas, elegir un vínculo ni buscar candidatos por nombre o correo. La corrección de nombre y la vinculación conservan el procedimiento administrativo existente.

## Archivos de esta entrega

- [Formulario de registro](../src/components/auth-form.tsx): explica Jugador inicial y arbitraje posterior en la misma cuenta.
- [Acciones de autenticación](../src/app/actions.ts): valida correo y longitudes sin truncar silenciosamente datos inválidos; conserva aceptación y callback.
- [Panel Jugador](../src/app/panel/jugador/page.tsx): acceso a edición y estado arbitral de solo lectura.
- [Perfil deportivo](../src/app/panel/jugador/perfil/page.tsx): consulta propia, catálogos paginados, campos opcionales y estados de error.
- [Acción de guardado](../src/app/panel/jugador/perfil/actions.ts) y [validación](../src/lib/perfil-deportivo.ts): sesión y lista explícita de parámetros.
- [Migración 029](../supabase/migrations/029_editar_perfil_deportivo.sql): única RPC de escritura para la ficha vinculada.
- [Pruebas del perfil](../tests/perfil-deportivo.test.mjs), [autenticación](../tests/auth-flow.test.mjs) y [PostgreSQL temporal](../supabase/tests/029_perfil_deportivo.test.mjs).

## Autorización y datos personales

029 no crea tablas, columnas ni políticas de lectura. Mantiene las políticas RLS y los permisos de actualización directa existentes. La función SECURITY DEFINER tiene `search_path` vacío, referencias cualificadas y ejecución revocada a PUBLIC y anon. Solo authenticated puede llamarla. Comprueba `auth.uid()` y bloquea la fila de jugador vinculada antes de actualizar. No acepta cambios de nombre, `perfil_id`, rol, estado activo o permiso arbitral. Un JSON con los valores anteriores impide sobrescribir una edición concurrente. Una desvinculación administrativa impide guardar desde el formulario anterior.

Los catálogos nuevos deben existir y estar activos; una opción inactiva previamente asignada se puede conservar. Se rechazan nacimientos futuros, infinitos o anteriores al año 1. No se publican nacimientos ni se añaden consultas a fichas ajenas. La habilitación/revocación arbitral y las barreras contra autoarbitraje se reutilizan sin cambios.

## Validación y despliegue

- `npm run typecheck`: aprobado.
- `npm run lint`: sin errores; cuatro advertencias preexistentes fuera del alcance.
- Suite Node inicial completa: 576/576. Pruebas focalizadas finales de autenticación, panel y perfil: 77/77, incluyendo las nuevas validaciones y renderizado.
- `node supabase/tests/029_perfil_deportivo.test.mjs`: usa exclusivamente PostgreSQL temporal en loopback y fixtures sintéticos. Comprueba edición propia, denegación anónima/sin identidad/ajena, RLS directo, catálogos, nacimiento, rechazo de versiones obsoletas, desvinculación y conservación de perfiles/cuentas. También ejecuta regresiones 023 de arbitraje, revocación y autoarbitraje.
- `npm run build`: compilación de producción aprobada, incluida la nueva ruta.
- Registro inspeccionado en navegador local: conserva campos, términos y privacidad, sin selector de roles.

Los flujos de registro, confirmación y login se comprueban con dobles de Auth y pruebas existentes de callback/PKCE. No se enviaron correos reales ni se crearon cuentas remotas. La entrega efectiva de correo y el login de una cuenta confirmada real requieren una prueba de aceptación con una cuenta de pruebas autorizada.

**Vercel:** el código compila y es compatible con el despliegue actual. La edición requiere revisar y aplicar manualmente 029 en una base con las migraciones previas y verificar las variables y URLs de Auth del entorno. Hasta entonces la lectura existente sigue disponible, pero el guardado mostrará un error. No se aplicó ninguna migración remotamente ni se modificaron datos reales. Las migraciones 001–028 y los otros paneles se conservaron en el estado encontrado; el repositorio ya contenía otros cambios pendientes al iniciar esta tarea.
