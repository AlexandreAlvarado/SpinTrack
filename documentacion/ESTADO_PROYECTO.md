# ESTADO DEL PROYECTO — PWA Liga Regional de Tenis de Mesa Los Ríos

## Objetivo

Desarrollar una aplicación web progresiva (PWA) para gestionar competencias individuales de tenis de mesa, reemplazando procesos manuales basados en Excel.

Desarrollador actual: una sola persona.

## Tecnologías

- Next.js, React y TypeScript.
- Tailwind CSS.
- Supabase Auth y PostgreSQL.
- Desarrollo con VS Code y Codex.

## Migraciones existentes

- `001_base_segura.sql`: perfiles, temporadas y fechas.
- `002_identidad_deportiva.sql`: localidades, asociaciones, clubes y jugadores.
- `003_categorias_competencias.sql`: categorías, niveles, reglamentos, competencias y control deportivo.

Las tres migraciones están aplicadas en Supabase. No modificarlas retroactivamente.

- `004_inscripciones.sql`: el desarrollador confirmó que su versión histórica ya está aplicada en Supabase, con restricciones de cupo. El archivo local contiene la revisión sin máximo y NO debe reaplicarse. Incluye solicitudes individuales, decisiones documentadas, historial, RLS y RPC.
- `005_eliminar_cupo_maximo.sql`: aplicada en Supabase según confirmación del desarrollador. Verificación manual completada: función y trigger de cupo máximo eliminados y ambos validadores sin referencias a cupo_maximo. No reaplicar 004 ni modificar 001–005; 006 retira la dependencia de tarifa (preparada, no aplicada remotamente); 007 queda reservada para programación deportiva.

## Funcionalidades implementadas

- Inicio público básico.
- Autenticación y acceso por roles.
- Panel Administrador.
- Administración de temporadas y fechas.
- Catálogos de localidades, asociaciones y clubes.
- Registro y administración de jugadores.
- Categorías y niveles.
- Reglamentos y categorías por temporada.
- Competencias por fecha y resumen de jornada.
- Panel del Juez General: primera versión de Preparación Deportiva.
- Panel del Juez General: habilitaciones deportivas por categoría y temporada.

Último informe de Codex: 100 pruebas automatizadas aprobadas, ESLint y TypeScript correctos. Las pruebas no sustituyen una revisión integral en producción.

## Reglas fundamentales

- Cada fecha corresponde a una jornada de torneo.
- Cada jornada puede incluir múltiples categorías individuales.
- Los partidos de distintas categorías pueden desarrollarse simultáneamente en mesas diferentes.
- El Juez General coordina mesas, árbitros y partidos.
- Deben evitarse conflictos horarios de mesas, jugadores y árbitros.
- Un jugador puede arbitrar si está habilitado y no existe conflicto.
- Dobles está excluido definitivamente, también de futuras versiones.
- No inventar criterios deportivos que no estén documentados o validados.

## Información actual

- Temporada 2026 registrada.
- Jornadas del 7 y 14 de noviembre registradas en Supabase según la última consulta de Codex.
- Que una fecha esté publicada en el sistema no acredita por sí solo su confirmación oficial.
- Diez combinaciones individuales configuradas para 2026.
- Reglamento 2026 inicialmente registrado como pendiente de validación.
- Tarifas y plazos deben respetar las Bases aplicables y las aprobaciones correspondientes.

## Arquitectura propuesta

Consultar `documentacion/arquitectura-programacion-jornadas.md`.

La migración 004 corresponde a inscripciones y 005 a la corrección del máximo heredado. La programación operativa de partidos queda para una futura migración 007, todavía sin crear ni implementar. La 006 queda destinada a retirar la dependencia de tarifa y preparada para aplicación manual.

## Juez General: Preparación Deportiva rápida (2026-11-12)

- Se conserva la ruta `/panel/juez-general/preparacion`, ahora con tabla editable de
  todas las competencias individuales de la jornada. Horario, formato y sets faltantes
  se completan en una pantalla; selección conjunta para guardar y aprobar. No se
  impone secuencia entre categorías ni máximo general de participantes.
- El botón de horarios propone únicamente los diez horarios del **7 de noviembre de
  2026**, comunicados expresamente por el desarrollador, sin guardarlos ni sobrescribir
  horarios existentes/editados. No aparece ni traslada horarios al 14 de noviembre.
- Mínimo cuatro y grupos tres/cuatro: opción común explícita, solo rellena valores
  vacíos y exige confirmación del Juez sobre las Bases aplicables, reglamento validado
  y referencia de aprobación verificados en servidor. Conserva excepciones guardadas;
  no valida reglamentos pendientes ni deduce reglas deportivas por sí mismo.
- Sets: valores comunes elegidos manualmente una sola vez, o plantilla aprobada y
  completa de la misma categoría por temporada, reglamento y formato. La fuente y su
  auditoría se revalidan en servidor; se copian solo etapas ausentes y sus referencias.
  No se infiere compatibilidad entre categorías diferentes ni se cambian sets existentes.
- Guardado múltiple reutiliza savePreparation y saveStageFormat, con sesión, RLS,
  revisión del borrador y validaciones vigentes. Cada borrador/etapa es independiente:
  se informa éxito o error por competencia y etapa, sin simular una transacción global.
  Los borradores incompletos se conservan y no se presentan como aprobados. Los valores
  comunes se conservan para reintentar; las filas recargadas reflejan los datos guardados.
- Estados: requisitos pendientes, lista para revisar y aprobar, aprobada o solo lectura.
  Aprobación en formulario separado, con resumen guardado, selección y confirmación
  documental explícitas; cada aprobación pasa por approvePreparation y los triggers
  de PostgreSQL. Se comparan revisión del control y huella de sets antes de aprobar;
  cambios concurrentes, fallos o ausencia de auditoría no anuncian éxito.
- Configuración avanzada conserva el componente existente para excepciones y edición
  individual. Motivo/referencia excepcional aparecen al solicitar mínimo inferior a
  cuatro; la ocurrencia horaria aparece únicamente para horas ambiguas de Santiago.
  Aprobadas, publicadas y estados operativos continúan en lectura. No se implementa
  retiro de aprobación, grupos, mesas, partidos, ranking ni Dobles.
- Archivos nuevos: src/components/quick-preparation-table.tsx,
  src/lib/preparacion-rapida.ts, src/app/panel/juez-general/preparacion/quick-actions.ts
  y tests/preparacion-rapida.test.mjs. Se actualizan la página, el formulario avanzado,
  pruebas existentes de preparación y esta documentación.
- Comprobación: elegir temporada/jornada → seleccionar todas las editables → completar
  horarios (propuesta explícita solo el día 7), formato y sets comunes o plantillas →
  confirmar respaldo de condiciones habituales si corresponde → guardar → revisar los
  resultados individuales y recargar → abrir revisión de guardados → seleccionar las
  listas y confirmar expresamente → aprobar → comprobar resultados y estados.
