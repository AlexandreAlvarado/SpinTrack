# SpinTrack — auditoría funcional previa a Vercel

Fecha: 19 de noviembre de 2026. Alcance: copia local de trabajo, incluidos los cambios existentes al comenzar. No equivale a certificar el esquema desplegado en Supabase ni a aceptación de usuarios.

## Dictamen

La regresión local, TypeScript, ESLint y la compilación de producción permiten continuar con la preparación de una prueba de aceptación. El despliegue requiere comprobar las migraciones realmente instaladas y completar la matriz manual por perfil. No se modificaron datos reales, cuentas, roles ni migraciones remotas. No se implementaron dobles, módulos nuevos ni rediseños.

## 1. Funciones verificadas

| Área | Verificación y evidencia | Límite |
| --- | --- | --- |
| Administrador | Suites de temporadas, catálogos, jugadores, categorías, competencias y preparación: validaciones, referencias de temporada, publicación y errores. Preparación administrativa separada de la dirección deportiva. Habilitación de arbitraje mediante RPC 023, conservando cuenta y rol principal. | Requiere aceptación con cuenta Administrador; no se certifica la operación remota. |
| Juez General | Suites de participantes, grupos, partidos, clasificación y eliminatorias: revisión de sets, observación/corrección, confirmación, clasificación vigente, llaves y avance. Historial y operaciones por estado. Navegación sin rutas repetidas en las pruebas de componentes. | Las pruebas de componentes no sustituyen un recorrido visual completo con usuario Juez. |
| Jugador/Árbitro | PostgreSQL 023 reutilizado por 025/026: una cuenta Jugador habilitada registra otro encuentro; no confirma resultados; revocación retira autorización; autoarbitraje rechazado al asignar y después del avance. Se conserva historial y actas. | JWT y usuarios se representan con fixtures locales; falta aceptación de Auth real y sesiones simultáneas. |
| Servidor | Guardas consultan perfil de identidad verificada con `getClaims`; no confían en el rol enviado por formulario o metadata. Server Actions verifican rol/habilitación antes de escribir. Pruebas de formularios manipulados y RPC rechazadas. | No es una prueba de penetración exhaustiva. |
| PostgreSQL | RLS, privilegios y RPC probados con roles `anon` y `authenticated`, identidades sintéticas, escrituras directas rechazadas y control de revisión. | Clúster PostgreSQL 18 local con esquema Auth mínimo; no reproduce toda la infraestructura Supabase. |
| Público | Runner 025: jornada borrador/competencia no publicada oculta incluso por ID directo; actas pendientes sin sets ni ganador; clasificación obsoleta oculta; clasificación vigente y campeón confirmado visibles. Sin acceso anónimo a perfiles, actas y tablas privadas comprobadas. | Un encuentro pendiente puede aparecer como programación, sin resultado pendiente expuesto. |
| Ranking | Runner 026 y suites Node: siete fechas explícitas, seis mejores puntajes, jornada 8 excluida, configuración solo Administrador, resoluciones solo Juez, final confirmada e historial. No se deducen puestos ambiguos. | Configuración y decisiones documentales reales deben verificarse por Liga. |
| Simulaciones | Separadas de la consulta oficial; ruta administrativa con control de rol y bloqueo en producción. Hipótesis 15/71 y puestos sin autorización no se incorporan al ranking oficial. | Desarrollo puede mostrar hipótesis explícitas sin persistencia; no constituyen reglas oficiales. |
| Errores y móvil | Suites de lectura fallida, estados pendientes, formularios, tablas y navegación. La validación móvil real de ocho criterios fue informada por el desarrollador y se conserva como antecedente. | No se repitió el recorrido móvil ni de escritorio con todos los perfiles en esta auditoría. |

La protección de la ruta alternativa de partidos se hereda de la página de resultados que exporta; no necesita una guarda duplicada. El panel Jugador usa la identidad propia y puede ser consultado por una cuenta autenticada con otra función sin otorgar permisos administrativos.

## 2. Hallazgos y gravedad

