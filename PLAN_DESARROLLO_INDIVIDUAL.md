# Plan de desarrollo individual — Liga Los Ríos

## Objetivo de la primera entrega funcional

Demostrar desde el navegador (computador o móvil) el flujo **registrar usuario → iniciar sesión → abrir panel por rol → administrar temporada/fecha → consultar la fecha publicada sin iniciar sesión**.

## Tablero Kanban individual

Usa las columnas **Pendiente / En curso / En prueba / Terminado**. Mantén **una sola tarea grande en curso**; si encuentras errores, anótalos antes de abrir otra función.

| Orden | Módulo | Entrega comprobable | Estado inicial |
|---|---|---|---|
| 1 | Configurar entorno | npm, Supabase, migración, variables y servidor local | Pendiente de instalar en PC |
| 2 | Acceso público | Portada, calendario e instalación PWA | Base implementada; probar |
| 3 | Identidad | Registro, login, redirección por rol, RLS | Base implementada; probar |
| 4 | Administrador | Temporadas y fechas publicables | Base implementada; probar |
| 5 | Administrador | CRUD clubes, jugadores, categorías y asignación de cargos | Pendiente |
| 6 | Jugador | Perfil e inscripción, validación de elegibilidad | Pendiente |
| 7 | Juez General | Participantes confirmados y grupos 3/4 | Pendiente |
| 8 | Juez General | Programación, mesas, árbitros y cruces | Pendiente |
| 9 | Árbitro | Partido asignado, puntos/sets e incidencias | Pendiente |
| 10 | Competencia | Confirmación, clasificación, llaves y ranking | Pendiente |
| 11 | Calidad | Pruebas, auditoría, manejo de concurrencia y errores | Pendiente |
| 12 | PWA robusta | Offline de marcador, cola e idempotencia | Segunda prioridad |

## Criterio de terminado para una función

- Está respaldada por un requisito del informe o una regla validada de la Liga.
- Una persona con el rol correcto puede utilizarla en una prueba real.
- La ruta y la API impiden a usuarios de otro rol ejecutar la acción.
- Los datos persisten y se muestran de forma consistente.
- Se prueban al menos un caso correcto y uno incorrecto.
- El cambio queda guardado en Git con un commit que indique su finalidad.

## Consideraciones importantes

- No crear la lógica de grupos, desempates, sets o ranking desde suposiciones: tomar reglas de las **bases oficiales vigentes**.
- El Juez General toma decisiones de dirección deportiva; el Administrador configura el sistema.
- La sincronización offline del árbitro es delicada: no mezclarla con la primera versión de resultados.
- Primero lograr una competencia simple de principio a fin; después mejorar estadísticas, notificaciones y experiencia visual.