- Verificación final: 101/101 pruebas pertinentes aprobadas (20 nuevas de preparación rápida),
  TypeScript y ESLint focalizado sin errores. Pruebas con base simulada persistente
  y acciones reales del módulo, sin conexiones,
  SQL ni modificaciones en Supabase real. Incluyen diez categorías, guardado parcial,
  configuraciones incompletas, reutilización, concurrencia, roles y aprobación.
  La comprobación manual autenticada en Supabase sigue pendiente. Migraciones 001–005
  sin modificaciones; las validaciones deportivas de 003 permanecen vigentes.

## Juez General: Habilitaciones Deportivas

- Ruta `/panel/juez-general/habilitaciones`, con selección de temporada/categoría,
  búsqueda por nombre o ID y filtros por resolución, tipo, actividad y cuenta.
- Jugadores sin cuenta y homónimos se revisan individualmente por ID. Se muestran
  nacimiento, club, procedencia, reglas vigentes y motivo/referencia de la resolución.
- Estados reales de 003: pendiente, habilitado, no_habilitado; tipos ordinaria y
  excepcion_documentada. Sin registro se muestra «Sin resolución», no una habilitación.
- Validación de nacimiento por rango inclusivo de años; no se infieren edad, sexo ni
  condición federativa del nombre/club. Habilitar exige revisión documental explícita,
  motivo, referencia y reglas validadas. Una excepción no omite reglas pendientes.
- Acciones solo juez_general con sesión y RLS; sin cambios de identidad, auditoría
  enviada por el cliente, borrados ni inscripción automática. Se comparan los campos
  actuales antes del UPDATE para evitar sobrescrituras concurrentes. 003 conserva la
  resolución actual y su validación, no un historial inmutable de todas las revisiones.
- Verificación: 56 pruebas focalizadas (20 nuevas), ESLint y TypeScript. Se utilizaron
  clientes Supabase simulados; no se ejecutó SQL ni se alteraron datos reales.
- Comprobación manual: entrar como Juez → Habilitaciones deportivas → temporada y
  categoría → buscar jugador → revisar reglas/antecedentes → registrar resolución
  explícita y comprobar confirmación. Administrador, Árbitro y Jugador no acceden a
  esta interfaz; no se cambiaron sus permisos existentes de PostgreSQL.

## Corrección oficial: participantes sin máximo general

- No existe máximo general por competencia. Se mantiene el mínimo deportivo y la
  composición de grupos de tres o cuatro, que no limita el total de participantes.
- Se retiraron el campo de cupo, su texto y validaciones de interfaces/tipos activos.
  Nuevos registros no envían cupo_maximo; tampoco se limpian valores anteriores.
- La revisión local de 004 elimina conteos y bloqueo por cupos y reemplaza el validador heredado
  validar_competencia_003 para quitar su comparación máximo/mínimo, conservando las
  demás comprobaciones y permisos. Los archivos 001–003 permanecen intactos.
- Antes de aplicar la corrección 005, el trigger de 003 aún puede rechazar habilitar inscripciones
  si un valor heredado es menor que el mínimo. La pantalla administrativa advierte
  sobre valores no nulos consultados. El desarrollador confirmó mediante consultas de solo lectura que actualmente hay cero competencias con máximo configurado. No se consultó ni alteró Supabase desde esta sesión.
- La futura cantidad de grupos y partidos dependerá de los inscritos/admitidos reales.
  No se implementa ese cálculo aquí. Distribuciones residuales y excepciones de
  composición requieren resolución documentada; no se inventan grupos fuera de Bases.
- Verificación focalizada: TypeScript, ESLint, pruebas de competencias/preparación y
  004 en PostgreSQL temporal, incluidos 103 inscritos elegibles con dato heredado 2,
  concurrencia sin bloqueo por cantidad y conservación del mínimo y de permisos.

## Inscripciones: implementación de base de datos (004)

- Una inscripción histórica por jugador y competencia; permite distintas categorías
  individuales en la misma jornada, sin deducir automáticamente combinaciones elegibles.
- RPC `solicitar_inscripcion(jugador, competencia, referencia_representacion)`:
  Cualquier cuenta vinculada a jugadores.perfil_id puede solicitar para sí misma,
  incluido Árbitro o Juez General. Solo Administrador puede registrar solicitudes
  ajenas o sin cuenta, con evidencia de representación. El vínculo no otorga cargos.
- Solicitud inicial `pendiente`. No hay máximo general de participantes; no hay lista
  de espera. Es una decisión técnica conservadora, no una regla deportiva de las Bases.
- RPC `resolver_inscripcion(id, estado, motivo, referencia)`: Juez General puede
  pasar pendiente a aceptada/rechazada. Administrador puede instrumentar una
  cancelación documentada desde pendiente/aceptada. Rechazada/cancelada son terminales;
  no se borran ni reactivan, y no hay cancelación autónoma del Jugador.
- Solicitud y aceptación revalidan jugador activo, habilitación vigente (ordinaria
  con nacimiento actual o excepción documentada), categoría y reglamento validados,
  aprobación deportiva, competencia preparada/activa/publicada, jornada publicada,
  tarifa configurada. Solo la solicitud exige inscripciones habilitadas y
  período actual `[apertura, cierre)`. Apertura y cierre originales se conservan
  en columnas inmutables, con CHECK de presentación dentro del plazo original.
- Instantes `timestamptz`, día deportivo en America/Santiago; reloj comprobado después
  de esperar bloqueos. El Juez puede aceptar o rechazar después del cierre una
  solicitud presentada a tiempo, incluso si se deshabilitaron nuevas solicitudes.
  La aceptación revalida elegibilidad y evidencia y exige
  instante anterior al inicio programado. No se aceptan competencias en curso,
  suspendidas, finalizadas o canceladas, ni preparada cuyo inicio ya se alcanzó.
  No se implementa excepción para admitir participantes después del inicio.
- Bloqueo transaccional compartido con 003 y bloqueo de competencia; READ COMMITTED
  obligatorio. Otros niveles se rechazan explícitamente para evitar conteos obsoletos.
  No existe validación por máximo general. La serialización global
  prioriza consistencia y sencillez para el MVP; puede limitar rendimiento futuro.
- Escrituras únicamente mediante RPC con autorización interna; RLS limita lectura
  del resumen deportivo al titular y operadores. El resumen usa una lista cerrada
  de campos, sin evidencias, documentos, motivos privados ni UUID de validadores.
  Historial íntegro reservado por RLS a Administrador/Juez General conserva decisiones,
  actores y evidencia aunque se borre la cuenta Auth. Las columnas administrativas
  de la fila actual no tienen SELECT para authenticated; los operadores consultan
  resoluciones y respaldos en el historial. SELECT * de inscripciones se rechaza:
  futuras consultas deberán seleccionar explícitamente las columnas deportivas.

### Auditoría de seguridad RPC de 004

