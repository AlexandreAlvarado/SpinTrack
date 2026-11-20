# Prueba de aceptación de mesas automáticas desde el navegador

## 0. Decisión de entorno: actualmente NO iniciar escrituras

La aplicación actual abre en localhost, pero su configuración apunta a **Supabase remoto**. No es una base local por utilizar `http://localhost:3000`.

Esta preparación no creó usuarios, jugadores, jornadas, mesas ni resultados remotos. No modificó migraciones 001–027, la jornada 8 ni Peneca Inicial Mixta. Tampoco cambió la interfaz o el motor deportivo. La guía describe operaciones que se ejecutarán únicamente en el entorno de aceptación aprobado.

Ejecutar desde la copia de trabajo que se vaya a probar:

```text
node scripts/mesas-acceptance-preflight.mjs
```

El script inspecciona las variables públicas y el validador real de la aplicación, sin conectar a Supabase, ejecutar SQL, modificar archivos ni imprimir claves. El código de salida **2** indica un bloqueo; no significa que se hayan realizado escrituras. No acredita cuentas, permisos ni migraciones remotas.

Estado observado en este checkout:

| Comprobación | Resultado |
|---|---|
| Backend configurado | Remoto; requiere autorización explícita para cualquier escritura de aceptación |
| URL local `http://127.0.0.1:54321` | El validador actual de SpinTrack la rechaza |
| Configuración de pila local | No existe `supabase/config.toml` en este checkout |
| Supabase CLI | No se encontró en PATH; sí se encontró Docker, sin comprobar su daemon |
| PostgreSQL de los runners | Temporal y aislado, con contexto Auth simulado por SQL; no ofrece inicio de sesión de navegador |
| Roles iniciales por registro | El registro crea perfil Jugador; no permite autoasignarse Administrador o Juez General |

**Opción preferida:** preparar una pila completa local de Supabase/Auth, sus cuentas y roles de prueba, y adaptar de manera acotada la configuración de desarrollo para aceptar ese endpoint. Ese trabajo no se implementó en esta entrega. No basta con iniciar PostgreSQL ni con cambiar la URL del navegador.

**Alternativa:** proyecto Supabase de pruebas separado, identificado y con autorización explícita antes de crear sus datos. La aplicación acepta actualmente el formato HTTPS habitual de Supabase; eso no autoriza escrituras por sí mismo. El preflight seguirá señalando que es remoto: la autorización se registra por separado, no se infiere del nombre del proyecto.

En ambos casos utilizar una copia de trabajo independiente que contenga este código y su propia configuración, no sobrescribir la configuración del servidor actual ni copiar credenciales de producción. Una vez preparado el entorno, se puede iniciar allí `npm run dev -- --port 3001`, con `NEXT_PUBLIC_SITE_URL=http://localhost:3001` y los retornos de Auth configurados para ese origen. No se inició ese servidor ni se cambió ninguna variable desde esta tarea.

En lo que sigue, **B** es el origen de esa instancia aislada, por ejemplo `http://localhost:3001`. Anteponer B a las rutas. No ejecutar los pasos de escritura en la instancia actual hasta resolver el destino y la autorización.

## 1. Datos mínimos y alcance

### Escenario M: recorrido mínimo recomendado primero

| Recurso | Datos mínimos |
|---|---|
| Cuentas Auth | A: Administrador; J: Juez General; R1: Árbitro habilitado |
| Sesiones de navegador | Tres perfiles de navegador o navegadores independientes. Tres pestañas del mismo perfil comparten cookies y no aíslan roles |
| Temporada/jornada | Una temporada de aceptación y una jornada nueva del día del ensayo, distintas del historial protegido |
| Categoría | Una categoría individual activa con nivel, rama, criterio de nacimiento y reglamento completos y compatibles |
| Jugadores | Cuatro fichas activas y elegibles para esa categoría; no necesitan cuenta de usuario para este recorrido |
| Competencia | Una competencia preparada y publicada, con nómina y un grupo de cuatro confirmados |
| Partidos | Seis cruces de grupo confirmados como lote, todos sin resultado inicialmente |
| Mesas | Doce mesas habilitadas, numeradas 1–12, sin reservas anteriores |
| Árbitro | R1 habilitado por Administrador, disponible y ajeno a los cuatro jugadores |

