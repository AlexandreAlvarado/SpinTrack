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


## Resultados por set: revisión de la migración 013 (2026-11-14)

La migración 012 permanece sin modificaciones. Según el estado informado por el desarrollador, está aplicada en Supabase; la migración 013 está preparada y aún no se ha aplicado.

- El Juez General asigna un árbitro por partido confirmado. La asignación, reemplazos y correcciones quedan auditados.
- El Árbitro solo ve sus partidos asignados, registra los puntos y envía una revisión. El Juez General confirma o devuelve con observación sin reescribir los sets.
- Solo las revisiones confirmadas quedan disponibles para la futura clasificación. No se implementan todavía ranking, desempates, llaves ni programación automática de mesas.
- Se corrigieron textos UTF-8 en los módulos de resultados y se añadió un detector automatizado de mojibake en [text-encoding.test.mjs](../tests/text-encoding.test.mjs).
- TypeScript, ESLint focalizado, pruebas focalizadas de navegación y codificación, y las pruebas PostgreSQL temporales 012 y 013 están aprobados.
- El runner temporal de Windows redirige la salida de pg_ctl.exe y aplica limpieza acotada al proceso de prueba; 012 y 013 finalizaron correctamente en clústeres y puerto aislados. No se ejecutó SQL remoto ni se detuvieron procesos PostgreSQL ajenos.


## Corrección de lectura de Resultados por set (2026-11-15)

Se corrigió la consulta del panel del Juez General: `partidos_arbitros` tiene `partido_id` como clave primaria y no posee `id`. El lector ahora recibe una columna de orden explícita y usa `partido_id` para las asignaciones. Los errores de Supabase siguen interrumpiendo la carga y se muestran como error de lectura; no se convierten en listas vacías. Se agregó una regresión para la clave real y el estado de error. No se modificaron migraciones ni datos remotos.


## Panel del Árbitro: acceso de lectura acotado (2026-11-15)

La consulta de `partidos_arbitros` ya vinculaba `arbitro_id` con el perfil autenticado y filtraba `activo = true`, pero las políticas 011 solo permitían leer `partidos` y `lotes_partidos_grupos` a Administrador y Juez General. PostgreSQL no devolvía error: RLS ocultaba las filas y el panel mostraba una lista vacía. Se preparó [014_acceso_lectura_arbitros.sql](../supabase/migrations/014_acceso_lectura_arbitros.sql), sin aplicarla remotamente, para permitir únicamente partidos, lotes y jugadores que estén vinculados a una asignación activa del Árbitro autenticado. No se agregan filtros por fecha; una jornada pasada sigue siendo visible mientras la asignación esté activa.

El runner PostgreSQL temporal verificó seis partidos asignados, un Árbitro sin asignaciones y un usuario no autorizado. TypeScript, ESLint focalizado, regresiones del panel y detector UTF-8 quedaron aprobados. La migración 014 requiere revisión y aplicación manual antes de probar este acceso en Supabase.

## Clasificación de grupos (2026-11-15)

- Estado informado por el desarrollador: migraciones 001–014 aplicadas. Se conserva el historial anterior; esta sesión no consultó ni ejecutó SQL remoto ni modificó datos reales. Peneca Inicial y sus seis resultados se consideran pruebas y no deben aprobarse ni publicarse como oficiales.
- Nuevo acceso Clasificación de grupos del Juez con selector contextual, tabla compacta con desplazamiento horizontal, PJ/PG/PP, sets y tantos a favor/en contra. PostgreSQL calcula desde resultados ordinarios oficialmente confirmados; capturas pendientes, observadas e incidencias no aportan indicadores. Una corrección pendiente conserva la confirmación anterior, bloquea aprobación y desactualiza la aprobación previa.
- Lectura íntegra de Bases 2026 y contraste con Excel Grupos. §7 no define puntuación, criterio principal, desempates ni plazas de avance. §9 se refiere al ranking anual. Se muestra orden provisional por victorias expresamente pendiente de validación; sin posiciones definitivas ni desempates por sets/tantos. Para aprobar, el Juez debe documentar respaldo de la Liga al criterio, declarar datos reales y tener todos los cruces confirmados sin empate ni revisión pendiente. No se implementan llaves, avance ni ranking.
- Preparada [015_clasificacion_grupos.sql](../supabase/migrations/015_clasificacion_grupos.sql), necesaria para conservar aprobaciones internas inmutables con snapshot, actor, fecha y referencia. RPC con autorización PostgreSQL, RLS de lectura operativa, sin DML directo del cliente ni permisos públicos; bloqueo de partidos, comparación del snapshot y protección frente a aprobación concurrente. Cualquier cambio de fuente desactualiza la aprobación sin borrar historial. Migraciones 001–014 intactas; 015 requiere revisión y aplicación manual.
- Actualización al confirmar/capturar/observar y lectura periódica hasta 15 segundos/al recuperar foco; actualización manual disponible. Fallos de lectura muestran error, nunca una tabla parcial. Sin nueva dependencia de Realtime ni publicación de resultados de prueba.
- Nombres visibles de árbitros y responsables mejorados con perfil autorizado e identificador corto; nombres genéricos marcados pendientes. Sin editar cuentas, roles ni seguridad. Rechazos deportivos esperados registrados como advertencias; errores técnicos conservan registro de error y alerta visible. No se deshabilita el indicador de desarrollo; queda pendiente reproducir visualmente el indicador original en una sesión autenticada.
- Verificación: PostgreSQL 18 temporal 015 con dependencias y regresiones 013/014, indicadores de seis partidos, permisos, observaciones, incidencias, correcciones, empate, snapshots, historial y aprobaciones simultáneas aprobado. TypeScript correcto; 66/66 pruebas Node relacionadas aprobadas; ESLint focalizado correcto. ESLint global detectó errores preexistentes en scripts CJS y archivos de prueba temporales (más una advertencia en 009); no se alteran esos scripts para ocultarlos. Se actualizaron pruebas antiguas de resultados que tenían codificación dañada y expectativas anteriores al flujo Árbitro/Juez vigente.
- Archivos principales: [página](../src/app/panel/juez-general/clasificacion/page.tsx), [acción](../src/app/panel/juez-general/clasificacion/actions.ts), [tabla](../src/components/group-standings.tsx), [tipos y nombres](../src/lib/clasificacion.ts), navegación del Juez, página/acción de resultados e historial de actas. Pruebas [Node](../tests/clasificacion-grupos.test.mjs) y [PostgreSQL](../supabase/tests/015_clasificacion_grupos.test.mjs); detalles y comprobación manual en [CLASIFICACION_GRUPOS.md](./CLASIFICACION_GRUPOS.md). Revisión autenticada y móvil físico pendientes; no equivalen a las comprobaciones locales.

### Revisión focalizada previa a 015 (2026-11-15)

- Se endureció `consultar_clasificacion_grupo`: sesión obligatoria y las dos funciones de rol deben devolver explícitamente `true`; valores `NULL` ya no pueden atravesar la condición de autorización. Se conserva `SECURITY DEFINER`, `search_path=''`, RLS y los permisos existentes.
- Se confirmó la separación entre requisitos técnicos y autorización reglamentaria. La tabla y el orden por victorias siguen provisionales hasta contar con criterio deportivo validado; no se añadieron desempates ni cantidad de clasificados.
- La declaración de datos reales continúa siendo explícita, atribuida al Juez y auditada con referencia. El sistema no puede comprobar la veracidad material; los datos ficticios de Peneca Inicial no deben aprobarse mediante el flujo normal.
- La prueba PostgreSQL 015 ahora ejecuta una carrera entre una corrección y una aprobación con el mismo snapshot. Los bloqueos de grupo/partidos y la comparación transaccional impiden conservar una aprobación vigente sobre una corrección concurrente. También verifica defensas NULL y ausencia de escapes Markdown accidentales en el SQL.
- Verificación focalizada de esta revisión: `node supabase/tests/015_clasificacion_grupos.test.mjs`, 015 aprobado; pruebas Node de clasificación y codificación, 6/6 aprobadas; `npm run typecheck`, aprobado; ESLint focalizado de 015 y sus archivos de clasificación, aprobado. No se ejecutó SQL remoto ni se modificó 001–014 o resultados existentes.