| ID | Gravedad | Evidencia | Estado |
| --- | --- | --- | --- |
| A-01 | Media, control de calidad | ESLint fallaba con cinco errores `react-hooks/error-boundaries` por JSX dentro del `try` de lectura en simulación. | Corregido: capturar el fallo de lectura antes de construir la vista; conserva el mensaje de error y evita simulación parcial. |
| A-02 | Media, exactitud deportiva en desarrollo | La simulación de varios grupos usaba la posición de grupo como puesto final: podía asignar primer lugar a un semifinalista o segundo al campeón. | Corregido: puestos 1/2 dependen de campeón/finalista confirmados. Regresión con campeón segundo de grupo, semifinalista primero y final pendiente. |
| A-03 | Baja, documentación | El README todavía describe el primer hito y afirma que faltan módulos y pruebas actualmente existentes. | Pendiente de actualización editorial; usar este informe y documentación de cada módulo para la aceptación. |
| A-04 | Baja, mantenibilidad | ESLint informa cuatro advertencias: navegación con `window.location.href` en simulación y tres advertencias en runners históricos. | No bloquean ESLint. No se alteraron runners históricos por limpieza. |
| A-05 | Baja, fiabilidad de pruebas | Al ejecutar build en paralelo, el runner ampliado falló en el umbral auxiliar de concurrencia de 700 ms. Las suites originales 025/026 sí pasaron ese control. | La nueva suite de escalas omite ese bloque temporal; conserva las comprobaciones deportivas y de revisión. No se cambió el runner original ni se presenta ese fallo como defecto del producto. |

No se identificaron defectos críticos/altos en las comprobaciones ejecutadas. Esto no certifica ausencia de vulnerabilidades ni confirma políticas instaladas remotamente.

## 3. Correcciones y archivos propios de esta auditoría

- [Página de simulación](../src/app/panel/administrador/ranking/simulacion/page.tsx): corregido el control de lectura que impedía aprobar ESLint.
- [Vista de simulación](../src/components/ranking-simulation.tsx): corregidos los puestos finales de varios grupos sin modificar el diseño.
- [Regresión de simulación](../tests/ranking-simulation.test.mjs): render con campeón segundo de grupo, semifinalista sin puesto final y final pendiente.
- [Escalas PostgreSQL](../supabase/tests/auditoria_escalas.test.mjs): escenarios aislados con RPC reales y reutilización controlada del runner 023; puntos de inserción verificados, sin modificarlo.
- Este informe. Los demás cambios locales ya existían al iniciar la auditoría.

Las migraciones [025](../supabase/migrations/025_lectura_torneos_publicos.sql) y [026](../supabase/migrations/026_ranking_oficial_2026.sql) se conservaron intactas. No se cargó historia ficticia en Supabase; todos los fixtures deportivos pertenecen a clústeres temporales.

## 4. Ejecuciones reproducibles

Desde la raíz del proyecto:

```powershell
npm run typecheck
npm run lint
node --test tests/*.test.mjs
node supabase/tests/025_lectura_publica.test.mjs
node supabase/tests/026_ranking.test.mjs
node supabase/tests/auditoria_escalas.test.mjs
npm run build
```

- TypeScript: aprobado.
- ESLint: aprobado, cero errores y cuatro advertencias; revisión específica de archivos nuevos incluida.
- Node: 513/513 antes de corregir; 514/514 después de agregar la regresión.
- PostgreSQL 025: aprobado, incluye el escenario 023 completo y final independiente de cuatro jugadores.
- PostgreSQL 026: aprobado, incluye escenario 023, permisos e historial oficial de ranking.
- Escalas 8/16: aprobadas con RPC reales hasta campeón confirmado.
- Build de producción: aprobado con Next.js 16.4.6.
- HTTP en servidor local de producción, puerto 3001: `/`, `/calendario` y `/ranking` devuelven 200; paneles Administrador, Juez y Árbitro devuelven 307 a login sin sesión; `/dev/eliminatorias` devuelve 404. La simulación administrativa sin sesión redirige a login; no se usó una cuenta autenticada en este smoke test. Un 200 público prueba disponibilidad de la página, no que existan datos oficiales configurados.

La prueba nueva inicialmente esperaba rechazo de una confirmación repetida; la RPC vigente devuelve el mismo partido para la misma revisión. Se corrigió esa expectativa: se comparan partidos, eventos y cuadro antes/después, exigiendo igualdad. La idempotencia es comportamiento válido y no se cambió código deportivo por esa expectativa de prueba.

### Matriz deportiva de cierre

| Jugadores | Grupos | Partidos de grupo | Clasificados | Eliminatoria | Resultado |
| --- | --- | --- | --- | --- | --- |
| 4 | 1 de 4 | 6 | 2 | Final independiente; acta de grupo no decide campeón | Aprobado en PostgreSQL 025/026 |
| 8 | 2 de 4 | 12 | 4 | 2 semifinales y 1 final | Aprobado en runner de escalas |
| 16 | 4 de 4 | 24 | 8 | 4 cuartos, 2 semifinales y 1 final | Aprobado en runner de escalas |