Los cuatro jugadores y un mínimo de cuatro son una configuración técnica de ensayo, utilizable solo si corresponde al reglamento/configuración elegidos. Si el mínimo vigente es superior, conservarlo y ampliar la nómina. No reducir requisitos deportivos para forzar la prueba.

**Con un solo árbitro se espera una asignación simultánea, no doce.** Las otras once mesas quedarán libres. Esto permite probar los ocho pasos sin crear numerosas cuentas y asegura partidos restantes después de liberar la primera mesa.

Usar fichas y referencias inequívocas de aceptación únicamente en el entorno aislado. No presentar una referencia de ensayo como aprobación documental auténtica de la Liga. Reutilizar categorías y reglas ya verificadas del proyecto; no inventar criterios, dobles o reglas de clasificación.

### Escenario C: ocupar las doce mesas

- Tres competencias de categorías distintas en la **misma jornada**, con ocho jugadores distintos cada una: 24 personas, seis grupos de cuatro, 36 cruces y doce árbitros disponibles permiten doce encuentros simultáneos si todos están habilitados y sin conflictos.
- Para que haya un siguiente partido inmediatamente después de confirmar **un solo** resultado, usar una variante con 28 personas distribuidas en 12 + 8 + 8: siete grupos de cuatro y 42 cruces. Quedará un grupo con personas sin reserva en la primera tanda, disponible para continuar cuando se liberen mesa y árbitro.
- Si se usa el escenario de 24 personas, puede ser necesario confirmar también el otro encuentro del mismo grupo antes de proponer nuevos cruces: los únicos dos jugadores liberados ya jugaron entre sí. No es un fallo del algoritmo.
- Estas cantidades son escenarios de capacidad, no cupos ni reglas nuevas. Respetar el mínimo y las reglas de cada categoría.

## 2. Identificadores y datos de control

Completar antes de comenzar; los identificadores son los IDs de base de datos mostrados en las rutas, **no** el número visible de la jornada o mesa.

| Dato | Valor a registrar |
|---|---|
| Backend/origen de aceptación y autorización, si es remoto | __________ |
| S: temporada nueva de aceptación | __________ |
| JOR: ID de jornada nueva; D: fecha civil de ensayo | __________ |
| C: ID de competencia; CAT: ID de categoría de temporada | __________ |
| P1–P4: fichas de jugadores del escenario M | __________ |
| R1: cuenta habilitada de árbitro | __________ |
| M1: primer partido propuesto; mesa y reserva correspondientes | __________ |
| I: inicio deportivo; T: inicio de tanda | __________ |

Todas las horas se introducen como **America/Santiago**, independientemente de la zona del equipo. Elegir D como día del ensayo e I dentro de ese día. Para poder pulsar «En juego», T debe haber llegado y ser igual o posterior a I. No adelantar el reloj ni reutilizar una fecha histórica para eludir la espera.

Para este ensayo se puede elegir una duración estimada de **60 minutos** y descanso **0**, como parámetros explícitos de prueba, no como reglas oficiales. El margen facilita terminar las operaciones manuales dentro del intervalo. Si se selecciona descanso positivo, esperar ese descanso después de la liberación real antes de exigir otra propuesta.

## 3. Preparación administrativa y deportiva

Todos los pasos de esta sección escriben únicamente en el entorno aislado previamente aprobado.