## Flujo del Juez General: primer incremento de panel y navegacion (2026-11-15)

- Estado informado por el desarrollador: migraciones 001 a 015 aplicadas. Esta anotacion conserva el historial anterior. Sin SQL remoto, modificaciones de migraciones, RLS, permisos ni datos reales.
- Revision previa de AGENTS.md, historial y componentes existentes. Confirmaciones independientes conservadas: aprobacion deportiva y respaldo documental; habilitacion y excepciones; nomina y correcciones; grupos definitivos; respaldo del formato y confirmacion del lote; asignaciones y reemplazos; resultados oficiales y clasificacion con declaracion de datos reales. Guardar borradores no equivale a aprobar. No se inventan actas ni referencias.
- [Panel principal](../src/app/panel/juez-general/page.tsx) presenta Preparar competencia, Gestionar partidos y Clasificacion y eliminatorias. Contadores persistidos de habilitaciones, participantes, grupos y partidos de lotes confirmados. Siguiente accion por competencia segun preparacion, habilitaciones, nomina, grupos y lote; despues dirige a revision de asignaciones/resultados, sin afirmar que ya fueron completados. Estados terminales/suspendidos dirigen a consulta.
- [Navegacion](../src/components/judge-navigation.tsx): tres entradas principales; siete herramientas anteriores disponibles en un desplegable. Se conserva contexto explicito en enlaces. [Selector](../src/components/judge-context-selector.tsx) cambia contexto sin boton adicional y materializa valores predeterminados en URL; cambiar temporada/jornada limpia dependencias. Fecha de referencia en America/Santiago. Corregido orden por competencia_id del control deportivo. Error de consulta bloquea tarjetas y acciones derivadas.
- Alcance incremental: no se implementan todavia operaciones multiples nuevas, sustitucion de formularios internos, nuevas precargas, revision unificada ni eliminatorias. Algunas pantallas heredadas, especialmente formularios de habilitaciones, aun pueden descartar contexto al enviar consultas; su adaptacion queda pendiente. La accion de resultados no discrimina aun pendientes, incidencias y clasificacion lista. Las propuestas existentes siguen disponibles en sus herramientas y requieren sus aprobaciones independientes.
- Validacion: TypeScript y ESLint focalizado aprobados; 12/12 pruebas de navegacion, clasificacion y codificacion aprobadas. ESLint global ejecutado: 17 errores no-require-imports en scripts CJS existentes y una advertencia en prueba 009, sin cambios para ocultarlos. Sin comprobacion visual autenticada ni certificacion remota.
- Archivos de este incremento: panel principal, navegacion, selector contextual, tests/judge-navigation.test.mjs y este historial. Se conservaron modificaciones previas del espacio de trabajo.

## Flujo del Juez General: panel compacto e integración visual de preparación (2026-11-15)

- El panel principal conserva las tres etapas y un único selector de temporada, jornada y competencia. Cuando existe una competencia seleccionada muestra una sola vista compacta con el estado de cada etapa y una única acción principal: completar preparación, generar/revisar cruces o revisar resultados.
- Preparar competencia se presenta como el flujo guiado que reúne preparación deportiva, habilitaciones, nómina y grupos mediante las rutas y componentes existentes. Las etapas ya completas se resumen y no abren formularios ni enlaces repetidos en la vista inicial. Herramientas avanzadas quedan contraídas por defecto, sin numeración duplicada.
- Se mantiene la consulta real de Supabase y el bloqueo ante errores de lectura. No se fusionan confirmaciones independientes ni se automatizan aprobaciones humanas. Clasificación permanece disponible en consulta; eliminatorias siguen pendientes.
- Se corrigió el texto visible `Gestión de competencia`. El nombre del encabezado usa el nombre de perfil recortado; si falta, usa el identificador local del correo y finalmente `Usuario`.
- Verificación de este incremento: TypeScript correcto, ESLint focalizado correcto y 7/7 pruebas de navegación, estados, errores de lectura y codificación aprobadas. No se modificaron migraciones, RLS, permisos ni datos reales.

## Flujo del Juez General: segundo incremento, Gestionar partidos (2026-11-15)

- Las rutas de partidos y resultados comparten una sola pantalla. La entrada «2. Gestionar partidos» conserva temporada, jornada y competencia. Resumen de seis contadores reales; partidos agrupados, con nombres y estado de la última revisión. Grupos con envíos pendientes aparecen primero y sus detalles se abren para revisión. Los demás detalles y herramientas avanzadas permanecen contraídos.
- Sin grupos definitivos se explica el bloqueo. Con grupos confirmados, sin lote activo, se reutiliza GroupMatches y sus confirmaciones documentales. Un borrador mantiene la revisión y confirmación del lote; con lote confirmado se muestra directamente la gestión de encuentros, sin formulario de generación. Lotes descartados no se mezclan con el activo.
- Árbitro actual visible; asignación explícita por encuentro, con perfiles jugadores excluidos del propio cruce. No se ofrecen reemplazos cuando existe historial de resultados. Se conserva assignReferee y la RPC asignar_arbitro_partido, que vuelve a comprobar rol, autoarbitraje y restricciones. **Limitación:** esta RPC es individual y no existe una operación múltiple atómica; se conserva el guardado individual, sin simular transacciones ni realizar guardados automáticos.
- Revisión reutiliza ResultCard y las acciones PostgreSQL existentes: sets recibidos, confirmación explícita con referencia y devolución con observación, sin reingreso de puntos. Incidencias permiten devolución, nunca confirmación como resultado ordinario. Historial y responsables conservan identificadores completos y usan nombres de perfiles autorizados cuando están disponibles; no se atribuye una revisión histórica al árbitro actual.
- «Lote de cruces confirmado» y «Resultados completos» son estados independientes. El panel principal consulta resultados, confirmaciones, observaciones y asignaciones para dirigir a asignación, revisión o clasificación. Una corrección pendiente no cuenta como confirmada aunque exista una revisión anterior oficial. Clasificación se ofrece cuando todos los resultados actuales están confirmados; no implica aprobarla ni publicarla.
- Lecturas paginadas, incluidos perfiles; asignaciones inactivas no cuentan. Ante errores se bloquea la vista derivada, sin contadores cero ni disponibilidad ficticia. Guardados revalidan ambas rutas y el panel. Vista de tarjetas adaptable, controles flexibles y sin tablas que exijan desplazamiento horizontal.
- Archivos: [pantalla compartida](../src/app/panel/juez-general/resultados/page.tsx), [entrada de partidos](../src/app/panel/juez-general/partidos/page.tsx), [panel](../src/app/panel/juez-general/page.tsx), [gestión](../src/components/match-management.tsx), [estados](../src/lib/gestion-partidos.ts), [asignación](../src/components/referee-assignment.tsx), [resultados](../src/components/match-results.tsx), [generación](../src/components/group-matches.tsx), [navegación](../src/components/judge-navigation.tsx), acciones existentes de [partidos](../src/app/panel/juez-general/partidos/actions.ts) y [resultados](../src/app/panel/juez-general/resultados/actions.ts). Pruebas nuevas de [gestión](../tests/gestion-partidos.test.mjs) y adaptación de las pruebas existentes de partidos, resultados y navegación.
- Verificación: TypeScript y ESLint focalizado correctos; 76/76 pruebas Node relacionadas aprobadas (gestión, partidos, resultados, navegación, clasificación y UTF-8). Escenarios simulados: sin grupos, grupos confirmados sin partidos, sin árbitro, asignados con resultados pendientes, enviado, observado, todos confirmados y fallos de Supabase. Incluye corrección pendiente sobre resultado confirmado, asignación inactiva, autoarbitraje y rechazos de permisos/conflictos. Sin pruebas pesadas de PostgreSQL porque no cambió el backend.
- No se ejecutó SQL ni se consultó Supabase real; no se modificaron migraciones 001–015, RLS, permisos, datos ni resultados existentes. Se conserva el historial y los cambios previos del espacio de trabajo. Pendiente comprobación visual autenticada y en dispositivo móvil; las pruebas locales no la sustituyen. Sin eliminatorias, ranking ni nuevas reglas deportivas.

