# Proyecto de Título — Liga Regional de Tenis de Mesa Los Ríos

## Contexto
Soy el único desarrollador de una aplicación web progresiva (PWA) para gestionar competencias de tenis de mesa. El proyecto es parte de mi título de Ingeniería Informática.

## Tecnologías
- Next.js y React
- TypeScript
- Tailwind CSS y shadcn/ui
- Supabase y PostgreSQL
- Supabase Auth y Realtime

## Roles
- Público: consultar competencias, programación, resultados y ranking.
- Administrador: gestionar usuarios, roles, jugadores, clubes, temporadas, fechas y categorías.
- Juez General: dirigir la competencia, gestionar grupos, mesas, árbitros, programación y validación de resultados.
- Árbitro: registrar puntos, sets, incidencias y actas de sus partidos asignados.
- Jugador: gestionar su perfil, inscripciones y consultar resultados.

## Separación operativa definitiva
- El Administrador prepara y valida temporada, jornada, competencia, grupos, reglas, formatos de sets y respaldos antes del inicio deportivo.
- Una vez entregada la competencia, el Administrador queda en lectura para esa preparación; el Juez General dirige partidos, clasificaciones, llaves, árbitros y confirmaciones.
- El Árbitro solo registra resultados de sus encuentros asignados y nunca confirma resultados ni configura reglas.

## Instrucciones
1. Trabajar por módulos y priorizar un MVP funcional.
2. Leer los archivos existentes antes de modificar el código.
3. No inventar reglas deportivas: respetar los documentos del proyecto.
4. Mantener permisos separados por rol y verificar autorización en el servidor y PostgreSQL RLS.
5. No borrar funcionalidades existentes sin justificación.
6. Proteger credenciales y no exponer claves secretas.
7. Realizar pruebas y explicar los errores encontrados.
8. Indicar qué archivos fueron modificados y qué falta implementar.
9. Favorecer soluciones mantenibles y adecuadas para un solo desarrollador.

## Orden de desarrollo
1. Configuración y conexión a Supabase.
2. Inicio público y autenticación.
3. Panel de Administrador.
4. Panel de Juez General.
5. Panel de Árbitro.
6. Panel de Jugador.
7. Grupos, partidos, clasificación y ranking.
8. Pruebas, PWA y despliegue.

## Jornadas y programación simultánea
- Relación obligatoria: Temporada → Fecha (una jornada de un día) → Competencias individuales → Partidos.
- Una jornada reúne todas las categorías individuales habilitadas. No crear una fecha distinta por categoría.
- Las competencias pueden tener inicios diferentes y desarrollarse simultáneamente; no imponer una secuencia entre categorías.
- Mesas, jugadores y árbitros son recursos compartidos por toda la jornada. Los conflictos de una persona se revisan también entre categorías y entre su participación como jugador y como árbitro.
- Consultar temporadas y fechas existentes en Supabase; no fijar jornadas, tarifas ni horarios en el código. Un registro o su publicación administrativa no constituyen por sí solos confirmación documental de la Liga.
- Corrección oficial de alcance: NO existe máximo general de participantes por competencia. Solo se exige el mínimo establecido en las Bases (o una resolución excepcional documentada). No configurar cupos ni bloquear inscripciones por cantidad; cupo_maximo de 003 es una columna heredada sin uso deportivo. No modificar sus valores automáticamente.
- El tamaño permitido de cada grupo es independiente del total de participantes. Conservar las reglas documentadas de composición; la futura cantidad de grupos y partidos se calculará según participantes realmente inscritos/admitidos, sin un máximo general ni algoritmos inventados.
- No modificar, eliminar ni publicar fechas automáticamente. Conservar datos reales y permitir configuración pendiente.
- Administrador: condiciones administrativas e inscripciones habilitadas solo si se cumplen los requisitos. Juez General: inicio deportivo, mesas, programación, árbitros, reprogramación y aprobación de resultados.
- Fechas civiles y plazos se interpretan en America/Santiago; guardar instantes como timestamptz y tratar cambios de horario explícitamente.
- La futura programación deberá reservar intervalos [inicio, fin), no solo horas de inicio. Impedir solapamientos de mesa, persona jugadora o árbitro, así como arbitrar el propio encuentro; permitir simultaneidad con recursos distintos.
- No inferir duración, descansos, criterios deportivos ni resolución automática de retrasos. Los intervalos estimados los define el Juez General y los retrasos no liberan automáticamente recursos en uso.
- Las propuestas de nuevas tablas deben revisarse antes de generar migraciones. No modificar migraciones anteriores ni ejecutar nuevas migraciones en Supabase sin autorización.
- Estado confirmado por el desarrollador: producción tiene la versión histórica de 004 (con cupo). NO reaplicar 004 local ni modificar 001–004. La corrección incremental es 005_eliminar_cupo_maximo.sql, con comprobación estricta de definiciones previas; ante diferencias, detener y revisar. No limpiar cupo_maximo ni datos reales. 006_retirar_dependencia_tarifa.sql queda preparada para revisión y aplicación manual; NO se ha aplicado remotamente. Reservar 007 para programación deportiva.

## Documentación oficial del proyecto
- Bases deportivas: documentacion/referencias/BASES LIGA REGIONAL TDM LOS RIOS.pdf
- Excel de referencia: documentacion/referencias/Grupos 4ra Fecha LR 2026.xlsx
- Analizar ambos documentos antes de diseñar categorías, grupos, inscripciones, enfrentamientos y ranking.
- Contrastar las reglas deportivas del PDF con la estructura real del Excel.
- No inventar criterios de clasificación o desempate que no estén documentados.

## Exclusión definitiva: modalidad Dobles
- La modalidad de Dobles está completamente fuera del proyecto.
- No implementar Dobles en la versión inicial ni en futuras versiones.
- No crear tablas, formularios, categorías, partidos, inscripciones, rankings ni funcionalidades para Dobles.
- Ignorar las reglas de Dobles presentes en las Bases Oficiales 2026.
- El sistema administrará exclusivamente competencias individuales de tenis de mesa.

## Cuenta única Jugador y Árbitro (023)
- Conservar perfiles y jugadores.perfil_id opcional. Una habilitación de arbitraje por cuenta es independiente del rol principal y de la identidad deportiva.
- Autorizar arbitraje mediante perfiles.arbitraje_habilitado vigente y asignación del encuentro, nunca exclusivamente por rol='arbitro'. Solo Administrador habilita/revoca; solo Juez General asigna y confirma oficialmente.
- Navegar entre Jugador y Árbitro no cambia permisos ni cierra sesión. Comprobar autoarbitraje en PostgreSQL al asignar y actuar, incluyendo finales y participantes resueltos después del avance. Reasignación supervisada conserva historial.
- No excluir una jornada por una inscripción en otra competencia. No fusionar cuentas ni modificar auth.users sin verificación de titularidad y procedimiento separado.
- 022 figura preparada/pendiente en la documentación local; 023 también es para revisión y aplicación manual. No ejecutar migraciones en Supabase ni modificar las anteriores.
- Arquitectura y procedimiento: [Cuenta única](documentacion/CUENTA_JUGADOR_ARBITRO.md).
### Revisión final 023

La migración 023 quedó revisada para eliminar el bloqueo global `2026023,1`; las operaciones usan filas de partido/cuadro y bloqueos por árbitro cuando corresponde. La suite Node completa quedó en 467/467 y el runner PostgreSQL temporal 001–023 pasó. 023 no se ejecutó en Supabase real.