| Paso | Perfil y ruta exacta | Operación / datos | Resultado esperado |
|---|---|---|---|
| P1 | A · `/login` | Iniciar sesión como Administrador en B. J y R1 utilizan sus sesiones independientes | Cada sesión muestra el perfil correcto; el registro público por sí solo no concede estos roles |
| P2 | A · `/panel/administrador?crear=temporada#nuevo-registro` | Crear temporada de aceptación: nombre y año | Se obtiene S sin alterar temporadas históricas |
| P3 | A · `/panel/administrador/temporadas-deportivas?temporada=S&tipo=reglamentos` y `/panel/administrador/temporadas-deportivas?temporada=S&tipo=categorias` | Configurar/revisar reglamento validado con referencia, categoría, nivel, rama y nacimiento compatibles. Reutilizar las reglas verificadas | CAT queda activa y con reglamento asociado; no quedan datos «pendientes» |
| P4 | A · `/panel/administrador?crear=jornada#nuevo-registro` | Temporada S, número nuevo, fecha D, comuna y recinto de aceptación; escoger Publicada en este entorno de pruebas | Se obtiene JOR. La publicación es necesaria para la nómina; no se usa jornada 8 |
| P5 | A · `/panel/administrador/competencias?temporada=S&fecha=JOR` | En CAT pulsar «Crear», guardar competencia activa, inicialmente no publicada y con inscripciones deshabilitadas. El enlace directo de creación utiliza `&categoria=CAT#competition-form` | Se obtiene C en borrador |
| P6 | A · `/panel/juez-general/preparacion?temporada=S&fecha=JOR&competencia=C` | Guardar borrador deportivo con I, mínimo válido, tamaños de grupo permitidos y formato Grupos y eliminación simple. Guardar las cinco etapas de sets antes de aprobar. Para el ensayo de grupos usar mejor de 3 solo si está respaldado por la configuración elegida; la final existente exige mejor de 5 y referencia | «Requisitos pendientes» queda vacío. Pulsar «Aprobar configuración guardada» tras revisar y marcar la confirmación |
| P7 | A · `/panel/administrador/competencias?temporada=S&fecha=JOR&gestionar=C#competition-form` | Publicar la competencia aprobada, conservando Activa. Mantener inscripciones deshabilitadas para usar nómina manual | Competencia publicada, configuración aprobada, estado deportivo `preparada` |
| P8 | A · `/panel/administrador/jugadores` | Registrar las cuatro fichas: nombre, estado activo y nacimiento compatible si la categoría lo exige. Club/localidad y cuenta son opcionales. No vincular R1 a estos jugadores en el caso básico | P1–P4 tienen IDs distintos; no se requieren cuatro cuentas Auth adicionales |
| P9 | A · `/panel/administrador/arbitraje` | En R1 pulsar «Habilitar arbitraje» si está deshabilitado | Arbitraje habilitado. El rol principal por sí solo no basta |
| P10 | J · `/panel/juez-general/habilitaciones?temporada=S&categoria=CAT` | Revisar cada jugador mediante `&jugador=P1#habilitation-form`, repetir P2–P4. Guardar estado Habilitado, resolución aplicable, motivo, referencia y revisión documental | Los cuatro están habilitados para CAT y sus datos son compatibles |
| P11 | J · `/panel/juez-general/participantes?temporada=S&fecha=JOR&competencia=C` | Seleccionar P1–P4, «Confirmar nómina» y aceptar el diálogo | Cuatro participantes confirmados |
| P12 | J · `/panel/juez-general/grupos?temporada=S&fecha=JOR&competencia=C` | «Generar propuesta», revisar un grupo de cuatro, referencia, «Guardar borrador»; después referencia de confirmación, «Confirmar grupos» y diálogo | Grupo persistido y confirmado. Una propuesta sin guardar no basta |
| P13 | J · `/panel/juez-general/partidos?temporada=S&fecha=JOR&competencia=C` | Con respaldo del formato, marcar todos contra todos a una vuelta y referencia, «Generar borrador de partidos»; revisar los seis cruces y «Confirmar partidos» | Lote confirmado y seis resultados pendientes. Confirmar cruces todavía no confirma resultados ni ocupa mesas |