## Escala visual del Juez General: grupos y clasificación (2026-11-15)

- Gestionar partidos conserva los contadores globales y añade tarjetas compactas por grupo con progreso confirmado/revisión. «Todos los grupos» queda en resumen; el detalle seleccionado es el único que monta asignaciones, observaciones e historial. Se mantiene búsqueda local por jugador, contexto único y orden de resultados enviados/observados antes de pendientes. No se agregan RPC ni consultas nuevas.
- Clasificación de grupos conserva PJ, PG, PP, SF, SC, PF y PC, aprobación e historial. El resumen muestra todos los grupos y su estado (completo, pendiente, observado o empate pendiente); el selector abre una sola tabla detallada. No se calcula desempate ni se asignan plazas.
- Fixtures locales deterministas en [escala-competencias.mjs](../tests/fixtures/escala-competencias.mjs): un grupo de cuatro (6 partidos), uno de tres (3), ocho grupos (32 jugadores, 48 partidos) y doce grupos (48 jugadores, 72 partidos). Las fixtures no se importan desde la aplicación ni se insertan en Supabase.
- Verificación focalizada: TypeScript correcto, ESLint de los archivos modificados correcto y 81 pruebas relacionadas aprobadas, incluyendo contadores independientes por grupo, filtros, estados sin árbitro, enviados, observados, confirmados, empates, fallo de lectura y estabilidad de escalas 8/12. No se ejecutó SQL remoto ni se modificaron migraciones 001–015, RLS, permisos, datos o resultados existentes. Pendiente validación visual autenticada en móvil y PC.

## Eliminatorias individuales: clasificación automática y propuesta de llave (2026-11-15)

- Definición proporcionada para este alcance: clasifica exclusivamente el primer lugar de cada grupo; la cantidad total se obtiene contando los grupos de la competencia. La definición queda implementada y documentada como pendiente de validación formal porque las Bases revisadas describen grupos y eliminación simple, pero no explicitan las plazas por grupo.
- `competitionInput` deriva automáticamente un clasificado por grupo desde `GroupStanding.filas[0]` solo si el grupo tiene todos sus partidos confirmados, no tiene revisiones pendientes ni empate, y conserva una aprobación vigente con referencia. Ordena por número de grupo, valida identidad única y no usa segundos/terceros lugares.
- La página de Clasificación y eliminatorias genera la propuesta real en memoria al cargar la competencia. Muestra grupos, primeros lugares, posiciones, pases, rondas y requisitos bloqueantes. No ofrece selección manual de clasificados en el flujo principal. Un solo grupo queda sin partido y sin campeón automático. El laboratorio manual permanece contraído en Herramientas avanzadas y usa datos sintéticos.
- El motor acepta origen de competencia solo para vista previa, mantiene confirmable=false y no escribe en Supabase. La selección técnica de ramas es determinista, no es ranking, sorteo ni siembra oficial. Ranking nacional/Liga, cabezas de serie, desempates, pases y reencuentros siguen pendientes de respaldo.
- Verificación: TypeScript, ESLint focalizado y pruebas del motor para primer lugar por grupo, un grupo, grupos incompletos, empate, aprobación desactualizada, duplicados, 2–32 clasificados, pases y visualización. No se modificaron migraciones 001–015, resultados reales ni permisos. No se preparó 016 porque este incremento no persiste propuestas ni confirmaciones.

## Persistencia y confirmación de eliminatorias (016 preparada, 2026-11-15)

- Se preparó [016_eliminatorias.sql](../supabase/migrations/016_eliminatorias.sql), sin aplicarla remotamente. Crea llaves, rondas, enfrentamientos potenciales e historial separados de resultados. Los pases no se persisten como partidos; los nodos posteriores conservan fuentes pendientes sin ganador inventado.
- `guardar_propuesta_eliminatoria_016` y `confirmar_llave_eliminatoria_016` son RPC con sesión y rol Juez General. Bloquean por competencia, revalidan grupos confirmados, snapshots de 015, aprobaciones vigentes, primer lugar único, pertenencia y duplicados. La segunda RPC exige referencia de reglas, datos reales y trazabilidad. RLS permite lectura solo a Juez/Administrador, sin DML directo; estructuras confirmadas e historial son inmutables.
- La vista de Clasificación y eliminatorias guarda el borrador calculado automáticamente y no solicita seleccionar jugadores ni tamaño de cuadro. La confirmación oficial no se ofrece mientras la regla del primer lugar, distribución, pases, siembra y reencuentros no tengan respaldo formal de la Liga. No se implementa captura ni avance de resultados eliminatorios.
- Se revisó `admin-presentation.test.mjs`: la expectativa era antigua porque el texto «Mi panel» pertenece a `JudgeNavigation`, no al shell aislado. Se actualizó únicamente el mock de navegación para representar el componente vigente.
- Verificación: migración 016 en PostgreSQL temporal aprobada (borrador, snapshots, confirmación atómica, RLS, historial e inmutabilidad); TypeScript y ESLint focalizado aprobados; pruebas focalizadas de eliminatorias/clasificación aprobadas. No se ejecutó SQL remoto ni se modificaron 001–015 o datos existentes.

## Eliminatorias individuales: motor de propuestas y visualización (2026-11-15)

- Revisión directa completa de Bases 2026 y contraste con la hoja Grupos del Excel. §7 confirma simple eliminación y referencia a ranking nacional, ranking de Liga y criterio organizador/mesa; no prescribe algoritmo de siembra. Plazas, desempates de grupo, reparto de pases y ronda de reencuentro quedan pendientes. Evidencia y límites en [ELIMINATORIAS.md](./ELIMINATORIAS.md).
- [Motor](../src/lib/eliminatorias.ts) puro de propuestas exclusivamente simuladas: cuadro mínimo 2/4/8/16/32, fuentes explícitas por grupo sin cuota uniforme, participantes autorizados de una competencia, rechazo de duplicados/datos incompletos/empates/aprobaciones inválidas. Separación técnica opcional por ramas, advertencia de primer reencuentro posible, sin garantizar óptimo ni presentarla como siembra oficial. Ranking/cabezas reservados como datos futuros, rechazados mientras no exista algoritmo validado.
- [Visualización](../src/components/knockout-preview.tsx) después de clasificación y validaciones, dentro de la tercera etapa existente. Laboratorio contraído con datos sintéticos independientes de Peneca Inicial, selector de cantidades/rondas y decisiones locales. Pases propagan jugador; no generan rival, marcador ni partido disputado. No hay endpoints, confirmación oficial, persistencia ni resultados de eliminatorias. Cambiar contexto o salir descarta la propuesta. Confirmación bloqueada aun con clasificaciones aprobadas.
- [Clasificación](../src/components/group-standings.tsx) y [gestión de partidos](../src/components/match-management.tsx) abren automáticamente el detalle cuando hay un solo grupo; con varios mantienen resumen/selector. Solo estado visual derivado, sin escritura al seleccionar.
- Validación: TypeScript y ESLint focalizado aprobados; pruebas locales del motor para todas las cantidades 2–32 y regresiones de grupos/partidos/resultados/permisos/lecturas/UTF-8. Prueba visual en navegador con cuadro sintético de 24, rondas apiladas/columnas y desplazamiento contenido sin desbordar la página. No equivale a comprobación autenticada ni a dispositivo físico.
- Archivos nuevos: motor, visualización, documento de reglas y tests/eliminatorias.test.mjs. Integración en la página existente de clasificación, componentes de grupos/partidos y sus pruebas. Sin SQL remoto, consultas a Supabase, cambios de datos reales ni modificaciones a migraciones 001–015. No se necesita 016 para una propuesta transitoria. Pendientes resolución deportiva, revisión de persistencia y posterior confirmación transaccional/auditoría; conservar Árbitro registra → Juez confirma.