- Las únicas RPC nuevas autorizadas a authenticated son solicitar_inscripcion y
  resolver_inscripcion. Cada una comprueba auth.uid() y autorización dentro de la
  base antes de tomar bloqueos; llamar directamente a la API no elude controles.
  Una identidad ajena o inexistente recibe el mismo rechazo para usuarios sin
  permiso administrativo. El trigger repite la comprobación sobre el vínculo vigente.
- Las dos funciones internas SECURITY DEFINER están en privado_inscripciones,
  sin USAGE ni EXECUTE de clientes. No añadir este esquema a exposed schemas de
  PostgREST. Los triggers funcionan con su propietario de migración y no son RPC.
- Las cinco funciones de 004 usan search_path vacío y relaciones/funciones de
  aplicación calificadas. No hay SQL dinámico con entradas del cliente; se probaron
  objetos temporales homónimos y metadata de rol falsa sin escalada de privilegios.
  Las RPC son VOLATILE (POST para mutaciones); una transacción de solo lectura
  rechaza la escritura. No se añadió una segunda variante u overload de las RPC.
- Se revoca EXECUTE de PUBLIC/anon y de las funciones internas a authenticated.
  También se revocan privilegios por defecto de service_role si existe: el módulo
  necesita la sesión del usuario, no una clave de servicio. Las escrituras directas,
  cambios de vínculo no administrativos, auditoría y borrados quedan denegados.
- El propietario de las funciones debe ser el propietario confiable de la migración
  y las tablas, nunca anon/authenticated ni un rol controlado por clientes. El dueño
  SQL sigue siendo una frontera de confianza: RLS no protege contra el propietario.
- Se revisaron las dependencias SECURITY DEFINER de 001–003 sin modificar esos
  archivos: funciones de rol basadas en perfiles, search_path vacío y triggers sin
  EXECUTE de clientes. La prueba comprueba esos invariantes por catálogo.
- La autenticidad del JWT la verifica Supabase/PostgREST. La simulación local de
  claims comprueba autorización SQL, pero no sustituye una prueba HTTP en un
  Supabase aislado con su configuración real de exposed schemas y roles heredados.
- Revisión final focalizada: no existe configuración PostgREST versionada en el
  repositorio ni se consultó el proyecto remoto. La ausencia del esquema privado en
  exposed schemas **no está verificada en Supabase real**; sigue pendiente comprobarla
  en el despliegue. Localmente se comprobó falta de USAGE/EXECUTE para clientes.
- No se encontraron usos de service_role ni Auth Admin en el código de aplicación:
  los clientes usan sesión y clave pública. Las revocaciones de 004 afectan solo sus
  objetos nuevos, sin modificar privilegios de Auth, catálogos ni migraciones previas.
  La suite compara sus ACL antes/después de 004 con una captura temporal previa
  (instrucciones en la cabecera de la prueba). Una futura integración de servicio
  con inscripciones requerirá permisos específicos y revisión, no una concesión global.

### Reglas pendientes y límites documentales

Se contrastaron las secciones 3, 6–8 y 22 de las Bases con la hoja Grupos del Excel
de cuarta fecha. El Excel muestra participantes/grupos, no prueba autorizaciones,
pagos ni reglas de cancelación. No se importaron personas ni valores oficiales.

- Las Bases mencionan transferencia bancaria, no permiten asumir pago presencial
  ni pago realizado por inscribirse. 004 no registra ni acredita pagos, no integra
  pasarela y no automatiza devoluciones; control de cobros queda pendiente.
- Las restricciones de participación simultánea, condición federativa, rama,
  cambios durante temporada y casos excepcionales requieren revisión documentada
  del Juez General. No pueden derivarse automáticamente de las tablas actuales.
  La aceptación exige motivo y referencia que cubran la elegibilidad y combinación
  de categorías de la jornada; no existe un clasificador automático para esas reglas.
- Cancelaciones, reembolsos y reinscripciones no tienen política general explícita
  en las Bases revisadas. La cancelación administrativa exige resolución externa;
  no establece un derecho automático ni una política nueva de la Liga.
- No se generan automáticamente plazos del jueves a las 20:00, ascensos por falta
  de participantes ni excepciones. Deben configurarse/aprobarse según la fecha.
- Una aceptación conserva su historia si luego cambia la habilitación o identidad:
  futura 007 deberá revalidar admisión antes de programar encuentros reales.
- Interfaz del Juez implementada en /panel/juez-general/inscripciones: comprueba el rol en servidor,
  usar sesión del usuario y las RPC, sin claves privilegiadas en el navegador.

### Verificación aislada de 004

PostgreSQL 18 local, cluster temporal en loopback puerto 55404, base `liga_004_test`.
Se aplicaron desde cero 001–004 con esquema Auth mínimo de prueba (`auth.users`,
`auth.uid()` a partir de claims y roles anon/authenticated), sin conexión a Supabase.
No sustituye una prueba posterior contra Auth/PostgREST de un entorno Supabase aislado.

Se ejecutaron las suites SQL 002, 003 y
`supabase/tests/004_inscripciones.test.sql`: múltiples categorías, duplicados,
referencias inválidas, roles/RLS, representación, historial, decisiones/cancelaciones,
ausencia de máximo general, elegibilidad vigente/excepciones, apertura/cierre y aislamiento.
La suite 004 usa dblink y fixtures sintéticos persistentes exclusivamente en esa base
temporal; verifica dos conexiones inscribiéndose por encima del dato heredado y cierre durante espera.
La ampliación se ejecutó con privilegios por defecto amplios para anon,
authenticated y service_role, verificando las revocaciones explícitas de 004.
Comprueba Árbitro/Juez con identidad vinculada, ausencia de permisos
adicionales, aceptación/rechazo después del cierre real, habilitación revocada,
estados deportivos iniciados/finalizados, inicio horario alcanzado y controles RPC.
La revisión de privacidad agrega marcadores sintéticos de datos sensibles, lista
cerrada de claves JSON visibles, denegación de referencias y UUID administrativos,
historial solo para operadores y llamadas directas rechazadas a service_role.
No ejecutar esa suite en producción; rechaza otro nombre de base/puerto/dirección.
Las migraciones anteriores permanecen intactas. No se ejecutó SQL en Supabase.

## Próximas etapas

### Verificación temporal de 005

- Runner: `node supabase/tests/005_eliminar_cupo_maximo.test.cjs`, exclusivamente contra PostgreSQL 18 temporal en 127.0.0.1:55404 y base nueva `liga_004_test`. Fixture histórico extraído de Git `829a9c6`; no ejecutar ese fixture en Supabase.
- Simula 001–003 y la 004 histórica antes de aplicar 005. Rechaza deriva del cuerpo, SECURITY DEFINER y trigger deshabilitado, y rechaza reaplicación. Compara exactamente ACL de funciones/tablas/esquemas/columnas, propietarios, OID de validadores y constraints deportivos antes/después.
- Ejecuta después la suite integral 004: 103 elegibles con cupo heredado 2 sin limpiarlo, concurrencia, mínimo y grupos conservados, autorización, RLS, privacidad y plazos. Las pruebas SQL usan identidades sintéticas y no verifican JWT/PostgREST reales.
- Riesgo de despliegue: comparación textual estricta contra la revisión histórica; cualquier diferencia remota, incluso de formato, detiene 005. No retirar esta comprobación para forzar su ejecución. El esquema privado debe seguir fuera de PostgREST.