La ruta de P6 conserva el prefijo `juez-general`, pero **quien edita y aprueba es Administrador**. Juez General la consulta en lectura. Algunos textos heredados aún mencionan al juez como preparador; seguir los permisos reales, no intentar cambiar roles.

No hace falta recorrer inscripciones/pagos para este caso: la nómina manual existente permite la prueba. Si se decide probar inscripciones, es otro alcance con plazos y posibles requisitos heredados; no inventar una tarifa ni habilitar esa opción para desbloquear mesas.

Para el escenario C, repetir P5–P7 y P10–P13 por competencia, todas bajo JOR, y habilitar las doce cuentas de arbitraje en P9.

## 4. Recorrido de aceptación de mesas: ocho operaciones

### A1. Comprobar la competencia pendiente

**J** · `/panel/juez-general/partidos?temporada=S&fecha=JOR&competencia=C`.

Comprobar seis cruces del escenario M, sin resultados enviados/confirmados. Si hay varios grupos, seleccionarlos en el filtro «Grupo»; la opción resumen no despliega sus encuentros. Guardar C y los IDs de los cruces para no confundirlos con otros torneos.

**Esperado:** partidos deportivos existentes, lote confirmado, jugadores definidos. No crear una llave para esta prueba: los grupos ya permiten todo el recorrido.

### A2. Registrar doce mesas y generar la propuesta

**J** · `/panel/juez-general/programacion?temporada=S&fecha=JOR`.

En «Registrar mesa», registrar números 1–12 únicamente si no existen en JOR. Comprobar total 12, disponibles 12, ocupadas 0 y fuera de servicio 0. No reutilizar las doce mesas de la jornada histórica.

En «Próxima tanda»: introducir T, duración estimada y descanso; marcar explícitamente R1 como disponible y pulsar **«Generar propuesta»**.

**Esperado M:** una asignación a una mesa, jugadores concretos y R1. La generación no escribe reservas ni resultados. Las advertencias por falta de árbitros para otros cruces son normales. **Esperado C:** hasta doce asignaciones con recursos distintos; nunca exigir doce si existen personas ocupadas, árbitros insuficientes o participantes pendientes.

### A3. Confirmar la programación

**J**, misma ruta. Revisar jugadores, mesa, intervalo y árbitro. Introducir referencia del ensayo, marcar «Revisé y autorizo esta propuesta» y pulsar **«Confirmar asignaciones»**. Anotar M1, mesa y reserva.

**Esperado:** reserva asignada y árbitro persistidos en una transacción; historial de asignación. Si una sesión cambió recursos, el rechazo no debe dejar una tanda parcial. Con inicio futuro, la mesa puede seguir figurando disponible **ahora** aunque tenga reserva próxima; si T está dentro del intervalo actual, se computa ocupada.

### A4. Iniciar un partido

**J**, misma ruta. Pulsar **«Ver encuentros»** en la mesa de M1, introducir «Motivo / referencia» y pulsar **«En juego»**, una vez alcanzado T.

**Esperado:** reserva «En juego» y mesa ocupada. En grupos este inicio es operativo de la reserva, no un estado deportivo nuevo del grupo. No se registra ningún resultado. El fin estimado no liberará la mesa por sí solo.

### A5. Registrar y enviar el resultado

**R1** · `/panel/arbitro/resultados`.

Buscar M1 por jugadores, competencia y grupo. Si hay varios asignados usar «Anterior»/«Siguiente». Para el escenario de grupos mejor de 3, introducir dos sets de prueba **11–5 y 11–5** para el mismo jugador, dejando vacío el tercero. Si el formato aprobado es mejor de 5, completar tres sets ganados y dejar vacíos los restantes. Son marcadores de ensayo, únicamente para el entorno aislado.

Pulsar **«Enviar resultado al Juez General»**.

**Esperado:** «Enviado al Juez General · En revisión», con revisión y resumen de sets. El árbitro no confirma deportivamente. En la sesión J volver a consultar programación: la mesa debe seguir ocupada y en revisión. No pulsar «Liberar reserva» para simular una confirmación.

