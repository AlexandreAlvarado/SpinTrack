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

- `004_inscripciones.sql`: creada y probada localmente; **no aplicada en Supabase**.
  Incluye solicitudes individuales, decisiones documentadas, historial, RLS y RPC.

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

La migración 004 corresponde a inscripciones. La programación operativa de partidos
queda para una futura migración 005, todavía sin crear ni implementar.

## Juez General: Preparación Deportiva

- Ruta `/panel/juez-general/preparacion`, accesible desde la navegación propia del
  Juez. Selección de temporada/jornada existente y todas sus competencias individuales.
- Borrador de inicio en America/Santiago, mínimo, grupos de tres/cuatro, formato y
  resolución excepcional. Cada etapa de sets se guarda por separado (3 o 5), sin
  precargar reglas ni validar reglamentos desde este panel. Mínimo inferior a cuatro
  exige motivo y referencia; ninguna consulta crea o corrige registros automáticamente.
- Aprobación explícita del borrador guardado, con requisitos pendientes, validación
  del día/plazos en servidor y confirmación de estado/auditoría devueltos por PostgreSQL.
  Todas las acciones verifican juez_general y usan sesión + RLS de 003, sin service_role.
- Configuraciones aprobadas, publicadas o en estados operativos se conservan en lectura.
  No se implementan retiro de aprobación ni transiciones de inicio/suspensión/cierre.
  Se muestran actores/fechas que ya mantiene 003; no existe un historial inmutable de
  cada edición de borrador ni se añadió una tabla para simularlo.
- Guardados por registro, sin transacción global entre control y cinco etapas; errores
  conservan lo ya guardado y no anuncian aprobación. Se comprueban revisiones para
  evitar sobrescribir cambios concurrentes del mismo registro. El día local se valida
  en servidor, no es una nueva restricción SQL de 003 sobre escrituras externas.
- Verificación: 79 pruebas relevantes (Preparación Deportiva, competencias y temporadas
  deportivas), lint y TypeScript. Incluyen renderizado y Supabase simulado; no se
  realizaron guardados reales ni pruebas HTTP autenticadas contra Supabase.
- Comprobar con una cuenta Juez: elegir temporada/jornada, revisar competencia,
  guardar borrador y cada etapa, revisar pendientes y aprobar solo con datos validados.
  Esta versión requiere únicamente 001–003; no necesita aplicar 004.

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
- 004 pendiente elimina conteos y bloqueo por cupos y reemplaza el validador heredado
  validar_competencia_003 para quitar su comparación máximo/mínimo, conservando las
  demás comprobaciones y permisos. Los archivos 001–003 permanecen intactos.
- Antes de aplicar 004, el trigger de 003 aún puede rechazar habilitar inscripciones
  si un valor heredado es menor que el mínimo. La pantalla administrativa advierte
  sobre valores no nulos consultados; no se consultó ni alteró Supabase en esta tarea,
  por lo que su existencia real queda pendiente de revisión autorizada.
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
  futura 005 deberá revalidar admisión antes de programar encuentros reales.
- No hay interfaces todavía. Antes de integrar Next.js, comprobar el rol en servidor,
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

1. Revisar y aplicar 004 en entorno autorizado; desarrollar interfaces de inscripciones.
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

## Comandos de verificación

- `npm run lint`
- `npx tsc --noEmit`
- `node --test tests/*.test.mjs` cuando corresponda.

No ejecutar pruebas SQL destructivas en Supabase de producción.
