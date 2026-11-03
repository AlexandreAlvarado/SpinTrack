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

Todavía no se ha creado la migración 004 ni implementado la programación operativa de partidos.

## Próximas etapas

1. Inscripciones de jugadores por competencia.
2. Validación de elegibilidad y habilitaciones.
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