1. Comprobar manualmente Resolución de Inscripciones en un entorno autorizado; 001–005 ya aplicadas según confirmación del desarrollador. NO reaplicar 004.
2. Verificar habilitaciones en entorno Supabase autorizado; interfaz implementada.
3. Programación de grupos, partidos y mesas.
4. Panel operativo del Juez General.
5. Árbitros, marcadores y actas.
6. Clasificación, eliminación y ranking.
7. Resultados públicos.
8. Pruebas integrales, PWA y despliegue.

## Reglas para Codex

- Leer AGENTS.md y este resumen.
- Inspeccionar solamente los archivos relevantes para la tarea.
- Trabajar en módulos pequeños.
- No modificar registros reales de Supabase sin autorización.
- No exponer credenciales ni documentos privados.
- No reescribir migraciones anteriores.
- Ejecutar las pruebas pertinentes y reportar los resultados.
- Actualizar este resumen al completar cada módulo.

## Juez General: Resolución de Inscripciones (2026-11-04)

- Ruta `/panel/juez-general/inscripciones`, enlazada desde el inicio y navegación
  del Juez. Selección encadenada temporada → jornada → competencia individual,
  búsqueda por nombre/ID, filtros por los cuatro estados y páginas de 25 solicitudes.
  Consultas por lotes sin un máximo general de participantes.
- Muestra jugador, categoría, club, instante de solicitud en America/Santiago,
  pendientes y participantes aceptados. Seleccionar una solicitud permite revisar
  nacimiento, actividad, habilitación vigente y evidencia, reglas de elegibilidad,
  otras solicitudes del jugador en la jornada, resumen conservado e historial completo
  con decisiones, actores, fechas y respaldos deportivos privados para operadores.
- Las decisiones pendiente → aceptada/rechazada exigen motivo, referencia documental
  y revisión explícita. Única escritura: RPC resolver_inscripcion con sesión del
  usuario. Página y acción comprueban juez_general en servidor; RLS y restricciones
  de 004/005 siguen vigentes. No se usan claves privilegiadas ni escrituras directas.
- RPC devuelve void: se releen fila e historial y se comprueban inscripción,
  competencia, transición, actor, motivo, referencia e instante antes de anunciar
  éxito. Errores, registros ausentes, cambios concurrentes o confirmación incompleta
  no anuncian éxito; se indica recargar antes de reintentar. La recarga usa router.refresh.
- Estados de preparación, condiciones administrativas, apertura/cierre e inscripciones
  deshabilitadas se muestran sin impedir resolver solicitudes históricas válidas.
  PostgreSQL revalida elegibilidad, condiciones e inicio al aceptar. No hay aprobación
  automática, acreditación de pago, cancelaciones desde el Juez ni nuevas reglas deportivas.
- Verificación: 22 pruebas nuevas focalizadas aprobadas con Supabase simulado,
  incluyendo acciones, denegación por rol, parámetros cerrados, respuestas incompletas,
  selección cruzada, búsqueda/filtros, historial y renderizado seguro. Suite general:
  165/165 pruebas aprobadas.
  TypeScript y ESLint focalizado comprobados. ESLint global detectó cinco errores
  preexistentes no modificados de no-require-imports en los scripts CommonJS
  supabase/tests/005_eliminar_cupo_maximo.test.cjs y supabase/tests/generar-005.cjs.
  No se ejecutaron SQL, RPC ni escrituras contra Supabase real; queda pendiente
  comprobar el flujo con Auth/PostgREST y cuentas autorizadas en un entorno de prueba.
- Archivos: src/lib/inscripciones.ts; src/components/registration-decision-form.tsx;
  src/app/panel/juez-general/inscripciones/page.tsx, actions.ts y loading.tsx;
  src/components/judge-navigation.tsx; src/app/panel/juez-general/page.tsx;
  tests/inscripciones.test.mjs y esta documentación. Migraciones 001–005 intactas.
- Comprobación manual: entrar como Juez → Resolución de inscripciones → elegir los
  tres ámbitos → buscar/filtrar → revisar solicitud e historial → registrar una
  aceptación/rechazo solo sobre datos de prueba autorizados, con motivo y referencia →
  recargar y verificar estado, pendientes/aceptados e historial. Probar otro rol,
  campos vacíos, dos sesiones sobre la misma solicitud y pérdida de conexión.
  Grupos, mesas, partidos y ranking continúan pendientes.

## Comandos de verificación

- `npm run lint`
- `npx tsc --noEmit`
- `node --test tests/*.test.mjs` cuando corresponda.

No ejecutar pruebas SQL destructivas en Supabase de producción.

## Renovación visual e identidad oficial (2026-11-12)

### A. Identidad y autenticación

- Paleta oficial: azul marino #082554, celeste #539DDF, verde #3E871D y
  amarillo #F6BA2A, con fondos blancos y grises. Se retiran los acentos rojos
  genéricos de componentes, portada, manifiesto e iconos instalables.
- Logo completo en encabezado, portada y acceso/registro, conservando proporciones.
  Iconos PNG de 192 y 512 derivados del mismo logo, sin recortes, sobre fondo blanco.
  Caché pública del service worker incrementada a v2 para renovar los iconos.
- Encabezado asíncrono: verifica claims de Supabase en servidor y consulta perfiles.
  Visitantes ven Ingresar/Registrarse; sesiones válidas ven menú con nombre, rol,
  Mi panel y Cerrar sesión. No se renderiza un estado invitado inicial en cliente.
  Si existe sesión pero falla el perfil, se informa y se conserva la salida sin
  atribuir permisos. Mi panel usa ROLE_PATHS; /panel mantiene sus guardas reales.
- Cierre mediante Auth.signOut, comprobación de error, revalidación del layout y
  redirección al inicio. Ante fallo se comunica el problema y no se anuncia salida.
  Los eventos de Auth y volver a enfocar la ventana refrescan la lectura del servidor;
  no se utilizan roles del navegador ni metadata para autorizar.

### B. Componentes y navegación

- Sistema común en globals.css y tailwind.config.ts: botones, campos, tarjetas,
  mensajes, tablas, etiquetas de estado, confirmaciones, vacíos y carga. Foco visible,
  enlace para saltar al contenido, controles de al menos 44px y campos a 16px.
- DashboardShell incorpora navegación lateral en escritorio y menú desplegable
  nativo en móvil. Reutiliza AdminNavigation/JudgeNavigation, con sección activa
  según la ruta. Solo se enlazan módulos existentes y acceso público al calendario.
- Tablas con desplazamiento horizontal local, región enfocable por teclado y
  encabezados uniformes; filtros de búsqueda apilados en móvil. Se conservan las
  tablas editables y todas las acciones y validaciones existentes.