### A6. Confirmar deportivamente

**J** · `/panel/juez-general/partidos?temporada=S&fecha=JOR&competencia=C`.

Seleccionar el grupo de M1 si corresponde, abrir **«Ver sets, revisión e historial»**, revisar el resultado recibido, marcar «Revisé jugadores, marcador por sets y árbitro responsable», completar «Referencia de validación» y pulsar **«Confirmar resultado»**. No reingresar los sets como juez.

**Esperado:** resultado confirmado deportivamente, trazabilidad del árbitro y del juez. No se avanza manualmente una eliminatoria ni se cambia un campeón para esta prueba de mesas.

### A7. Verificar la liberación real

**J** · `/panel/juez-general/programacion?temporada=S&fecha=JOR`.

Volver a cargar la ruta o pulsar **«Consultar»**. La confirmación deportiva sincroniza la reserva en PostgreSQL; la vista ya abierta no es un monitor en tiempo real y la acción de resultados no revalida específicamente esta ruta.

**Esperado M:** mesa de M1 disponible, cero ocupadas si no se inició ningún otro encuentro; evento de liberación y resultado M1 conservado como confirmado en partidos. La reserva no debe reutilizarse como si el resultado fuese pendiente.

### A8. Proponer el siguiente partido

**J**, misma ruta. Elegir un nuevo inicio que no sea anterior a la liberación real ni a I, volver a seleccionar R1, conservar descanso 0 para el caso básico y generar otra propuesta.

**Esperado M:** una propuesta para otro cruce pendiente, con mesa y árbitro disponibles. M1 no reaparece. Si se configuró descanso positivo, esperar su cumplimiento. En el escenario de capacidad aplicar la variante con suplencia o confirmar otro encuentro compatible, como se explica arriba.

No es necesario completar los seis partidos ni declarar campeón para aprobar estos ocho pasos.

## 5. Bloqueos y diagnóstico

| Síntoma / bloqueo | Qué comprobar, sin eludir permisos |
|---|---|
| El servidor abre en localhost pero los datos son reales | El backend sigue siendo remoto. No comenzar escrituras sin entorno/autoridad aprobados |
| Inicio de sesión falla con Supabase local | Bloqueo actual del validador de URL y falta de pila Auth/configuración local; requiere trabajo separado antes del ensayo |
| No existe una sesión Administrador o Juez General | Bootstrap de cuentas/roles por el responsable del entorno de pruebas. El registro público y `user_metadata` no otorgan esos roles |
| Administrador no puede terminar preparación | Revisar categoría/reglamento, las cinco etapas, final mejor de 5 con referencia, plazos si existen y competencia aún no publicada. Una aprobación ya entregada queda en lectura |
| No se puede confirmar nómina | Jornada y competencia publicadas, preparación aprobada en `preparada`, jugadores activos y resoluciones vigentes para CAT |
| «No hay encuentros» o «No hay encuentros elegibles» | Revisar nómina, grupos guardados/confirmados y lote de cruces confirmado. Los torneos terminados correctamente no generan propuestas |
| Hay doce mesas, pero solo una propuesta | Un árbitro o pocas personas disponibles limitan la tanda; doce mesas no equivalen a doce encuentros posibles |
| No aparece R1 | Cuenta existente, arbitraje habilitado por Administrador, sesión en el mismo backend y selección expresa en la propuesta |
| No se puede iniciar M1 | T todavía no llegó, mesa/persona bloqueada, reserva obsoleta o habilitación revocada. Reconsultar y revisar, no modificar el reloj |
| R1 no encuentra M1 | La propuesta quizá no fue confirmada; revisar asignación persistida a esa cuenta, lote confirmado y navegación entre partidos |
| Resultado ordinario rechazado | Formato aprobado, sets suficientes y válidos, extras vacíos, árbitro asignado, revisión actual y ausencia de conflicto |
| Mesa ocupada después del envío | Es correcto: falta confirmación deportiva. Incidencias u observaciones tampoco liberan automáticamente |
| Mesa parece ocupada tras confirmar | Recargar programación. Si persiste, comprobar última revisión: una corrección más reciente puede retenerla |
| Mesa libre sin siguiente propuesta | Revisar descanso, árbitros y jugadores disponibles. Con 24 jugadores ya reservados puede ser necesario terminar dos encuentros del mismo grupo |