## Cierre de verificación de persistencia de eliminatorias (2026-11-16)

- Se corrigieron los datos del caso de prueba de persistencia para usar participantes de competencia válidos; no se relajaron validaciones del motor.
- Suite focalizada: 75/75 pruebas aprobadas. La suite Node completa posterior queda registrada con 452 pruebas, pendiente repetir el conteo final si se incorporan nuevas pruebas ajenas a este alcance.
- PostgreSQL temporal para 016 verificó borrador, snapshots, revalidación, confirmación atómica, historial, RLS e inmutabilidad. No se aplicó la migración remotamente ni se modificaron 001-015 o datos reales.

## Revisión correctiva de seguridad e integridad de 016 (2026-11-16)

- Confirmado y corregido el conflicto entre reemplazo de borradores y la auditoría con `ON DELETE RESTRICT`: ahora las versiones anteriores quedan `reemplazada` y se conserva su historial.
- Confirmado y corregido el riesgo de persistir pases como partidos: la validación SQL solo admite encuentros de dos fuentes y compara la estructura completa reconstruida; los pases se contabilizan únicamente como diferencia de posiciones y clasificados.
- Confirmado y corregido el riesgo de aceptar JSON manipulado: se revalidan jugadores, grupos, duplicados, origenes, cruces, rondas, posiciones y distribución determinista en PostgreSQL.
- Confirmado y corregido el hueco de grupos pendientes: una competencia solo puede generar una llave cuando el total de sus grupos coincide con el total confirmado.
- Revisión de formato SQL: el archivo real no contiene `*--`, `new.llave_id` ni el operador accidental `!~`; las expresiones regulares usan la forma PostgreSQL `not ... ~ ...` donde corresponde.
- La migración 016 permanece preparada para aplicación manual, pero no se ha ejecutado en Supabase real.

## Integración PostgreSQL de cuadros con pases (2026-11-16)

- La restricción de igualdad de nulidad en `eliminatorias_enfrentamientos` fue confirmada como incompatible con finales que combinan un jugador conocido y una fuente pendiente. Se reemplazó por una validación de identidad solo cuando ambos jugadores están presentes; los orígenes siguen siendo obligatorios y la RPC reconstruye la estructura completa.
- El trigger de rondas/enfrentamientos ahora bloquea inserciones, actualizaciones, eliminaciones y movimientos entre llaves cuando la llave antigua o nueva está confirmada.
- La prueba SQL temporal mediante las RPC reales guardó, reemplazó y confirmó cuadros de 3, 5, 6 y 12 clasificados, verificando `n-1` encuentros persistidos y pases sin filas de partido. También verificó grupos pendientes, JSON manipulado, historial y RLS.
- El caso de un único grupo sigue generando cero rondas y no declara campeón. No se aplicó SQL remoto ni se tocaron migraciones 001-015.

## Revisión final de canonización y concurrencia de 016 (2026-11-16)

- `guardar_propuesta_eliminatoria_016` valida la entrada y luego reconstruye una propuesta canónica en PostgreSQL. Solo persiste clasificaciones reducidas a grupo, primer jugador y snapshot; rondas, encuentros y orígenes se regeneran con el algoritmo autorizado. Campos adicionales enviados por el cliente no llegan a llaves, historial ni enfrentamientos.
- La prueba temporal ampliada usó la forma real de propuestas del motor TypeScript y confirmó cuadros de 2, 3, 5, 6 y 12 clasificados, reemplazo con historial conservado, confirmación e inmutabilidad, pases sin partidos ficticios y rechazo de JSON manipulado.
- Se simuló una corrección concurrente de resultados cambiando el snapshot antes de confirmar: la RPC rechazó la llave y la mantuvo en borrador. Ninguna confirmación queda vigente sobre una clasificación desactualizada.
- Validación ejecutada: PostgreSQL temporal de 016 aprobado; 75/75 pruebas focalizadas Node; TypeScript y ESLint focalizado aprobados. El archivo SQL real no contiene caracteres Markdown accidentales. No se ejecutó SQL remoto ni se modificaron 001-015.
- Con estos escenarios cubiertos, 016 queda lista para aplicación manual, manteniendo pendientes reglamentarios fuera del alcance: siembra/ranking, desempates y distribución oficial deben ser validados por la Liga antes de confirmar una llave real.

## Concurrencia real de la migración 016 (2026-11-16)

- Se añadió coordinación en 016 con el mismo orden de fuente usado por la clasificación: competencia, grupos ordenados y partidos ordenados. La validación de la llave ocurre mientras esas filas permanecen bloqueadas.
- Se añadió un trigger de protección sobre resultados de grupos: una corrección posterior a una llave confirmada es rechazada. Si la corrección obtiene primero el bloqueo del partido, la confirmación espera y revalida el snapshot actualizado; si la llave confirma primero, la corrección autorizada queda bloqueada por la llave confirmada.
- La prueba temporal abrió dos conexiones PostgreSQL independientes. Una retuvo el partido durante una corrección y la otra intentó confirmar simultáneamente; la confirmación esperó, detectó el snapshot cambiado y dejó la llave en borrador. Se aplicó timeout de 10 segundos y limpieza garantizada del servidor temporal.
- Con este escenario, la concurrencia real quedó demostrada como segura para 016. No se modificaron 001-015 ni se ejecutó SQL remoto.

## Integración posterior a la aplicación manual de 016 (2026-11-16)

- El desarrollador confirmó que 016 fue aplicada manualmente en Supabase de producción y comprobó la existencia de `eliminatorias_llaves`, `eliminatorias_rondas`, `eliminatorias_enfrentamientos`, `eliminatorias_historial` y de las RPC `guardar_propuesta_eliminatoria_016` y `confirmar_llave_eliminatoria_016`.
- La integración Next.js usa esas RPC con los nombres definitivos y consulta las llaves mediante RLS. La lectura ahora ignora versiones `reemplazada` y selecciona la llave activa más reciente, evitando recuperar un borrador histórico antiguo.
- Se mantiene la recuperación de estado de borrador/confirmada, el cuadro automático sin partidos ficticios para pases y el bloqueo de confirmación oficial por reglas deportivas pendientes. Un solo grupo continúa sin partido ni campeón automático.
- Se revisaron mensajes de persistencia no disponible, clasificación desactualizada, permisos y estados vacíos. No se ejecutaron escrituras ni consultas remotas desde esta revisión.
- La siguiente fase puede comenzar con el diseño de partidos eliminatorios, captura de resultados y avance de ganadores, manteniendo el flujo Árbitro registra → Juez General confirma y sin habilitar todavía la confirmación oficial de llaves sin validación formal de la Liga.

