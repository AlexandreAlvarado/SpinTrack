# Partidos de grupos: contrato de la migración 011

Revisión de arquitectura previa al SQL: reutilizar grupos, integrantes, preparación y roles de 003/009/010. No duplicar nóminas ni programación.

Las Bases 2026 §7 especifican grupos de 3/4 y mejor de 3/5; no explicitan todos contra todos. El Excel de cuarta fecha contiene nóminas, no cruces. Generar exige confirmación explícita del Juez de que la Liga respalda todos contra todos a una vuelta, con referencia documental. Sin ese respaldo no generar.

- Un lote por competencia conserva formato, mejor de, referencia, autor y confirmación. Se genera mediante una acción; no al consultar. Un borrador puede descartarse con motivo y referencia; sus partidos se retiran después de guardar la instantánea de historial y se permite regenerar un nuevo lote. Un lote confirmado no se descarta.
- Partidos relacionados con lote, competencia, grupo y ambos integrantes. Parejas canónicas únicas. El estado se obtiene del lote: borrador o confirmado. Confirmado significa cruces aprobados, sin programación de recursos.
- Historial inmutable de generación/confirmación con instantánea de partidos. Confirmar exige el ID del lote revisado; revalida grupos y preparación bajo el mutex de 009/010.
- Grupos confirmados e integrantes se protegen mediante triggers; con partidos, se bloquean cambios de formato, aprobación y sets. No hay corrección posterior ni cancelación en esta etapa.
- El ID estable del partido permite añadir reservas por jornada mediante otra migración: intervalos [inicio,fin), mesa y personas compartidas entre competencias. No hay columnas de horario sueltas ni promesas de ausencia de conflictos ahora.
- Resultados por set, clasificación y eliminatorias requerirán migraciones adicionales; no se crean ganadores, BYE ni reglas de avance. Una futura fase eliminatoria puede extender el vínculo de origen del partido sin alterar sus identificadores.

Aplicación manual pendiente: 011 requiere 001–006, 009 y 010. No aplicar SQL en Supabase real desde esta tarea.
