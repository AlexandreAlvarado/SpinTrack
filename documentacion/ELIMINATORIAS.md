# Eliminatorias individuales

> Regla vigente: primero y segundo de cada grupo. Consulte la [corrección 017](#corrección-vigente-dos-clasificados-por-grupo-017-2026-11-16). Las secciones anteriores a esa corrección se conservan como historial; sus referencias a un único clasificado ya no están vigentes.

Revisión directa del PDF Bases Liga Regional TDM Los Ríos 2026 (sus siete páginas) y del Excel Grupos 4ra Fecha LR 2026, hoja Grupos. Fecha: 2026-11-15. Se revisaron también grupos, lotes de partidos, resultados Árbitro/Juez y clasificación 015. No se modificaron datos remotos ni migraciones.

## Reglas y evidencia

### Definición entregada para el proyecto

El alcance funcional solicitado establece que clasifica exclusivamente el primer lugar de cada grupo y que la cantidad de clasificados se obtiene contando los grupos de la competencia. Esta definición ya se usa en la propuesta automática: toma `filas[0]` únicamente cuando el grupo tiene resultados completos, aprobación vigente y no existe empate. La definición no aparece con ese detalle en §7 de las Bases revisadas; queda registrada como regla del proyecto pendiente de validación formal con la Liga. No se seleccionan segundos o terceros lugares.

| Tema | Confirmado | Pendiente |
|---|---|---|
| Formato | Bases §7, página 3: grupos de tres/cuatro, luego llave de simple eliminación | Cantidad de clasificados de cada grupo; no se presume uniforme |
| Empates | §9, páginas 4–5 trata ranking anual | Puntuación y desempates de grupos; no trasladar criterios anuales |
| Distribución | §7 menciona sorteo tomando como referencia ranking nacional de la Federación, ranking de la Liga y criterio de organizadores/mesa de control | Prioridad de fuentes, fecha de corte, cantidad y ubicación de cabezas, procedimiento y resolución de empates del ranking |
| Pases | El documento no establece su asignación | Quién recibe pases y cómo se distribuyen; la representación informática de un pase no es autorización deportiva |
| Reencuentros | No se fija una ronda para compañeros de grupo | Ronda mínima y tratamiento de restricciones imposibles |
| Sets | §7 distingue iniciales/aficionados y federados, con finales y cuartos según categoría y decisión sobre aumento de participantes | Aplicabilidad documentada por competencia; este motor no configura sets |
| Resoluciones | §20 permite actualización normativa; §22 remite dudas a comisión organizadora y/o Juez con referencia a Federación y experiencia | Obtener resolución y referencia concretas, sin inventarlas |

El Excel contiene nóminas de grupos, no una llave ni reglas de avance. Tiene rótulos repetidos y celdas vacías; su orden no acredita cabezas de serie. §10 premia dos terceros por fecha; no se agrega partido por tercer lugar.

## Alcance implementado

[Motor puro](../src/lib/eliminatorias.ts): acepta únicamente origen simulado, competencia explícita, participantes autorizados y clasificaciones simuladas completas con aprobación, referencia y sin empate. Cada grupo aporta su lista explícita de clasificados, incluso cero; no calcula cupos por grupo. Rechaza IDs duplicados, participantes ajenos, datos incompletos, grupos repetidos o sin revisión. Los campos opcionales de ranking/cabeza de serie reservan el contrato futuro; si se suministran se rechazan porque no hay algoritmo implementado.

Selecciona la menor potencia de dos suficiente: para las cantidades habituales produce 2, 4, 8, 16 o 32; si una competencia supera 32, continúa con 64, 128, etc., sin convertir 32 en un máximo deportivo. Distribuye posiciones por inversión de bits: un ocupante por rama antes de completar parejas; opcionalmente agrupa orígenes antes de distribuir para intentar alejar compañeros. Es una heurística determinista, no un sorteo ni siembra oficial; no garantiza optimización global. Informa la primera ronda donde podrían reencontrarse. La opción y las referencias por grupo quedan en las decisiones de la propuesta.

Los nodos son encuentros de dos fuentes o pases de una fuente. El pase propaga al jugador, no crea rival, resultado, victoria ni partido disputado. Las rondas posteriores usan la fuente «ganador de cruce»; no se inventan ganadores. Para n clasificados hay n−1 encuentros propuestos y tamaño−n pases. Todos los objetos son nuevos, sin modificar entradas.

[Interfaz](../src/components/knockout-preview.tsx) dentro de la ruta existente de Clasificación y eliminatorias, después de clasificación y validaciones. El laboratorio está contraído y usa nombres sintéticos independientes de la competencia; nunca importa los cuatro jugadores de Peneca Inicial. El estado siempre es vista previa, confirmable=false. No hay acción servidor, escritura, almacenamiento local, confirmación ni edición de resultados. La trazabilidad es local y temporal, visible en decisiones; no constituye auditoría persistida. Cambiar controles invalida la propuesta anterior. Cambiar competencia reinicia el componente.

Una clasificación aprobada no acredita plazas ni sorteo. Ante errores de lectura, la página existente bloquea clasificación y laboratorio; mantiene requireRole y sesión/RLS. Ninguna operación oficial se habilita aunque el cliente altere la vista: no existe endpoint para confirmarla.

### Separación de preparación y ejecución

La preparación administrativa incluye formatos de sets, final al mejor de 5 y referencias deportivas. El Administrador debe completarla antes de entregar la competencia. El Juez General consulta esa configuración y ejecuta grupos y eliminatorias; no puede modificar reglas ni formatos durante la competencia. El Árbitro registra únicamente los sets de sus encuentros asignados.

## Persistencia y confirmación 016

[016_eliminatorias.sql](../supabase/migrations/016_eliminatorias.sql) prepara cuatro tablas: llave, rondas, enfrentamientos y historial. Una llave conserva un borrador o una confirmación, la competencia, tamaño, cantidad de clasificados, pases, método determinista y la fuente de snapshots de clasificación. Los enfrentamientos con dos jugadores potenciales se guardan; los pases no crean filas. Las rondas posteriores pueden conservar dos fuentes pendientes sin inventar ganadores ni marcadores. No hay tabla ni escritura de resultados eliminatorios.

`guardar_propuesta_eliminatoria_016` vuelve a consultar y comparar cada snapshot de 015, exige todos los grupos confirmados, un primer lugar por grupo, aprobaciones vigentes, identidad única y pertenencia a la competencia. Reemplaza solo un borrador activo bajo bloqueo transaccional; una llave confirmada no puede reemplazarse. `confirmar_llave_eliminatoria_016` vuelve a ejecutar las mismas validaciones y además exige referencia de reglas validadas, declaración de datos reales y referencia de confirmación. Las tablas tienen RLS de lectura para operadores y no reciben DML directo del cliente; los RPC son la única puerta de escritura autorizada. Historial y estructuras confirmadas son inmutables.

La interfaz guarda la propuesta automática para revisión, pero la confirmación permanece bloqueada porque la regla del primer lugar y la distribución determinista aún necesitan respaldo formal de la Liga. La migración no se aplica remotamente.

En Gestión de partidos y Clasificación, un único grupo muestra su detalle automáticamente mediante estado derivado; con varios se conserva resumen/selector. Seleccionar grupo no escribe ni cambia estados deportivos.

## Pendiente antes de uso oficial

Obtener resoluciones documentadas de plazas, empates, distribución, ranking/siembra y pases/reencuentros. Mantener resultados separados y flujo Árbitro registra → Juez confirma. La transición a confirmada existe en 016, pero queda bloqueada por las referencias deportivas pendientes y no se aplicó en Supabase real.

## Verificación local

Pruebas deterministas para todas las cantidades 2–32, referencias entre rondas, pases, identidad, repetibilidad sin mutación, plazas desiguales/cero, separación hasta final de dos compañeros en cuadros regulares, restricciones imposibles, empates, aprobaciones inválidas, fuentes ajenas, ranking no implementado y renderizado por rondas. Regresiones de consulta autenticada y error de lectura verifican que no se muestra laboratorio parcial. Sin SQL ni consultas remotas.

Comprobación manual: entrar como Juez → etapa 3 → seleccionar contexto → revisar primero clasificación → abrir Laboratorio → probar 4/8/16/32 y 3/5/12/24/31 → consultar rondas y decisiones. En celular las rondas se apilan; en computador se consultan en columnas con desplazamiento acotado al cuadro. La comprobación visual autenticada y en dispositivo físico debe distinguirse de pruebas de renderizado estático.

## Cierre de verificación de persistencia (016 preparada)

La revisión posterior convirtió la propuesta automática en borrador persistible mediante 016, sin aplicarla en Supabase real. Las pruebas locales cubren competencias de 2, 3, 4, 5, 8, 12, 16 y 32 grupos, primer lugar único por grupo, pases sin partidos ficticios, duplicados, resultados pendientes, empates y aprobaciones desactualizadas. La prueba PostgreSQL temporal verificó guardado, revalidación por snapshot, confirmación atómica, RLS, historial e inmutabilidad. La confirmación de producción sigue bloqueada hasta recibir las resoluciones reglamentarias indicadas arriba.

## Revisión correctiva de seguridad e integridad (016 aún no aplicada)

La versión original tenía un defecto confirmado: el segundo guardado intentaba borrar el borrador y chocaba con la FK `eliminatorias_historial.llave_id` `ON DELETE RESTRICT`. Se corrigió sin borrar versiones: el borrador anterior pasa a `reemplazada`, se agrega un evento `borrador_reemplazado` y la nueva versión conserva su propio historial.

También se endureció la validación antes de persistir. PostgreSQL reconstruye la distribución determinista por grupo, comprueba todos los orígenes, jugadores, cruces, rondas, posiciones y avances, y rechaza cualquier JSON manipulado. Los pases no se aceptan como enfrentamientos persistibles. La cobertura exige que todos los grupos de la competencia estén confirmados; no basta contar el subconjunto confirmado.

La prueba de motor cubre cuadros de 3, 5 y 12 clasificados. La prueba temporal de PostgreSQL verifica guardado, reemplazo con historial, confirmación, inmutabilidad y rechazo de propuestas manipuladas. La migración sigue sin aplicarse remotamente.

## Compatibilidad de encuentros con fuentes pendientes (2026-11-16)

La restricción anterior que exigía que ambos `jugador_id` fueran simultáneamente nulos o no nulos rechazaba un cuadro válido cuando un lado era un jugador conocido por pase y el otro provenía de un ganador pendiente. La tabla ahora permite combinaciones mixtas y conserva `origen_a`/`origen_b` como fuente de verdad. La RPC reconstruye la llave autorizada, por lo que no se aceptan participantes ni cruces inventados y los pases continúan sin persistirse como partidos.

## Estado de aplicación de 016 (2026-11-16)

El desarrollador confirmó la aplicación manual de 016 en Supabase de producción y verificó sus cuatro tablas y las dos RPC de guardado/confirmación. La interfaz Next.js ya consulta la llave activa más reciente, descarta versiones reemplazadas al recuperar el estado y conserva el bloqueo de confirmación oficial mientras falte respaldo reglamentario. No se han insertado jugadores ficticios ni datos de prueba en producción.

## Corrección vigente: dos clasificados por grupo (017, 2026-11-16)

Esta sección sustituye las definiciones históricas de un clasificado por grupo que se conservan arriba para trazabilidad. **Clasifican automáticamente primero y segundo de cada grupo por instrucción expresa del usuario.** Las plazas ya están definidas; siguen pendientes de validación el sorteo/distribución, siembra, asignación deportiva de pases y reencuentros. No se presume oficial el cruce A1-H2.

### Motor y propuesta deportiva

[Motor TypeScript](../src/lib/eliminatorias.ts): ordena los grupos por número e ID y toma las filas 1 y 2 de clasificaciones completas, aprobadas y vigentes. Exige dos identidades distintas, pertenencia al grupo y unicidad en toda la competencia. Bloquea resultados/revisiones pendientes y empates sin resolver. La aprobación de 015 todavía exige ausencia de cualquier empate: se conserva esa condición más estricta, sin inventar un mecanismo de desempate o permitir aprobar el resto de un grupo empatado.

Para G grupos hay 2G clasificados y el cuadro tiene la menor potencia de dos suficiente. Los pases son posiciones menos clasificados; no se crean partidos ficticios. No hay enumeración cerrada de rondas ni máximo deportivo de grupos o jugadores. Se conservan Final, Semifinales, Cuartos y Octavos; las rondas mayores se denominan «Ronda de N · N/2 encuentros».

La propuesta técnica alterna los grupos ordenados entre dos conjuntos: cada mitad recibe primeros de uno y segundos del otro. Dentro de cada mitad, los primeros ocupan lados pares de parejas desde el inicio y los segundos lados impares desde el final. Como el cuadro es mínimo, todas las parejas tienen al menos una fuente. Todo encuentro inicial de dos jugadores enfrenta primero contra segundo de otro grupo; los compañeros quedan en mitades opuestas, incluso con pases. El algoritmo no usa ranking ni aleatoriedad y **no constituye sorteo oficial**. El reparto de pases resultante debe validarse, no se presenta como derecho deportivo.

Con un único grupo hay dos clasificados y dos posiciones, pero cero rondas autorizadas. No se propone su reencuentro, no se declara campeón y el guardado SQL queda bloqueado hasta contar con una regla deportiva validada.

### Migración incremental y compatibilidad

[017_dos_clasificados_por_grupo.sql](../supabase/migrations/017_dos_clasificados_por_grupo.sql) está aplicada en Supabase de producción junto con 016. **No se modifica ni reaplica 017.** La referencia histórica que describía 017 como pendiente queda superada por la aclaración vigente del desarrollador.

017 reutiliza las tablas, índices, RLS, triggers, bloqueos y auditoría de 016. Reemplaza mediante CREATE OR REPLACE sus tres auxiliares de validación, generación y canonización: las RPC antiguas también pasan a exigir dos plazas, evitando una puerta alternativa con la regla anterior. Cada fuente identifica grupo, posición 1/2, jugador y snapshot. Se verifica exactamente una pareja de plazas por cada grupo confirmado de la competencia, pertenencia, duplicados y snapshots actuales; se consulta clasificación una vez por grupo y se agrupan las fuentes antes de iterarlas. PostgreSQL reconstruye todos los encuentros y compara la estructura normalizada enviada por TypeScript. Los nombres de ronda y las decisiones persistidas se generan en servidor; campos decorativos del cliente se descartan.

La RPC nueva `guardar_propuesta_eliminatoria_017` delega en el guardado transaccional de 016 bajo la validación nueva. Conserva sesión, rol Juez General, bloqueo de competencia/grupos/partidos, historial inmutable y ausencia de DML directo. La propuesta persistida incluye `version_regla: 17`.

La migración no ejecuta UPDATE/DELETE sobre llaves ni historial. Los borradores antiguos siguen consultables, pero no pueden confirmarse con una sola plaza ni convertirse silenciosamente: el Juez debe regenerar y guardar explícitamente; la versión anterior pasa a reemplazada y conserva sus encuentros e historial. Las llaves ya confirmadas permanecen exactamente iguales e inmutables. Su eventual revisión deportiva necesita un procedimiento específico fuera de este cambio.

### Interfaz y capacidad técnica

[Vista de eliminatorias](../src/components/knockout-preview.tsx): muestra grupos, dos plazas por grupo, total de clasificados, cuadro, pases y encuentros propuestos. El guardado usa 017 y avisa claramente si falta aplicarla. La confirmación oficial permanece bloqueada también en la acción servidor mientras no se valide la distribución. Una llave confirmada muestra su resumen histórico; nunca se presenta una propuesta recalculada como si fuera esa estructura oficial.

Se consulta una ronda a la vez, con páginas de 32 nodos: la paginación limita el DOM, no el tamaño del cuadro. El laboratorio acepta cualquier cantidad par representable, sin lista cerrada ni selector de jugadores. La [página del Juez](../src/app/panel/juez-general/clasificacion/page.tsx) consulta todos los grupos en lotes de hasta ocho RPC simultáneas, sin limitar el total. Las lecturas conservan el bloqueo de vistas parciales ante errores.

Los límites técnicos existentes no son reglas deportivas: columnas INTEGER de 016, memoria de PostgreSQL/Node/navegador, tiempo de las peticiones y Server Actions configuradas actualmente en 3 MiB. El motor y SQL calculan potencias sin operaciones binarias de 32 bits y rechazan claramente un cuadro que exceda INTEGER antes de convertirlo. Los orígenes persistibles usan IDs compactos para reducir el transporte. La interfaz detecta una propuesta que exceda el presupuesto de envío (3 MiB menos 8 KiB para campos/delimitadores) y explica que se requiere ampliar infraestructura; no descarta jugadores ni reduce plazas. Errores de memoria, complejidad o timeout de PostgreSQL se traducen a un mensaje de capacidad. Esto no promete capacidad física infinita: para volúmenes que excedan esos recursos se debe ampliar almacenamiento/transporte o introducir un protocolo por lotes, conservando las mismas reglas deportivas.

### Verificación exclusivamente local

[Fixtures](../tests/fixtures/dos-clasificados.mjs) y [pruebas del motor, interfaz y acciones](../tests/eliminatorias.test.mjs): 1, 2, 3, 4, 5, 8, 12, 16, 30, 31, 32, 33, 40, 50, 64, 100, 129 y 257 grupos; dos plazas ordenadas, cuadro mínimo, pases, n−1 encuentros, ausencia de duplicados/pérdidas, referencias entre rondas, primeros contra segundos y mitades opuestas. También empates en segundo, aprobaciones vencidas, resultados pendientes, pertenencia, guardado por rol, confirmación bloqueada y paginación.

[Runner PostgreSQL temporal 017](../supabase/tests/017_dos_clasificados_por_grupo.test.mjs): crea un clúster exclusivo en loopback:55420, aplica 016 sin modificarla y después 017. Usa las propuestas producidas por el motor real, con clasificaciones sintéticas locales que implementan el contrato de 015; no utiliza Auth/PostgREST remotos. Cubre todas las escalas obligatorias hasta 100 grupos, reemplazo de borradores con historial, fuentes/posiciones/JSON manipulados, snapshots vencidos, grupos ajenos, pases sin filas de partidos, ACL, RLS e inmutabilidad. Compara una llave confirmada bajo 016 (incluidos rondas, encuentros e historial) antes y después de 017 y simula corrección concurrente durante confirmación en conexiones independientes. La suite temporal independiente de 015 valida el cálculo y las aprobaciones reales de clasificación, permisos, empates y concurrencia.

| Grupos | Clasificados | Cuadro | Pases |
|---:|---:|---:|---:|
| 30 | 60 | 64 | 4 |
| 31 | 62 | 64 | 2 |
| 32 | 64 | 64 | 0 |
| 33 | 66 | 128 | 62 |
| 40 | 80 | 128 | 48 |
| 50 | 100 | 128 | 28 |
| 64 | 128 | 128 | 0 |
| 100 | 200 | 256 | 56 |

No se ejecuta SQL remoto, no se modifican datos reales ni migraciones 001–016 y no se confirman llaves oficiales con fixtures. Esta anotación corresponde al estado previo a la aplicación productiva de 017; la comprobación visual autenticada de 017 y la revisión manual de 018 permanecen pendientes. Resultados eliminatorios y avance de ganadores quedan reservados para la futura 018.

### Resultado final de verificación de 017

- Suite Node completa: **438/438 pruebas aprobadas** (`node --test --test-reporter=dot tests/*.test.mjs`).
- TypeScript (`npm run typecheck`) y ESLint focalizado en motor, interfaz, página, acciones, fixtures y runner 017: aprobados, sin advertencias. Diagnósticos del editor sin errores en los archivos TypeScript modificados.
- PostgreSQL 18 temporal: suites 015 y 017 aprobadas; 017 incluye todas las escalas obligatorias, canonización de propuestas TypeScript, preservación exacta de confirmadas 016 y dos conexiones concurrentes. Los servidores temporales se detuvieron y se limpiaron sus directorios de prueba.
- `npm run lint` global no pasa: **17 errores y una advertencia preexistentes**, fuera de los archivos de este cambio. Cinco errores en [runner 005](../supabase/tests/005_eliminar_cupo_maximo.test.cjs) y [generador 005](../supabase/tests/generar-005.cjs); doce en scripts locales anteriores de `test-results`; una advertencia en [runner 009](../supabase/tests/009_participantes_competencia.test.mjs). No se modifican para ocultar el resultado.
- Comparación SHA-256 contra el inicio del trabajo: **001–017 intactas**. 018 permanece sin aplicar remotamente.

## Fase 018: resultados y eliminación directa (2026-11-16)

Esta sección amplía el historial anterior. Primero y segundo clasifican por grupo; después cada derrota elimina definitivamente de esta competencia. No hay repechaje, doble eliminación, encuentro de tercer lugar ni puntos para ranking anual. El Árbitro envía una captura; solo la confirmación oficial del Juez General produce avance. La distribución, los pases y los reencuentros siguen pendientes de validación formal. El único grupo con dos clasificados continúa bloqueado por 017.

### Persistencia complementaria

[018_resultados_eliminatorias.sql](../supabase/migrations/018_resultados_eliminatorias.sql) se prepara localmente sobre 017. No modifica 001–017 ni actualiza llaves, rondas, enfrentamientos o historial de 016. No inserta datos iniciales. Las llaves históricas sin `version_regla: 17` permanecen consultables y no se convierten a operativas.

- `eliminatorias_respaldos`: puerta documental por llave. Referencias de distribución y de pases/reencuentros, responsable e instante. Sin RPC de alta, permisos de escritura de cliente ni activación automática. Aplicar 018 deja esta tabla vacía y la operación bloqueada.
- `eliminatorias_cuadros`: competencia, estado operativo, campeón, finalista y cierre. La estructura oficial conserva su estado histórico `confirmada`; la finalización reside exclusivamente en esta tabla.
- `eliminatorias_partidos`: una fila por enfrentamiento real oficial, con referencia a llave/ronda/original, fuentes de ganadores, jugadores resueltos, Árbitro, formato de sets y estado pendiente/en desarrollo/revisión/observado/confirmado. `perdedor_id` identifica al eliminado de esta llave; no se altera su ficha ni su participación en otras competencias. Un índice único impide dos eliminaciones del mismo jugador.
- `eliminatorias_actas`: revisiones de sets inmutables, sin ganador elegido por el navegador. Reutiliza `calcular_resultado_sets_012` y sus reglas ITTF. Solo resultados ordinarios: las incidencias que necesitan una resolución específica no inventan ganadores.
- `eliminatorias_eventos`: historial inmutable de inicio, asignaciones, desarrollo, envíos, observaciones, confirmaciones y campeón; conserva actor, referencia, acta e instantánea operativa (incluido el Árbitro asignado).

`iniciar_eliminatoria_018` exige Juez, llave confirmada bajo 017, declaraciones reales/de reglas de la llave y respaldo manual. Revalida las clasificaciones y copia los formatos existentes por etapa: final para dos posiciones, semifinal para cuatro, cuartos para ocho y previa_cuartos para las anteriores. Exige referencia de resolución, no deduce número de sets y congela ese formato en cada partido. Lee las fuentes canónicas; los pases ya propagados por 017 aportan jugadores directamente, sin filas de partido, actas, Árbitro ni victorias ficticias.

`operar_eliminatoria_018` separa operaciones de Árbitro asignado (comenzar/enviar) y Juez (asignar/observar/confirmar). Impide autoarbitraje y revisión del propio resultado. Una observación requiere una nueva revisión del Árbitro antes de confirmar; los envíos pendientes no avanzan. No hay corrección de resultados confirmados. Un procedimiento excepcional futuro necesitaría diseño independiente.

Todas las mutaciones bloquean primero el cuadro y después el partido, serializando confirmaciones dentro de una competencia y permitiendo cuadros independientes. La confirmación recalcula el acta, identifica ganador y perdedor, resuelve ambos posibles destinos por sus fuentes, registra el evento y, si es la final y todos los encuentros están confirmados, fija campeón/finalista y cierre en la misma transacción. Reintentar la misma revisión confirmada devuelve el partido sin nuevos eventos. Otra revisión obsoleta se rechaza. Las actas/eventos son inmutables; también se protegen partidos confirmados, respaldos y cuadros finalizados frente a cambios o borrados accidentales.

RLS está habilitada en todas las tablas nuevas. Solo se concede SELECT y ejecución de RPC públicas concretas a authenticated; sin DML ni secuencias para clientes, anon o service_role. Auxiliares privados y `search_path` vacío. Árbitros leen únicamente sus partidos, actas, eventos y los dos jugadores asociados; no se amplían las políticas de lectura de las llaves históricas. Los triggers vuelven a comprobar la coincidencia entre acta, autor, asignación, revisión, ganador y sets. La cuenta propietaria de la base conserva su capacidad administrativa: no usarla en la aplicación.

### Interfaz y pruebas

[Componente operativo](../src/components/knockout-operations.tsx) en Clasificación del Juez y en Resultados del Árbitro, sin nuevos menús. Reutiliza [ResultCard](../src/components/match-results.tsx), puntuaciones, revisión y observaciones. Muestra estados, participantes pendientes y fuentes, eliminados, campeón/finalista e historial. El Juez consulta una ronda a la vez; el Árbitro consulta sus asignaciones. [Acciones](../src/app/panel/juez-general/clasificacion/operacion-actions.ts) verifican sesión/rol y consultan páginas de 16 encuentros más una fila de anticipación en el servidor. Las actas y el historial de esa página se leen en lotes de 500 sin truncar revisiones; errores de lectura descartan la página parcial. No se impone un máximo deportivo de clasificados.

[Pruebas Node](../tests/eliminatorias-operacion.test.mjs) verifican autorización, datos manipulados del navegador, correcciones motivadas, observación, inmutabilidad en formularios y paginación. [Runner PostgreSQL temporal](../supabase/tests/018_resultados_eliminatorias.test.mjs) usa un directorio exclusivo en TEMP, loopback y un puerto disponible; aplica 016, 017 y 018 reales, con clasificaciones locales del contrato 015 y el validador real de 012. Verifica 4, 6, 8, 16, 32, 64 y 128 clasificados, pases, resultados pendientes/observados sin avance, participantes incompletos, autoarbitraje, permisos, revisión, semifinales, final, campeón, eliminados, reintentos, dos conexiones concurrentes y preservación de originales. Los fixtures y sus respaldos existen únicamente en ese clúster temporal. No equivalen a validación de datos ni reglamentos de producción.

### Aplicación manual segura

1. Revisar y respaldar el esquema real y las llaves existentes. El estado vigente es **001–018 aplicadas según confirmación del desarrollador**; esta sesión no consulta ni modifica Supabase remotamente.
2. No reaplicar ni editar 001–018. La aplicación usa las tablas y RPC de 018 y mantiene la revisión deportiva, respaldo por llave y bloqueo de un único grupo. La interfaz no convierte borradores históricos ni declara campeones desde posiciones de grupo.
4. Obtener resolución formal sobre distribución, pases y reencuentros, incluyendo su aplicabilidad por competencia. No basta la referencia técnica del algoritmo. La confirmación de nuevas llaves sigue bloqueada en el flujo de propuesta existente.
5. Después de resolver ese bloqueo en una tarea expresamente autorizada, generar y confirmar una llave real con 017. Revisar sus fuentes y formatos aprobados. Solo entonces un operador de base autorizado puede registrar, manualmente, el respaldo verificable de esa llave en `eliminatorias_respaldos`, con identidad real del responsable. No copiar fixtures ni otorgar DML a clientes para hacerlo.
6. Iniciar explícitamente desde el panel del Juez; comprobar asignación, Árbitro, observación, confirmación y avance con cuentas reales autorizadas. No usar producción para ensayos ficticios. La comprobación visual autenticada, móvil y en dispositivo físico continúa pendiente.

Resultados finales de las verificaciones de 018 se registran al cierre de esta sección y en ESTADO_PROYECTO.md. En esta sesión no se aplicaron migraciones remotamente; 017 y 018 se consideran instaladas por confirmación del desarrollador.

### Cierre de verificación de 018

- Suite Node completa: **447/447 aprobadas**, incluidas nueve pruebas nuevas de operación y la regresión del formulario compartido. Comando: `node --test --test-reporter=spec tests/*.test.mjs`.
- `npm run typecheck`, diagnósticos del editor y ESLint focalizado en los archivos TypeScript y pruebas modificados: sin errores ni advertencias.
- PostgreSQL 18 temporal 018: **aprobado** para 4, 6, 8, 16, 32, 64 y 128 clasificados. Incluye recorrido hasta campeón, dos conexiones simultáneas, confirmación repetida, final parcialmente resuelta tras una semifinal, paginación real de SQL, correspondencia exacta con ganadores de origen y comparación completa de llave histórica 016 (llave, rondas, encuentros e historial). También pasó la regresión temporal independiente de 015 con su clasificación real.
- En la ejecución registrada, completar las rondas y comprobaciones tras el primer encuentro tomó aproximadamente 3,6–8,4 segundos por escala; 128 clasificados, 8,4 segundos. Incluye arranque de procesos psql y consultas de prueba; **no es una medición de latencia de la aplicación ni una garantía de rendimiento en producción**. El DOM y la consulta de encuentros quedan paginados; el tamaño deportivo no se limita.
- `npm run lint` global conserva **17 errores y una advertencia preexistentes**, en los mismos scripts históricos 005, runner 009 y scripts anteriores de test-results documentados en 017. No se modifican esos archivos.
- SHA-256: todos los archivos de migraciones 001–017 disponibles al inicio permanecen idénticos. Los clústeres de prueba se detienen y se eliminan sus directorios exclusivos; el runner 018 verifica el destino absoluto antes de borrar.
- Pendientes: resolución deportiva formal y comprobación visual autenticada/móvil contra la instalación productiva. No hay campeones simulados en producción; los borradores históricos solo se advierten y requieren regeneración explícita.

### Revisión correctiva de dependencia y esquema (018)

La búsqueda completa del repositorio confirmó que `public.bloquear_fuente_eliminatoria_016(bigint)` sí está definida en [016_eliminatorias.sql](../supabase/migrations/016_eliminatorias.sql) y es reutilizada por las RPC de guardado/confirmación de 016. 018 no la reemplaza ni la elimina. El bloque de precondiciones de 018 ahora verifica su existencia mediante `to_regprocedure`; una aplicación sobre un esquema incompleto se detiene antes de crear tablas.

El inicio operativo adquiere el mismo advisory lock `(2026003, 2)` que 011/016, bloquea la competencia, llama a `bloquear_fuente_eliminatoria_016` (grupos y partidos ordenados) y recién después bloquea la llave. Así se serializan correcciones de resultados de grupos, confirmaciones de llaves e inicio del cuadro. Las confirmaciones de resultados 018 mantienen primero el bloqueo del cuadro y después del partido; no se mezclan órdenes durante el inicio.

El runner [018_resultados_eliminatorias.test.mjs](../supabase/tests/018_resultados_eliminatorias.test.mjs) dejó de usar una tabla de formatos de cuatro columnas. Su fixture local incluye la FK a `competencia_control_deportivo`, las cinco etapas admitidas, PK `(competencia_id, etapa)`, checks `mejor_de IN (3,5)`, referencia reglamentaria, responsable/instante de actualización y RLS con SELECT para `authenticated`. El runner no reproduce los triggers administrativos completos de 003 ni sus cinco verificaciones de aprobación; por eso esa parte sigue requiriendo revisión manual contra el esquema real antes de aplicar 018.

Resultado de la revisión: la función cuestionada existe; la dependencia queda comprobada y con orden de bloqueo compatible. Según la confirmación del desarrollador, 018 ya está instalada; permanecen la revisión operativa autenticada, el respaldo deportivo por llave y la validación formal de distribución/pases/reencuentros. No se ejecutó SQL remoto en esta sesión.

## Fase 019: final de grupo único

La regla vigente para una competencia con un único grupo es una final nueva entre primero y segundo. El encuentro de grupos no sustituye la final. El tercer y cuarto lugar se conservan desde la clasificación del grupo para la clasificación final, sin crear partido de tercer lugar.

La migración [019_final_grupo_unico.sql](../supabase/migrations/019_final_grupo_unico.sql) añade RPC separadas para validar, guardar y confirmar esta propuesta, y adapta el inicio operativo de 018 para aceptar la versión 19. Las llaves históricas 016/017 no se convierten. La aplicación Next.js selecciona la RPC 019 solo cuando la propuesta contiene un único grupo; las competencias de varios grupos siguen usando 017.

La confirmación requiere una referencia de decisión deportiva configurada para SpinTrack, una referencia reglamentaria y una declaración de datos reales. Esas referencias no se presentan como aprobación externa de la Liga. La aplicación manual de 019 y la prueba autenticada completa quedan pendientes; las pruebas locales no escriben en Supabase.

La firma final de `confirmar_llave_eliminatoria_019` también recibe `p_referencia_pases_reencuentros`. El valor es obligatorio y debe ser aportado por el Juez General; la migración no inventa una referencia deportiva. El runner temporal de 018 aplica 019 y comprueba el circuito completo hasta campeón, observación/corrección e idempotencia concurrente. 019 está lista para revisión manual, pero no se ejecutó en Supabase remoto.


### Corrección final de 019

El reemplazo de un borrador histórico 016 conserva `metodo_distribucion='determinista_por_grupo'` en `eliminatorias_historial`, mientras la propuesta JSON identifica la regla 19 como `final_grupo_unico`. La validación comprueba ambas posiciones, identidad distinta, pertenencia, snapshots, empates y pendientes. El runner temporal ejecuta el caso completo de un grupo con cuatro participantes y confirmó que guardar la final nueva ya no produce un error de restricción.
### Preparación y ejecución por roles

La configuración previa de formatos, referencias y final al mejor de cinco pertenece al Administrador. La entrega de la competencia cierra esa preparación. Desde entonces el Juez General solo consulta la configuración y dirige grupos, llaves, árbitros y confirmaciones; el Árbitro registra únicamente sus encuentros asignados.

La migración 022 conserva los bloqueos de 003 y 011, serializa la preparación con el mismo advisory lock y protege también eliminaciones. Requiere que 021 exista antes de aplicarse y permanece pendiente de aplicación manual.

## Cuenta única y autorización arbitral — 023

La [migración 023](../supabase/migrations/023_habilitacion_arbitraje_cuenta.sql) conserva llaves, cuadros, actas y eventos. Las RPC 018/020 reconocen arbitraje_habilitado independientemente del rol principal. El comienzo/envío valida los participantes actuales: si el avance o un cambio de vínculo convierte al árbitro en participante, se bloquea su actuación y el Juez debe reasignarlo.

Se permite sustituir un asignado revocado o participante antes de capturas, o después de observar una captura. Una asignación apta conserva su protección y los bloqueos operativos de 020. Las nuevas asignaciones registran eventos sin borrar actas ni cambiar resultados oficiales. El selector excluye participantes del encuentro concreto, sin excluir toda una jornada.

[Detalle de arquitectura, concurrencia, compatibilidad y aplicación manual](CUENTA_JUGADOR_ARBITRO.md). El [runner 023](../supabase/tests/023_habilitacion_arbitraje.test.mjs) comprueba final 019/020 real, revocación, conflicto por vínculo cambiado, reasignación, sets, observación/corrección y confirmación concurrente hasta campeón. 023 permanece pendiente de aplicación manual después de 022; no se ejecutó SQL remoto.

Cierre local 023 (2026-11-17): runner PostgreSQL aprobado también para dos grupos, semifinales reales y propagación de un ganador a una final con asignación anticipada incompatible. Se rechaza el comienzo por autoarbitraje y el Juez reasigna. La final 019/020 recorre observación, nueva captura y confirmación concurrente hasta campeón. Se comparan sin cambios asignaciones/auditoría anteriores a 023. [Resultados completos y limitaciones de las verificaciones](CUENTA_JUGADOR_ARBITRO.md).
### Revisión de concurrencia 023

Las operaciones de eliminatorias ya no dependen de un bloqueo global compartido con partidos de otras competencias. Se mantienen el orden cuadro → partido y las comprobaciones de autoarbitraje, revocación y reasignación.