## 6. Evidencias y criterio de aceptación

Guardar capturas de: entorno aprobado, perfiles correctos, lote pendiente, doce mesas, propuesta antes de confirmar, asignación confirmada, partido en juego, envío en revisión con mesa retenida, confirmación del juez, mesa libre y siguiente propuesta con un ID diferente.

Anotar IDs y referencias; no guardar contraseñas, tokens ni claves. Usar una referencia común de ejecución para relacionar eventos. En el entorno de aceptación se puede conservar el historial; no limpiar tablas deportivas ni ejecutar borrados masivos en el backend actual al terminar.

La prueba manual se aprueba cuando A1–A8 se completan con las tres sesiones reales, sin conflictos ni cambios sobre el historial protegido. **Ese recorrido completo de navegador todavía no se ejecutó.**

## 7. Automatización complementaria y archivos

- [Preflight de solo lectura](../scripts/mesas-acceptance-preflight.mjs): identifica el destino real y el bloqueo local; nunca autoriza escrituras.
- [Pruebas del preflight](../tests/mesas-acceptance-preflight.test.mjs): remoto frente a loopback, configuración inválida, secretos no impresos y entorno no modificado.
- [Caso mínimo unitario](../tests/mesas-acceptance-flow.test.mjs): doce mesas/un árbitro/cuatro jugadores; una asignación, retención en juego y revisión y siguiente partido tras confirmar. Usa fotografías sintéticas, no sesiones de navegador.
- [Integración PostgreSQL temporal de doce mesas](../supabase/tests/programacion_12_mesas.test.mjs): RPC reales, dos competencias, personas compartidas, árbitro ocupado, confirmación, reprogramación, envío, confirmación deportiva, liberación y generación de una siguiente propuesta desde la fotografía resultante. Revierte las fixtures y conserva registros previos.
- [Regresión histórica aislada](../supabase/tests/027_regresion_historica.test.mjs): conservación de actas, resultados, campeones y ranking de torneos terminados.

Comandos:

```text
node scripts/mesas-acceptance-preflight.mjs
node --test tests/*.test.mjs
node supabase/tests/programacion_12_mesas.test.mjs
node supabase/tests/027_regresion_historica.test.mjs
npm run typecheck
npm run lint
```

Los runners PostgreSQL crean sus propias bases temporales. No se deben apuntar al backend real ni usarlos para crear cuentas de navegador. No se modificaron datos del producto para producir evidencias de aceptación.

Resultado de esta entrega: **549/549 pruebas Node**, TypeScript aprobado, ESLint con **0 errores / 4 advertencias preexistentes**, y runner PostgreSQL de doce mesas aprobado incluyendo la siguiente propuesta después de liberar recursos. El preflight de la configuración actual devuelve el bloqueo remoto esperado. La regresión histórica aislada listada arriba ya estaba disponible; no fue necesario volver a ejecutarla en esta entrega, que no cambia código deportivo ni migraciones.

Fuentes verificadas: [control de configuración](../src/lib/config.ts), [permisos de sesión](../src/lib/auth.ts), [preparación](../src/app/panel/juez-general/preparacion/actions.ts), [nómina](../src/app/panel/juez-general/participantes/actions.ts), [generación de cruces](../src/app/panel/juez-general/partidos/actions.ts), [programación](../src/app/panel/juez-general/programacion/actions.ts), [captura/confirmación](../src/app/panel/juez-general/resultados/actions.ts) y sus interfaces existentes.