### C. Aplicación a módulos y comprobación

- Inicio y autenticación con logo; calendario con tarjetas y vacío compartidos.
  Paneles Administrador, Juez, Árbitro y Jugador reciben el shell común. Preparación
  rápida, habilitaciones, inscripciones y formularios administrativos heredan los
  controles y colores; preparación resalta estados y revisión de aprobación.
- Archivos principales: src/components/header.tsx, auth-refresh.tsx,
  dashboard-shell.tsx, admin-navigation.tsx, judge-navigation.tsx, auth-form.tsx,
  date-list.tsx; src/lib/auth.ts; src/app/actions.ts, layout.tsx, globals.css,
  page.tsx, login/page.tsx y manifest.ts; tailwind.config.ts; public/icons y sw.js.
  Ajustes visuales puntuales en formularios, listados con tablas y pantallas loading.
- Pruebas: tests/auth-header.test.mjs incorpora 19 casos de visitante, cuatro roles,
  salida real mediante acción con cliente simulado, fallo de salida, perfil ausente,
  metadata manipulada, guardas y suscripción/limpieza de eventos de Auth. Se adapta
  el mock de navegación de tests/preparacion-deportiva.test.mjs al uso de pathname.
- Verificación: 204/204 pruebas Node aprobadas; npm run typecheck y ESLint de
  src, tests y tailwind.config.ts sin errores. npm run lint global continúa con
  cinco errores preexistentes de no-require-imports en los dos scripts CommonJS
  supabase/tests/005_eliminar_cupo_maximo.test.cjs y supabase/tests/generar-005.cjs.
- Revisión local de inicio y login en navegador: enlaces y campos accesibles,
  color principal calculado #082554 y sin desbordamiento horizontal de página en
  el ancho móvil disponible (469px). El navegador integrado presenta errores de
  conexión WebSocket de HMR; no se verificó actualización en caliente fiable.
- Pendiente de revisión visual: celular físico de 320–390px, legibilidad del logo
  del encabezado, tablas largas y menús por teclado. Verificar cada panel y el
  ciclo entrar/salir/cambiar de cuenta con cuentas autorizadas en entorno de prueba,
  incluyendo pestañas simultáneas y caducidad de sesión. Las pruebas simuladas no
  acreditan el funcionamiento remoto de Auth/PostgREST. Revisar iconos tras reinstalar
  la PWA y el aspecto de los diálogos nativos del navegador.
- Sin SQL ejecutado, escrituras de datos reales, cambios de migraciones 001–005,
  reglas deportivas, lógica de inscripciones, RLS ni incorporación de Dobles.
  Se conserva el trabajo previo que ya estaba sin confirmar en Git.

## Portada institucional y ranking público (2026-11-12)

- Portada rediseñada con el título «El tenis de mesa que une a Los Ríos», descripción
  institucional y secciones sobre formación, competencia, organización regional,
  calendario, ranking y participación. Se revisó el PDF local Bases 2026: secciones
  1 Organización, 2 Objetivos, 3 Participantes y 9 Ranking, junto con la referencia
  al puntaje general de la sección 7 (páginas 1, 3 y 4). No se releyeron migraciones.
- Las comunas mencionadas corresponden a clubes organizadores descritos en las Bases,
  no a una confirmación de sedes. Calendario conserva exclusivamente su consulta de
  fechas publicadas existente, sin fijar jornadas, cifras de participación ni fechas.
  Se informa sobre habilitaciones, restricciones y el formulario que las Bases indican
  en @ligaregional_losrios; la cuenta PWA no equivale a una inscripción deportiva.
- Encabezado compacto: logo completo proporcional de 64px de alto y nombre legible
  a su lado. Navegación Inicio / Calendario / Ranking / Ingresar. Se elimina registro
  del encabezado y portada; continúa desde login. Hero con solo calendario y ranking,
  sin logo grande repetido ni bloque inferior de creación de cuenta. La sesión real
  conserva su menú, Mi panel por rol y Cerrar sesión, incluso si falla leer el perfil.
- Nueva ruta pública /ranking sin guardas de acceso ni consultas a tablas de jugadores,
  inscripciones o resultados privados. El cálculo interno sigue pendiente: la página
  no afirma que se haya auditado la disponibilidad de resultados en Supabase remoto.
- Acceso explícito al ranking externo de temporada 2026, comprobado en navegador el
  2026-11-12: https://rankingtemporada2026.netlify.app/ranking. Abre en otra pestaña,
  identificado como externo y con noopener/noreferrer. No hay scraping, importación,
  iframe ni reutilización de participantes, puntos o resultados externos.
- PublicRanking es un componente de presentación reutilizable con un contrato cerrado
  de publicación: nombre público, procedencia, posición y puntos ya validados; categorías,
  podio, acumulado, premiación y fechas publicadas. Solo filtra la presentación; no calcula
  posiciones, puntos ni desempates. La ruta entrega publicación nula: filtros desactivados
  y estados informativos, sin podios, jugadores o valores cero ficticios.
- Se explica la regla general de seis mejores puntuaciones de siete fechas (Bases 2026).
  La clasificación provisional externa no se adopta ni se automatiza. Solo individuales;
  no se crean tablas, migraciones 006, motores deportivos ni modalidades adicionales.
- Archivos de esta etapa: src/app/page.tsx, src/components/header.tsx,
  src/app/ranking/page.tsx, src/components/public-ranking.tsx, src/lib/public-ranking.ts,
  tests/auth-header.test.mjs, tests/public-pages.test.mjs y este documento.
- Verificación: TypeScript y ESLint focalizado correctos; 27/27 pruebas públicas y de
  autenticación aprobadas (8 nuevas de portada/ranking/calendario/registro, y 19 de Auth
  adaptadas a la navegación simplificada). Renderizado sin guardas ni dependencias
  privadas, estados vacíos, enlace externo seguro y publicación sintética solo en pruebas.
- Comprobación local en navegador sin iniciar sesión: /, /calendario y /ranking renderizan;
  mediciones a 320, 390 y 1280px sin desbordamiento horizontal. Ranking mantiene filtros
  inactivos y no presenta filas de clasificación. Encabezado de 89px en escritorio y
  145px en móvil, con navegación en una segunda fila. Persiste el problema de WebSocket
  de HMR del navegador integrado, que limita las pruebas automáticas de clics.
- Revisión manual: abrir / y recorrer las dos acciones deportivas; ir a /calendario y
  /ranking sin sesión; abrir el ranking externo; comprobar login → registro. Con una
  cuenta autorizada, comprobar que Ingresar cambia por el menú del usuario, Mi panel
  lleva a su rol y Cerrar sesión restaura la navegación pública. Revisar 320/390px y
  escritorio, legibilidad y teclado. La prueba autenticada remota sigue pendiente.
- Se mantienen migraciones 001–005, datos reales, RLS, roles, reglas e inscripciones.
  No se ejecutó SQL ni se realizaron escrituras remotas. Se conservó el trabajo previo.