## Corrección deportiva y escalabilidad de eliminatorias (017 preparada, 2026-11-16)

- Regla vigente definida expresamente por el usuario: clasifican **primero y segundo de cada grupo**, automáticamente desde las clasificaciones completas, aprobadas y vigentes. Esta sección sustituye la regla histórica de un primero por grupo, conservada en las entradas anteriores como historial.
- El [motor](../src/lib/eliminatorias.ts) exige dos identidades diferentes por grupo y unicidad global; bloquea resultados pendientes, empates y aprobaciones vencidas. Calcula 2 × grupos, menor potencia de dos y pases sin partidos ficticios. Sin máximos deportivos de grupos, participantes o rondas ni operaciones binarias de 32 bits. El caso de un solo grupo conserva dos clasificados y bloquea cuadro/guardado hasta validar el reencuentro, sin campeón automático.
- Distribución técnica propuesta: primeros contra segundos de otros grupos en los encuentros iniciales; compañeros en mitades opuestas, también con pases. No se presume oficial A1-H2, ni se inventan sorteo, ranking, desempate o derechos a pases. Confirmación oficial bloqueada en interfaz y acción servidor mientras falte validación deportiva.
- [017_dos_clasificados_por_grupo.sql](../supabase/migrations/017_dos_clasificados_por_grupo.sql) **aplicada en Supabase de producción**, junto con 001–016, según la aclaración vigente del desarrollador. Permanece intacta y no se reaplica ni modifica. Se reutilizan tablas, RLS, permisos, bloqueos, historial y protección de confirmadas; sus auxiliares exigen primero y segundo por grupo, revalidan pertenencia y snapshots y reconstruyen toda la llave.
- No hay conversión silenciosa de borradores: el Juez regenera y guarda expresamente, manteniendo la versión anterior y su auditoría. Las llaves confirmadas no se modifican ni invalidan; se muestra su resumen histórico y no una estructura recalculada con el rótulo de confirmada.
- [Interfaz](../src/components/knockout-preview.tsx) con total de grupos, dos plazas, total de clasificados, cuadro, pases, encuentros y advertencias. Rondas dinámicas; una ronda visible y páginas de 32 nodos para acotar el DOM. Laboratorio sin techo fijo de cantidades. [Lectura de clasificaciones](../src/app/panel/juez-general/clasificacion/page.tsx) en lotes de ocho peticiones simultáneas, sin limitar grupos.
- Límites físicos documentados, sin convertirlos en reglas deportivas: INTEGER heredado, memoria/tiempos y transporte Server Actions de 3 MiB. Mensajes claros ante capacidad insuficiente; orígenes JSON compactos. Detalle del algoritmo, compatibilidad, pruebas y guía manual en [ELIMINATORIAS.md](./ELIMINATORIAS.md#corrección-vigente-dos-clasificados-por-grupo-017-2026-11-16).
- Pruebas con [fixtures locales](../tests/fixtures/dos-clasificados.mjs), [motor/interfaz/acciones](../tests/eliminatorias.test.mjs) y [PostgreSQL temporal 017](../supabase/tests/017_dos_clasificados_por_grupo.test.mjs). Incluyen todas las escalas exigidas: 30→60→64, 31→62→64, 32→64→64, 33→66→128, 40→80→128, 50→100→128, 64→128→128 y 100→200→256; motor adicionalmente hasta 257 grupos y cuadro de 1024. No hay duplicados, pérdida de participantes, cruces iniciales entre compañeros ni pases persistidos como partidos.
- SQL temporal cubre 016→017, canonización, persistencia, reemplazo/historial, snapshots, manipulación de JSON, ACL/RLS e inmutabilidad; conserva exactamente una llave confirmada con 016 y verifica corrección concurrente durante confirmación. La suite temporal de 015 también pasa con su cálculo real de clasificación. Sin conexiones, consultas ni escrituras remotas; fixtures nunca se usan como llaves oficiales.
- No se implementan resultados eliminatorios ni avance de ganadores: quedan para **018**. Pendientes revisión manual de 017, validación deportiva de la distribución y comprobación visual autenticada.
- Cierre de verificación: **438/438 pruebas Node aprobadas**, TypeScript y ESLint focalizado sin errores ni advertencias; PostgreSQL temporal 015 y 017 aprobados. SHA-256 confirma migraciones 001–016 intactas. Lint global conserva 17 errores y una advertencia ajenos a este cambio (scripts históricos 005, runner 009 y scripts previos de test-results); detalle en [ELIMINATORIAS.md](./ELIMINATORIAS.md#resultado-final-de-verificación-de-017).

## Fase 018: circuito de eliminación directa (preparado localmente)

- [Migración 018](../supabase/migrations/018_resultados_eliminatorias.sql) incremental sobre 017: respaldos documentales manuales, cuadros operativos, partidos referenciados a los originales, actas por sets y eventos con instantáneas. No modifica estructura histórica de 016 ni migraciones 001–017. **001–018 están aplicadas en producción según confirmación del desarrollador; esta sesión no ejecutó SQL remoto ni ingresó datos ficticios reales.**
- Revisión correctiva de 018: la función `public.bloquear_fuente_eliminatoria_016(bigint)` sí existe en 016 y 017 no la elimina. 018 conserva su uso y añade una comprobación de dependencia al inicio. El orden de inicio queda `advisory lock (2026003,2) → competencia FOR UPDATE → bloquear_fuente_eliminatoria_016 (grupos y partidos) → llave FOR UPDATE`, consistente con 011/016 y sin carreras entre correcciones, confirmaciones e inicio.
- El runner 018 ahora modela la tabla real `competencia_formatos_sets`: FK a `competencia_control_deportivo`, etapas `grupos/previa_cuartos/cuartos/semifinal/final`, PK compuesta, `mejor_de` restringido a 3/5, `referencia_resolucion`, `actualizado_por` y `actualizado_en`, además de RLS/ACL de lectura. No reemplaza los triggers completos de 003; esa cobertura queda indicada en la documentación de pruebas.
- Eliminación definitiva en esta competencia al confirmar el Juez, avance automático por fuentes, finalista y campeón determinados en la misma transacción. Bloqueo por cuadro, reintentos idempotentes, resultados confirmados y campeón inmutables. Sin repechaje, doble eliminación, tercer lugar ni puntos de ranking anual. Pases propagados sin partidos ni victorias deportivas.
- Árbitro asignado registra y envía sets reutilizando el validador 012 y el formulario existente; observaciones requieren nueva revisión. Juez asigna, observa y confirma. Se bloquean autoarbitraje, revisión del propio resultado, participantes pendientes y jugadores eliminados. Formatos por etapa tomados de la configuración existente y congelados al iniciar; no se inventan sets ni ganadores por incidencias.
- [Interfaz operativa](../src/components/knockout-operations.tsx) integrada en Clasificación y Resultados del Árbitro, sin nuevos menús. Estados, ronda, pendientes, eliminados, historial y campeón; paginación de 16 encuentros en servidor, con RLS y roles verificados en [acciones](../src/app/panel/juez-general/clasificacion/operacion-actions.ts).
- La interfaz separa clasificación actual, propuesta vigente, borradores históricos y llave confirmada. Un borrador anterior (por ejemplo, con un clasificado) muestra **Borrador histórico: requiere regeneración** y no se modifica automáticamente. Una llave confirmada y autorizada abre los partidos operativos, sus controles de árbitro/juez, historial, ganador, eliminado, avance y campeón. La distribución/pases/reencuentros continúan pendientes de validación formal; un único grupo permanece bloqueado y no se declara campeón desde posiciones de grupo. Guía completa y decisiones en [ELIMINATORIAS.md](./ELIMINATORIAS.md#fase-018-resultados-y-eliminación-directa-2026-11-16).
- [Pruebas Node](../tests/eliminatorias-operacion.test.mjs) y [PostgreSQL temporal 018](../supabase/tests/018_resultados_eliminatorias.test.mjs) con fixtures exclusivamente locales. Cubren 4/6/8/16/32/64/128 clasificados, pases, observaciones/pendientes sin avance, semifinales/final, campeón, permisos, inmutabilidad, reintentos y concurrencia real. No sustituyen revisión manual del SQL ni comprobación visual autenticada/móvil, que siguen pendientes.
- Cierre: **447/447 pruebas Node aprobadas**, TypeScript, diagnósticos del editor y ESLint focalizado correctos. PostgreSQL temporal 018 y regresión 015 aprobados; incluye paginación SQL y preservación exacta de histórica 016. Lint global sigue con los mismos **17 errores y una advertencia preexistentes**. SHA-256 confirma 001–017 intactas. Detalles y límites de las mediciones en [cierre de 018](./ELIMINATORIAS.md#cierre-de-verificación-de-018).

## Verificación visual local del circuito eliminatorio (2026-11-16)

- Se levantó Next.js en modo desarrollo sobre `http://localhost:3000` y se comprobó la navegación pública y la pantalla de ingreso en escritorio. No se conectaron escrituras ni se insertaron jugadores, grupos o resultados en Supabase.
- El laboratorio local existente en [knockout-preview.tsx](../src/components/knockout-preview.tsx) conserva fixtures sintéticos para cuadros de 4, 6, 8, 16 y cantidades mayores; está contraído, identificado como simulado y no puede confirmar resultados ni declarar campeones.
- No fue posible completar una prueba visual autenticada del Juez General o del Árbitro: el entorno local no dispone de credenciales de prueba ni de un backend PostgreSQL/Supabase aislado conectado a las páginas reales. Por ello no se declara aprobada la secuencia visual de asignación, envío, observación, confirmación, avance y campeón.
- Para ejecutar esa verificación de forma segura se requiere una cuenta local de Juez General, una cuenta local de Árbitro, una base temporal con 018 aplicada y fixtures creados únicamente allí. La sesión debe comprobarse en escritorio y en un viewport móvil, y destruirse después sin apuntar a producción.
- La evidencia automatizada permanece aprobada: TypeScript, ESLint completo, pruebas Node focalizadas y PostgreSQL temporal 018 con avance, campeón, concurrencia e idempotencia. Esta evidencia no sustituye la revisión visual autenticada.

## Corrección del laboratorio y demostración local de eliminación directa (2026-11-16)

- [BracketView](../src/components/knockout-preview.tsx) ya no muestra un selector vacío para dos clasificados: explica que el único grupo queda bloqueado por la regla pendiente de reencuentro. El laboratorio inicia con 4 clasificados y permite 6, 8, 16, 32 y cantidades mayores mediante fixtures sintéticos.
- Se añadió [demostración local](../src/app/dev/eliminatorias/page.tsx), visible solo con `NODE_ENV !== production`, con estado en memoria y sin acciones Supabase. Está identificada como **SIMULACIÓN LOCAL · sin Supabase** y reutiliza el motor y la vista de cuadro existentes.
- La demostración permite observar escenarios de 4, 6 y 16 clasificados, pases, rondas, asignación simulada, envío, observación, corrección, confirmación simulada, avance del ganador, eliminación del perdedor y campeón simulado. No es una prueba de autenticación ni E2E.
- Verificación visual real: escritorio y viewport móvil simulado desde la interfaz local; se observaron los escenarios A, B y C y el avance de R1-C2 hacia el siguiente cruce. El flujo autenticado con Juez General/Árbitro y Supabase continúa pendiente por falta de cuentas y backend temporal conectado a esas rutas.
- TypeScript aprobado; las 41 pruebas focalizadas siguen aprobadas. ESLint global conserva 17 errores históricos en scripts CommonJS; la nueva demostración no añade advertencias.

## Fase 019: final independiente de grupo único (preparada para revisión manual, 2026-11-16)

- Se preparó [019_final_grupo_unico.sql](../supabase/migrations/019_final_grupo_unico.sql) sobre 018. No se modifican 001–018 ni se convierten llaves históricas.
- La propuesta 019 valida exactamente un grupo confirmado, primero y segundo vigentes, snapshots, pertenencia e identidad distinta; construye una sola ronda Final y un único enfrentamiento nuevo. El partido anterior de grupos no se reutiliza.
- `guardar_propuesta_eliminatoria_019` reemplaza solo borradores mediante acción explícita y conserva el historial. `confirmar_llave_eliminatoria_019` exige referencias y declaraciones separadas de decisión deportiva y datos reales. `iniciar_eliminatoria_018` acepta version 19 además de 17 y mantiene el respaldo operativo de 018.
- La interfaz de clasificación muestra directamente la final para un solo grupo, permite guardar y confirmar la propuesta con referencias, y conserva borradores antiguos dentro de «Historial de llaves». Se retiró el laboratorio y el texto técnico de la vista normal; las pruebas y fixtures locales permanecen.
- Pendiente: aplicar 019 manualmente, ejecutar un runner PostgreSQL temporal específico de 019, verificar el esquema real de producción mediante lectura autorizada y completar una final autenticada con Juez General y Árbitro. La regresión temporal de 018 permanece aprobada; no se ejecutó SQL remoto ni se alteró Peneca Inicial.

### Corrección final de 019

- La regla de un solo grupo queda implementada como final nueva entre primero y segundo; ya no se bloquea automáticamente ese caso. La confirmación exige que el Juez General proporcione también la referencia auténtica de la regla de final/reencuentro; 019 no genera ese texto por defecto.
- El runner temporal [018_resultados_eliminatorias.test.mjs](../supabase/tests/018_resultados_eliminatorias.test.mjs) aplica 016, 017, 018 y 019 en PostgreSQL local y aprobó propuesta, llave canónica, confirmación con referencias, inicio operativo, asignación, observación, corrección, confirmaciones concurrentes, campeón, subcampeón e idempotencia. No ejecuta SQL remoto.
- 019 queda lista para revisión y aplicación manual. Antes de aplicarla se requiere una ventana controlada, respaldo del esquema y verificación de que las referencias entregadas por el Juez General corresponden a una decisión deportiva real. La final autenticada en producción sigue pendiente hasta aplicar 019 y contar con Juez General y Árbitro autorizados.


### Corrección final 019: historial y UTF-8

- Corregido el reemplazo de borradores: todas las inserciones en `eliminatorias_historial` usan `determinista_por_grupo`, que es el valor permitido por 016. `version_regla=19` y `metodo_distribucion=final_grupo_unico` permanecen en la propuesta JSON.
- `validar_eliminatoria_019` exige dos jugadores distintos, ambos pertenecientes al mismo grupo confirmado, posiciones 1/2 aprobadas, snapshots vigentes, sin empates ni pendientes incompatibles.
- El runner PostgreSQL temporal ahora crea un borrador 016 real con un solo clasificado y cuatro participantes antes de aplicar 017/018/019; después lo reemplaza por la final 019, conserva su historial y completa la final hasta campeón y subcampeón. La prueba pasó sin SQL remoto.
- Se corrigieron cadenas UTF-8 visibles en interfaz, migración y documentación. La prueba de codificación pasó y verifica textos como campeón, subcampeón, clasificación, según e histórico.

### Regresión final posterior a 019

- En el mismo PostgreSQL temporal, después de 016, 017, 018 y 019, se verificó una competencia de 2 grupos/4 clasificados con llave versión 17, semifinales, final y campeón.
- Se verificó una competencia de 3 grupos/6 clasificados con 2 pases automáticos: se persistieron 5 partidos reales para el cuadro de 8 posiciones y no se generaron partidos ficticios por los pases.
- `iniciar_eliminatoria_018` continúa aceptando llaves versión 17 y versión 19. La regresión pasó sin conexiones remotas ni cambios en 001–018.

### Integración posterior a la aplicación productiva de 019

- El estado operativo documentado ahora refleja que 019 fue aplicada manualmente en Supabase junto con 001–018, según confirmación del desarrollador.
- `operacion-actions.ts` utiliza las firmas instaladas de `iniciar_eliminatoria_018(bigint,text)` y `operar_eliminatoria_018(bigint,text,integer,text,uuid,jsonb)`; las acciones de propuesta/confirmación usan las firmas 019 con referencias explícitas.
- El panel operativo carga `id,nombre_completo` para mostrar correctamente a los finalistas en Juez y Árbitro. El formato de sets de la final sigue siendo leído por la RPC de inicio desde `competencia_formatos_sets`; no se inventan referencias desde la interfaz.
- El flujo de operación queda disponible desde los paneles: Juez inicia/asigna/observa/confirma; Árbitro consulta asignaciones, registra sets y corrige solo después de observación. Los resultados confirmados permanecen protegidos.
- Verificación local: 36 pruebas Node relacionadas, TypeScript y ESLint focalizado aprobados. La regresión PostgreSQL temporal 016–019 cubre final única, reemplazo histórico, competencias multigrupo, pases, campeón e idempotencia. No se ejecutaron escrituras remotas.

### Corrección funcional de controles de final (2026-11-16)

- La causa del bloqueo visual era doble: la página seleccionaba cualquier borrador versión 17/19 sin distinguir la regla válida para un único grupo, y `KnockoutPreview` usaba `persisted` como `proposalKey` aunque `persisted` fuera solo el borrador histórico 016. Por eso se mostraba “Final guardada como propuesta” y se ocultaba “Guardar final”.
- Ahora, con un grupo, solo una llave versión 19 es propuesta activa; un borrador 016 histórico queda únicamente en “Historial de llaves”. Si no existe llave 019 persistida aparece “Guardar final”. Si existe borrador 019 aparece “Activar final”. Si existe llave 019 confirmada aparece el control operativo “Iniciar cuadro respaldado”.
- Después de guardar o confirmar se fuerza la actualización de la página; iniciar y operar refrescan el cuadro operativo. Se añadió una prueba de regresión de estos estados en `tests/eliminatorias.test.mjs`.

### Automatización de referencias operativas

- Las referencias técnicas de guardado de propuesta, inicio de llave, asignación de Árbitro y comienzo de partido se generan automáticamente en las acciones del servidor cuando no son proporcionadas.
- La confirmación deportiva conserva manuales únicamente las referencias reglamentarias auténticas y la referencia de la regla de final/reencuentro, además de las declaraciones explícitas de revisión de reglas y datos reales.
- La selección del Árbitro, el registro de sets, la observación y la confirmación del resultado siguen siendo decisiones humanas y no se automatizan.

### Simplificación de asignación de la final

- La vista de una final autorizada muestra únicamente los finalistas, el estado y el selector de Árbitros elegibles. Se ocultaron las explicaciones repetidas, referencias internas y casillas técnicas de la operación cotidiana; el historial continúa disponible de forma secundaria.
- El selector excluye los perfiles vinculados a los jugadores del encuentro y los Árbitros con otra asignación eliminatoria todavía operativa. No se afirma disponibilidad horaria porque el esquema no registra horarios de mesas.
- Se preparó [020_preparar_asignar_final.sql](../supabase/migrations/020_preparar_asignar_final.sql), y su instalación productiva fue confirmada por el desarrollador. Su RPC inicia la final y asigna el Árbitro en una única transacción, con los bloqueos y validaciones de 018/019.
- Sin autorización o sin Árbitros elegibles se muestra un único mensaje breve y no se ofrece la operación. La selección de sets, observación y confirmación del resultado continúa bajo decisión humana.

### Auditoría correctiva de 020

- La RPC `preparar_asignar_final_eliminatoria_020(bigint,uuid,text)` quedó restringida a llaves versión 19, confirmadas y respaldadas, con una sola competencia/grupo, una sola final y dos participantes definidos. Las llaves versión 17 y los cuadros multigrupo se rechazan antes de iniciar operaciones.
- Se unificó el orden de bloqueos con 018: después de la inicialización se bloquea el cuadro y luego el partido; nunca se bloquea el partido antes del cuadro cuando se llama a `operar_eliminatoria_018`. Se añadió bloqueo transaccional por Árbitro para evitar asignaciones incompatibles concurrentes.
- [operacion-actions.ts](../src/app/panel/juez-general/clasificacion/operacion-actions.ts), [knockout-operations.tsx](../src/components/knockout-operations.tsx), [020_preparar_asignar_final.sql](../supabase/migrations/020_preparar_asignar_final.sql) y las pruebas usan exactamente la RPC `preparar_asignar_final_eliminatoria_020(bigint,uuid,text)`.
- La migración 020 figura aplicada en producción según confirmación del desarrollador. No se ejecutó SQL remoto durante esta revisión ni se modificaron 001–019.

### Cierre de auditoría PostgreSQL 020

- La RPC devuelve idempotencia cuando se repite la misma asignación, rechaza sustituciones y conserva el árbitro/evento original. Un trigger adicional protege también la ruta genérica de `operar_eliminatoria_018` frente a sobrescrituras, autoarbitraje y asignaciones incompatibles concurrentes.
- El runner temporal permite limitar escalas mediante `SPINTRACK_PG018_COUNTS`, informa errores de `psql`, detecta timeouts y limpia el clúster. Ejecutado con `SPINTRACK_PG018_COUNTS=1`, aplicó 016–020 y aprobó el flujo 019, reintentos, concurrencia, rechazo de versión 17 y protección de asignación.
- Resultado: **38 pruebas Node aprobadas; PostgreSQL temporal 016–020 aprobado** para los escenarios ejecutados. No se ejecutó SQL remoto durante la auditoría.

### Corrección del selector de Árbitro

- El perfil se consultaba correctamente con `rol='arbitro'` y la política 013 permite esa lectura al Juez General. El defecto visual estaba en [knockout-operations.tsx](../src/components/knockout-operations.tsx): el selector solo se renderizaba para `operation='asignar'`, pero la final utilizaba `operation='preparar_asignar'`. Por eso aparecía el botón sin selector y la acción recibía `arbitro_id` vacío.
- La final todavía no iniciada tampoco debe mostrar «No hay encuentros operativos»: ese mensaje ahora solo aparece cuando el cuadro ya está operativo y la consulta realmente no devuelve partidos. La migración 020 sigue pendiente de aplicación manual; sin ella la asignación directa responde con un aviso específico.
- Se añadió una prueba de regresión que comprueba el selector de la operación combinada y conserva la cobertura de rol, RPC y errores de lectura. No se crean usuarios ni se modifican roles reales.

### Diagnóstico de asignación 020

- La Server Action ya conserva `code`/SQLSTATE y el mensaje devuelto por Supabase en el log seguro del servidor, sin tokens ni credenciales. La interfaz distingue RPC ausente, permisos, autorización/formato, autoarbitraje y asignación incompatible.
- Las pruebas locales cubren `PGRST202` y `55000` con mensajes comprensibles. No se realizó una consulta remota de solo lectura en esta sesión porque no hay una conexión autorizada disponible; el SQLSTATE exacto de Peneca Inicial debe obtenerse del log del servidor al repetir la operación.

### Regla automática de finales al mejor de 5 (021 preparada)

- El trigger heredado de 011 bloquea modificar `competencia_formatos_sets` después de partidos confirmados. Por eso un `referencia_resolucion` NULL no se rellena directamente en esa fila histórica.
- [021_formato_final_mejor_de_5.sql](../supabase/migrations/021_formato_final_mejor_de_5.sql) añade un respaldo trazable por competencia y una RPC de Juez General (`configurar_formato_final_021`) que exige una referencia auténtica, fija la regla en mejor de 5 y no modifica semifinales, cuartos ni grupos.
- `iniciar_eliminatoria_018` se reemplaza incrementalmente para usar ese respaldo cuando la fila heredada de la etapa final tiene referencia NULL; los partidos de final se crean siempre con `mejor_de=5`.
- La pantalla de preparación ya no permite elegir 3 sets para la final: muestra la regla fija y solicita una única referencia deportiva. No se genera ni se presenta como oficial ninguna referencia automáticamente.
- El runner PostgreSQL temporal aplicó 016–021 y comprobó configuración de referencia, inicio/asignación, observación, confirmación, campeón, idempotencia y regresión multigrupo: aprobado con `SPINTRACK_PG018_COUNTS=1`. 021 no se ha ejecutado remotamente y queda para aplicación manual.
- La prueba adicional confirmó que, si no existe la fila `final`, el INSERT incluye explícitamente `actualizado_por`; esto respeta la columna `NOT NULL` del esquema real y los triggers de auditoría. También se rechazó reutilizar una referencia antigua de mejor de 3: iniciar exige el respaldo nuevo al mejor de 5 y no convierte silenciosamente el formato.

### Corrección final de clasificación y asignación

- Las claves React de la página de clasificación ahora usan prefijos estables (`knockout-operations-*` y `knockout-preview-*`), evitando colisiones cuando el ID de competencia coincide con el ID de llave.
- Una llave confirmada ya no muestra dos tarjetas de la misma final: la operación queda a cargo de `KnockoutOperations` y la vista previa se reserva para propuestas todavía no confirmadas.
- La carga operativa comprueba la fila de formato final y el respaldo complementario 021 antes de mostrar la asignación directa. Si falta el respaldo, se mantiene el acceso breve a Preparar competencia y el error distingue formato/respaldo de un árbitro inválido.
- Se verificaron 40 pruebas Node relacionadas, TypeScript y ESLint focalizado. No se realizaron escrituras remotas.

### Separación definitiva de roles

- Se preparó [022_separar_preparacion_administrador.sql](../supabase/migrations/022_separar_preparacion_administrador.sql) para que la configuración de formatos, final al mejor de 5 y referencias quede reservada al Administrador antes del inicio. El Juez General consulta la preparación entregada y ejecuta la operación deportiva.
- La pantalla de preparación se reutiliza para el Administrador desde el panel administrativo; el Juez General puede consultar el estado en lectura. Las acciones de preparación y aprobación exigen rol Administrador en Next.js y PostgreSQL refuerza la separación mediante trigger/RLS.
- 022 no se ha aplicado remotamente. El estado de aplicación de 021/022 en Supabase no pudo verificarse en esta sesión por falta de una conexión autorizada de solo lectura; la migración queda preparada para revisión manual en orden 021 y luego 022.
### Auditoría de seguridad de 022

- [022_separar_preparacion_administrador.sql](../supabase/migrations/022_separar_preparacion_administrador.sql) exige explícitamente que existan la tabla y la RPC de 021 antes de continuar. La aplicación se detiene dentro de la transacción si 021 no está instalada.
- `configurar_formato_final_021` bloquea la competencia y el control deportivo antes de escribir. Solo permite Administrador autenticado con `configuracion_aprobada=false` y `estado_deportivo='pendiente'`; rechaza competencias entregadas, en curso, suspendidas, finalizadas o canceladas.
- Se conservan `aa_proteger_preparacion_011` y `b_validar` de 003. El nuevo trigger mantiene el advisory lock de preparación y también protege `DELETE`, por lo que una política RLS permisiva no puede eludir el cierre.
- Las políticas 022 permiten al Juez General consultar la preparación, pero los triggers y la RPC impiden sus INSERT/UPDATE/DELETE. El Administrador puede preparar, aprobar y entregar; después de la entrega tampoco puede cambiar formatos o referencias. Árbitros y jugadores no pueden modificar la configuración.
- Runner temporal de contrato [022_separar_preparacion_administrador.test.mjs](../supabase/tests/022_separar_preparacion_administrador.test.mjs): aprobó dependencia 021, configuración administrativa, lectura del Juez, rechazo de modificaciones por Juez, bloqueo posterior a la entrega, `DELETE` protegido e inmutabilidad. La regresión deportiva 016–021 se mantiene en su runner específico; ninguno ejecuta SQL remoto.
- La migración 022 sigue pendiente de aplicación manual. La regresión 016–021 continúa siendo la cobertura del circuito deportivo; esta prueba adicional cubre la separación de preparación y sus permisos.

## Cuenta única Jugador y Árbitro — 023

Se conserva el rol principal y la identidad deportiva. La nueva habilitación de arbitraje por cuenta permite ambos paneles con una sesión; los perfiles Árbitro anteriores conservan inicialmente sus permisos. Administrador habilita/revoca con auditoría y control de concurrencia; RLS, RPC y Server Actions comprueban la habilitación vigente. Se protege el autoarbitraje por encuentro y la reasignación autorizada sin perder actas.

[Arquitectura, compatibilidad, procedimiento de cuentas duplicadas y pruebas](CUENTA_JUGADOR_ARBITRO.md). [Migración 023](../supabase/migrations/023_habilitacion_arbitraje_cuenta.sql) pendiente de revisión/aplicación manual tras 022, cuyo estado local sigue siendo pendiente. No se consultó ni modificó Supabase real. No se editaron migraciones 001–022.

Verificación 023 (2026-11-17): PostgreSQL temporal aprobado, incluidos avance real a final preasignada, reasignación y conservación de asignaciones anteriores; 165 pruebas Node relacionadas aprobadas, TypeScript/diagnósticos y ESLint focalizado correctos. Suite Node completa: 462/467; permanecen cinco fallos de fixtures de preparación rápida relativos a final de tres sets/referencia obligatoria. ESLint global: 17 errores y dos advertencias en scripts históricos. [Detalle y matriz de los 14 casos](CUENTA_JUGADOR_ARBITRO.md). Comprobación visual autenticada pendiente de instalación local con 023; no hubo SQL remoto.
### Cierre de revisión 023

Se retiró la serialización global `pg_advisory_xact_lock(2026023,1)` de las operaciones de arbitraje y resultados. Se conservaron bloqueos de partido/cuadro, filas de perfil y el bloqueo por árbitro para asignaciones incompatibles. La suite Node completa pasa 467/467; la validación PostgreSQL temporal 001–023 también pasa. La migración 023 queda lista para aplicación manual.

### Flujo de final tras clasificación aprobada

La vista operativa ya no devuelve al Juez General a Preparación cuando una llave confirmada carece de un dato visible en la interfaz. Reutiliza el respaldo de la llave y muestra directamente la asignación de árbitro. Si falta de verdad el respaldo documental o el formato final al mejor de cinco de 021, informa ese requisito como excepción administrativa concreta.