Las escalas comprueban conteos y pares únicos de grupo, dos plazas por grupo, secuencia de rondas, envío sin avance, confirmación y campeón final. Repetir una confirmación conserva exactamente partidos, eventos y cuadro. La suite Node de eliminatorias comprueba además IDs de clasificados distintos, ausencia de jugadores repetidos y rechazo de clasificación incompleta, empatada, duplicada u obsoleta. Los escenarios 025/026 comprueban que el envío de la final no publica campeón ni marcador pendiente.

Los runners PostgreSQL crean bases locales, puerto dinámico de loopback y perfiles sintéticos; detienen y eliminan sus clústeres al finalizar. La primera inicialización fue rechazada dentro del sandbox y se ejecutó con permisos ampliados para el proceso local; no se usaron credenciales de Supabase. Las migraciones históricas se aplican mediante el fixture histórico previsto por los runners, no sobre una base real.

## 5. Matriz manual de aceptación con usuarios

Usar cuentas de prueba autorizadas y una jornada de prueba claramente identificada; no reutilizar operaciones reales para probar rechazos.

| Perfil | Recorrido pendiente | Resultado esperado |
| --- | --- | --- |
| Administrador | Crear/configurar temporada, jornada, categorías, clubes, jugadores y competencia; respaldar formatos y entregar preparación. | Publicar solo tras validaciones; preparación entregada en lectura; ninguna confirmación deportiva de partidos. |
| Juez | Consultar preparación, confirmar participantes/grupos, gestionar partidos y árbitros; devolver acta, recibir corrección y confirmar; aprobar clasificación, completar llave y consultar historial. | Botones corresponden al estado; sin dobles envíos ni creación repetida de encuentros. |
| Jugador habilitado | Cambiar entre Jugador/Árbitro con la misma sesión, registrar sets de encuentro asignado, intentar otro no asignado y propio. | Sin cuenta duplicada; envío permitido únicamente con habilitación y asignación; nunca confirmar resultados. |
| Jugador sin habilitación | Acceder por URL directa a paneles y reenviar solicitudes de gestión desde una sesión propia de prueba. | Servidor y base rechazan; no cambia estado ni aparece éxito falso. |
| Visitante | Ventana privada: calendario, grupos, resultados, clasificación, eliminatorias, campeón y ranking; intentar IDs no publicados. | Sin actas pendientes, datos personales privados, historial interno ni simulaciones. |
| Dos usuarios | Juez y árbitro abren una revisión antigua; el primero confirma/corrige y el otro reintenta. Revocar habilitación con sesión abierta. | Rechazo de revisión obsoleta; sesión revocada no conserva capacidad de escribir. |
| Móvil/escritorio | Repetir los recorridos deportivos con teclado, pantalla pequeña, pérdida de red y reconexión. | Formularios recuperables; error visible sin éxito falso; datos privados fuera de caché offline. |

## 6. Pendientes antes de Vercel

1. Comparar, mediante revisión autorizada de solo lectura, migraciones instaladas, definiciones RPC, RLS y privilegios reales con la versión auditada. La documentación local declara migraciones pendientes; no asumir que están aplicadas ni reaplicar migraciones históricas. Preparar cualquier cambio remoto como operación separada con respaldo y autorización.
2. Configurar variables públicas de Supabase y `NEXT_PUBLIC_SITE_URL` con el dominio HTTPS de prueba. Verificar en Supabase Site URL y redirecciones permitidas para callback/recuperación. Evitar URLs locales en correos del despliegue; decidir expresamente cómo manejar dominios Preview.
3. Completar la matriz manual con Administrador, Juez, Jugador/Árbitro y visitante; registrar evidencia y aceptación. La habilitación/vinculación de cuentas reales necesita autorización aparte.
4. Verificar en HTTPS login, confirmación de correo, recuperación, cookies, cierre de sesión, acceso por URL directa, manifest y recuperación sin conexión. Las rutas de simulación deben responder sin contenido de desarrollo en producción.
5. Mantener el ranking sin configuración cuando no exista respaldo anual; no activar 15/71 ni inferir puestos ambiguos. Validar resoluciones con autoridad deportiva antes de usarlas.
6. Actualizar el README y registrar qué cambios previos y nuevos se incluyen en la entrega. Fijar la versión a desplegar y conservar un procedimiento de reversión.

El resultado permite continuar la preparación local; la aceptación funcional y el estado real de Supabase siguen siendo condiciones de la prueba desplegada.