## Autenticación y recuperación de contraseña (2026-11-12)

- Login/registro centrados con max-width de 448px, logo proporcional de 80px, encabezado compacto, enlaces de recuperación/registro, controles de visibilidad, etiquetas y carga mediante useFormStatus. Confirmación de contraseña en registro y restablecimiento; contraseñas conservan espacios y no se truncan.
- Nuevas rutas /recuperar-contrasena y /restablecer-contrasena; callback exclusivo /auth/recovery con verifyOtp recovery, cookies SSR y autorización temporal firmada HttpOnly vinculada a usuario/sesión. Validación en servidor antes de updateUser; rechazo de enlaces inválidos y opción de solicitar otro. Respuesta de solicitud uniforme ante cuentas inexistentes, fallos y límites.
- Origen explícito mediante NEXT_PUBLIC_SITE_URL para ambos callbacks. Sin Host ni destinos arbitrarios. Registro conserva exclusivamente full_name; no admite rol solicitado. Login/registro redirigen sesiones con perfil a su panel por rol. No se cambió el encabezado existente.
- Archivos: src/components/auth-form.tsx, auth-controls.tsx; src/lib/auth-flow.ts, recovery.ts; src/app/actions.ts, recovery-actions.ts, login/page.tsx, registro/page.tsx, recuperar-contrasena/page.tsx, restablecer-contrasena/page.tsx, auth/callback/route.ts, auth/recovery/route.ts; next.config.ts (exclusión de logs de callbacks); tests/auth-flow.test.mjs, auth-header.test.mjs, public-pages.test.mjs.
- Configuración obligatoria, URLs exactas, plantilla Reset Password con TokenHash, secreto del servidor, SMTP, límites y plan manual: [AUTENTICACION.md](./AUTENTICACION.md). No se configuró remotamente Supabase. La política adicional de contraseña la aplica Supabase; pendiente contrastar su configuración real.
- Pruebas focalizadas con clientes simulados: login, errores, roles, registro sin privilegios, respuesta uniforme de recuperación, callback válido/inválido, actualización, coincidencia, autorización firmada manipulada/caducada/sesión ajena, redirecciones externas ignoradas y renderizado. Sin envío real de correos ni escrituras remotas.
- Navegador: login sin desbordamiento a 320, 390 y 1280px, centrado y logo 80px. Persiste error de WebSocket HMR preexistente. Se requiere revisión con correo real y móvil físico.
- Se conservan datos reales, RLS, triggers, migraciones 001–005, módulos deportivos, portada y ranking. Sin nuevas dependencias.
- Resultado final: 49/49 pruebas focalizadas aprobadas; npm run typecheck correcto (se repitió tras una regeneración concurrente de tipos de Next). ESLint focalizado sin errores. npm run lint global conserva cinco errores preexistentes no-require-imports en supabase/tests/005_eliminar_cupo_maximo.test.cjs y supabase/tests/generar-005.cjs; no se modificaron esos scripts.
- Registro, recuperación y estado de restablecimiento sin enlace también comprobados en navegador a 320/390/1280px sin desbordamiento horizontal. El formulario de contraseña nueva con enlace válido se probó mediante simulaciones, no con token remoto.


## Correccion de recuperacion con correo predeterminado (2026-11-12)

- Sustituye el requisito anterior de plantilla TokenHash/SMTP: se conserva ConfirmationURL de Supabase Free. SSR PKCE solicita el correo con state y consume code en /auth/recovery. No se modifico configuracion remota, cuentas ni migraciones.
- Intencion HMAC HttpOnly de una hora, consumida al volver; intercambio PKCE exitoso y evento PASSWORD_RECOVERY del SDK exigidos. Se transmite sb_flow_id cuando existe. Una sesion normal, codigo signup o type en URL no autorizan.
- Se conserva autorizacion HMAC de 15 minutos ligada a usuario/session_id; pagina y accion verifican usuario, claims, sub y firma. Formulario visual intacto. Tras updateUser se elimina autorizacion y se cierra sesion.
- Solicitar correo nuevo y abrirlo en el mismo navegador/perfil/origen; no mezclar localhost con 127.0.0.1 ni contenedores PWA. Las instrucciones vigentes estan en [AUTENTICACION.md](./AUTENTICACION.md).
- Archivos modificados: src/lib/recovery.ts, src/app/recovery-actions.ts, src/app/auth/recovery/route.ts, src/app/restablecer-contrasena/page.tsx, tests/auth-flow.test.mjs y estos dos documentos.
- Validacion automatizada con servicio simulado; entrega real y ciclo remoto de cambio de clave pendientes de prueba manual autorizada.
- Resultado: TypeScript y ESLint focalizado correctos; 59/59 pruebas de autenticacion aprobadas, incluida integracion del SDK SSR real contra transporte simulado (solicitud PKCE, cookies entre clientes, PASSWORD_RECOVERY, updateUser y rechazo de reuso), sin solicitudes remotas.


## Simplificación del Panel Administrador (2026-11-13)

- Se conserva la paleta, el logo y las clases visuales existentes. El título del
  administrador es «Panel de administración»; los demás roles conservan su título
  y navegación. No se modificaron páginas del Juez General, portada, ranking ni Auth.
- El menú lateral agrupa Gestión de la Liga (Temporadas y jornadas, Competencias,
  Jugadores), Organización (Clubes y asociaciones desplegable, Localidades) y
  Configuración (Reglamentos y categorías desplegable: Por temporada, Categorías
  y niveles). Conserva los ocho destinos, sin enlaces duplicados dentro del menú,
  y marca la página activa con aria-current. El grupo activo queda abierto.
  Se mantiene el menú móvil desplegable y no se agregan animaciones.
- Se retira la segunda navegación que repetían las seis páginas administrativas,
  el acceso redundante «Mi panel» del administrador y la tarjeta de catálogos del
  inicio. Los catálogos siguen accesibles desde Organización.
- Inicio con resumen de temporadas y jornadas registradas/publicadas, listado de
  número, fecha, comuna, recinto, estado y temporada. «Gestionar competencias»
  abre la ruta existente con temporada y jornada seleccionadas. No se añade una
  edición de jornadas: esa operación no existe actualmente. La dirección deportiva
  permanece exclusiva del Juez General.
- «+ Nueva jornada» es la acción principal y «Nueva temporada» la secundaria.
  Los parámetros crear=jornada o crear=temporada muestran únicamente el formulario
  solicitado; Cancelar vuelve al listado sin guardar. Se conservan exactamente las
  acciones createSeason/createEventDate, campos, opciones y validaciones de servidor.
  Los errores existentes error=fecha/error=temporada reabren el formulario adecuado;
  los mensajes de éxito identifican qué se creó. Los fallos de lectura se explican
  sin presentar recuentos falsos como cero; sin temporadas no se muestra un formulario
  de jornada que no se pueda completar.
- Archivos modificados: [admin-navigation.tsx](../src/components/admin-navigation.tsx),
  [dashboard-shell.tsx](../src/components/dashboard-shell.tsx),
  [inicio administrativo](../src/app/panel/administrador/page.tsx),
  [competencias](../src/app/panel/administrador/competencias/page.tsx),
  [jugadores](../src/app/panel/administrador/jugadores/page.tsx),
  [catálogos](../src/app/panel/administrador/catalogos/[catalogo]/page.tsx),
  [categorías y niveles](../src/app/panel/administrador/categorias-niveles/page.tsx),
  [configuración por temporada](../src/app/panel/administrador/temporadas-deportivas/page.tsx),
  [pruebas nuevas](../tests/admin-presentation.test.mjs) y este documento.
- Verificación: TypeScript y ESLint focalizado correctos. Pruebas de presentación
  y operaciones administrativas con Supabase simulado: 131/131 aprobadas, incluidas
  29 nuevas de agrupación, destinos únicos, sección activa, menú móvil, separación
  de roles, ocho rutas, formularios bajo demanda, guardas y operaciones originales.
  Sin consultas remotas, SQL, migraciones, datos reales, permisos ni reglas alterados.
- Comprobación manual pendiente con cuenta autorizada: abrir el inicio como
  Administrador, comprobar el resumen y recorrer los tres grupos del menú; abrir
  Categorías y niveles y Por temporada desde Configuración. Elegir Nueva temporada
  o + Nueva jornada y Cancelar; solo en un entorno de prueba autorizado, guardar
  datos de prueba y comprobar confirmación y listado, además de errores de validación.
  Abrir Gestionar competencias en una jornada y comprobar los selectores de temporada
  y fecha. Revisar teclado y menú a 320/390px y en escritorio, desplazamiento horizontal
  de tablas, y confirmar que el Juez conserva su navegación y atribuciones.


## Competencias por fecha: vista compacta (2026-11-13)

- La vista principal queda en selectores de temporada/jornada, resumen breve y tabla
  con Categoría, Estado administrativo, Inicio deportivo, Inscripciones y Acción.
  Se retiran de esta página las tarjetas por competencia, métricas extensas y bloques
  de simultaneidad de JourneyOverview; el componente y sus pruebas se conservan.
  Los filtros quedan desplegables y los datos completos se consultan con Ver/Revisar.
- Seleccionar jornada carga las categorías individuales activas de esa temporada.
  Cada categoría faltante ofrece Crear, con la categoría preseleccionada. Las asociadas
  ofrecen Editar y Ver/Revisar, incluso cuando su competencia o categoría esté inactiva.
  Se conservan también competencias cuya categoría no esté disponible en el catálogo.
  No hay escrituras por seleccionar jornada ni creación masiva implícita.
- Crear/Editar abren el formulario solo a petición. Un enlace de creación repetido o
  revalidado tras guardar muestra la competencia ya asociada, sin ofrecer duplicarla.
  La protección final contra duplicados, integridad, cambios concurrentes, RLS y
  reglas administrativas sigue en saveCompetition y PostgreSQL, sin modificaciones.
- Tarifa, apertura y cierre pasan a Configuración avanzada; se abre automáticamente
  ante errores de esos campos o condiciones publicadas/protegidas. Los campos siguen
  enviándose y validándose incluso con el bloque cerrado. La estructura actual no
  define valores administrativos heredables por jornada: no se inventan ni copian
  tarifas o plazos de otras categorías. Mantienen la posibilidad de quedar pendientes.
- Se reutiliza officialStart del módulo existente de preparación rápida exclusivamente
  para el 07-11-2026 y por códigos de categoría/nivel/rama. Se identifica como sugerencia
  sin guardar y nunca sustituye un inicio registrado. Para otras jornadas no hay una
  pauta oficial general confirmada en el repositorio: quedan pendientes, sin extrapolar.
  Editar/guardar horarios y aprobarlos sigue correspondiendo al Juez General, mediante
  su interfaz existente; no se añade al Administrador un permiso deportivo nuevo.
- La tabla usa ancho fijo y filas adaptables con etiquetas en móvil, sin contenedor
  que obligue al desplazamiento horizontal. Fechas e instantes mantienen America/Santiago;
  un inicio fuera del día seleccionado se marca para revisar. Habilitadas sigue siendo
  un indicador administrativo sujeto al plazo, sin afirmar que estén abiertas.
- Se conservan la revisión de plazos, aprobación, bloqueos de inscripciones, tarifa,
  publicación, estados y diagnóstico de valores heredados. No se altera lógica del
  servidor, migraciones 001–005, datos reales, reglas, roles ni permisos. Sin SQL ni
  conexiones remotas. No se modifica la portada, ranking, autenticación ni el Juez.
- Archivos: [página de competencias](../src/app/panel/administrador/competencias/page.tsx),
  [formulario](../src/components/competition-form.tsx),
  [pruebas](../tests/competencias.test.mjs) y este documento.
- Comprobación manual pendiente: seleccionar temporada/jornada, comprobar las cinco
  columnas y Crear únicamente en las categorías faltantes; abrir/cancelar creación,
  Editar y Ver/Revisar. En un entorno de prueba autorizado, guardar un borrador y
  comprobar que la categoría pasa a asociada sin un segundo Crear; probar duplicado
  y errores de tarifa/plazos. Revisar Configuración avanzada y los bloqueos originales.
  Comparar el 07-11-2026 con otra jornada y un inicio ya guardado. Revisar a 320/390px
  y escritorio, filtros, teclado y acceso del Juez a su edición manual de horarios.
- Verificación final: TypeScript y ESLint focalizado sin errores; 120/120 pruebas
  aprobadas de competencias, presentación administrativa y preparación deportiva.
  Incluyen siete casos nuevos de tabla compacta, categorías faltantes/inactivas,
  formularios a petición, sugerencias limitadas a su jornada, horarios guardados,
  inicio fuera de fecha y campos avanzados. Pruebas con datos y clientes simulados;
  queda pendiente comprobar visualmente el flujo autenticado y el móvil físico.


## Competencias: Gestionar y retirada visual de importes (2026-11-13)

- La tabla compacta conserva diseño, navegación y responsive. Las competencias
  existentes tienen una sola acción Gestionar; Crear sigue reservado a las faltantes.
  gestionar selecciona una única instancia de CompetitionForm para consulta/edición.
  editar/revisar anteriores siguen como alias, sin otra pantalla. Campos protegidos
  por publicación/inscripciones conservan lectura; si la categoría no está disponible,
  la gestión muestra solo lectura y mantiene un regreso al listado utilizable.
- Se retira el campo de tarifa y la visualización monetaria del formulario y revisión
  administrativa. Configuración avanzada contiene solo plazos. saveCompetition filtra
  el campo financiero enviado por el cliente y omite tarifa_clp en INSERT/UPDATE:
  no borra valores existentes ni introduce ceros o importes ficticios. Se mantienen
  las validaciones de plazos, categoría, publicación, aprobación, roles y PostgreSQL.
- Dependencia de base comprobada en las definiciones locales 003–005: el CHECK de
  habilitación exige tarifa_clp no nula; el trigger validar_inscripcion, mediante
  privado_inscripciones.validar_inscripcion_004(), la exige para pendientes/aceptadas.
  Afecta solicitar_inscripcion y aceptar con resolver_inscripcion. 005 no eliminó
  estas condiciones. Nuevos borradores sin tarifa se guardan, pero sus inscripciones
  seguirán bloqueadas hasta un cambio de esquema revisado. No se falsea disponibilidad.
- La interfaz explica el requisito heredado pendiente sin pedir importes. El Juez
  no puede seleccionar Aceptar si falta ese requisito; Rechazar sigue disponible
  con resolución documentada. Los rechazos de RPC siguen sin anunciar éxito.
- Antecedentes e historial deportivos filtran tarifa_clp recursivamente al presentarse,
  incluso en snapshots anidados. Se conservan los JSON originales y sus evidencias.
  Se retira también la referencia a pagos del texto de confirmación del Juez.
- El panel Jugador actual no tiene formulario de inscripción implementado: es una
  pantalla informativa. No se implementó un flujo ficticio ni se llamó a sus RPC.
- Propuesta exacta de cambio de CHECK/validador, snapshots y pruebas futuras, sin SQL:
  [PROPUESTA_RETIRAR_TARIFA.md](./PROPUESTA_RETIRAR_TARIFA.md). Pendiente de revisión;
  no se modifica/aplica ninguna migración ni se ocupa la reservada 006.
- Archivos: página y acción de competencias, competition-form.tsx, lib/competencias.ts,
  lib/inscripciones.ts, página del Juez de inscripciones, registration-decision-form.tsx,
  pruebas de competencias/inscripciones y estos documentos. Sin cambios en datos reales,
  columnas, migraciones 001–005, Auth, portada, ranking, roles ni RLS. Sin SQL ejecutado
  ni consultas remotas; la revisión del esquema real permanece pendiente.
- Comprobación manual: elegir jornada y Gestionar una competencia, consultar/cambiar
  únicamente campos permitidos y volver; probar enlaces anteriores y una categoría
  no disponible en lectura. Verificar ausencia de importes en formulario, antecedentes
  e historial del Juez. En entorno autorizado, comprobar guardado conservando valores
  históricos y que una competencia sin el requisito heredado no permita habilitar
  ni aceptar, con explicación visible y rechazo disponible. Revisión móvil pendiente.
- Verificación final: TypeScript y ESLint focalizado correctos; 149/149 pruebas
  de competencias, inscripciones, presentación administrativa y preparación deportiva
  aprobadas. Siete casos nuevos cubren acción única y alias, lectura, ausencia de
  importes, conservación de valores heredados, bloqueo sin valores ficticios,
  filtrado no destructivo de antecedentes y aceptación deshabilitada con rechazo
  disponible. Se mantienen las pruebas de error RPC/confirmación y validaciones.
  Todo con clientes/datos simulados; no certifica el esquema remoto ni un formulario
  de inscripción del Jugador, actualmente inexistente.


## 006: retirar dependencia de tarifa en PostgreSQL (preparada, no aplicada remotamente)

- Autorizada la preparación de [006_retirar_dependencia_tarifa.sql](../supabase/migrations/006_retirar_dependencia_tarifa.sql).
  No existía otra 006. 007 queda reservada para programación deportiva; se actualiza
  AGENTS.md y la propuesta anterior. Migraciones 001–005 intactas.
- Dos cambios de esquema: el CHECK de habilitación deja de exigir tarifa_clp no nula,
  y validar_inscripcion_004 retira únicamente esa condición al solicitar/aceptar.
  El cuerpo restante es idéntico al vigente tras 005. Los datos, snapshots históricos
  y nuevos, columna nullable y CHECK no negativo permanecen; no hay DML ni importes
  ficticios. No se modifican validar_competencia_003, RPC, RLS, roles ni autorizaciones.
- Precondiciones estrictas de definiciones/seguridad de validadores, historial y RPC,
  triggers habilitados, RLS, esquema privado y ausencia de cupo heredado de 004.
  El CHECK se identifica por definición exacta y conserva su nombre. Diferencias o
  reaplicación abortan; nunca quitar el guard para forzar. Transacción única, bloqueos
  de competencias/inscripciones, lock_timeout 5s y statement_timeout 60s.
- Nuevo [runner local 006](../supabase/tests/006_retirar_dependencia_tarifa.test.mjs):
  crea su propio clúster PostgreSQL 18 aislado en loopback:55406, sin heredar variables
  PG externas ni usar Supabase. Usa 001–003 + fixture 004 histórica + 005 antes de 006.
  Compara ACL, propietarios, OID de funciones, RLS, políticas, triggers, otras constraints
  y datos/historial antes/después. Prueba deriva, predecesor incorrecto y reaplicación.
  Reutiliza sin modificar la suite integral 004 con todas sus tarifas NULL para validar
  habilitación, RPC, elegibilidad, roles, plazos, 103 inscritos y dos conexiones reales.
- [Pasos exactos para aplicación y verificación manual](./APLICAR_006_RETIRAR_TARIFA.md):
  revisar, probar localmente, ejecutar solo 006 completa una vez en SQL Editor como
  postgres y realizar las consultas de solo lectura documentadas. Ante error, detener
  y revisar/rollback; no reaplicar 004 ni ejecutar fixtures en Supabase real.
- La aplicación conserva por ahora sus bloqueos heredados de falta de tarifa en
  openingBlockers y el formulario del Juez. Retirarlos de forma coordinada únicamente
  después de verificar que 006 está aplicada remotamente. SQL preparado no equivale
  a despliegue ni a disponibilidad nueva de botones. No se implementa Panel Jugador,
  programación de partidos, pagos ni gestión financiera.
- No se consultó Supabase ni se ejecutó SQL remoto. La estructura remota no se certifica:
  el guard la comprobará al aplicar manualmente. Se conservó el trabajo previo.
- Verificación completada en PostgreSQL 18 local: guard de 006 rechaza ausencia de
  005, deriva de cuerpo, SECURITY INVOKER, trigger deshabilitado, EXECUTE indebido,
  RLS desactivada, CHECK alterado, CHECK monetario adicional y reaplicación.
  Aplicación válida conserva datos e historial completos, ACL, propietarios, OID de
  funciones, columnas, políticas, triggers y constraints ajenas. Compatible con/sin
  el permiso heredado de service_role en el validador 003. Suite integral 004 adaptada
  en memoria, sin cambiar sus archivos: habilitar/solicitar/aceptar sin tarifa,
  rechazos/cancelaciones, elegibilidad, identidad, auditoría, plazos, aislamiento,
  103 inscritos y concurrencia real aprobados; todas las competencias siguen en NULL.
  Clúster temporal detenido y eliminado. TypeScript, ESLint focalizado y 79/79 pruebas
  Node de competencias/inscripciones correctos. Se corrigieron durante la prueba
  una expresión CASE del guard y la identidad sintética entre conexiones del runner.
