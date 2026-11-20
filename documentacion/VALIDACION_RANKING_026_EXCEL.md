# Validación local del ranking 026 contra el Excel histórico

Revisión realizada el 18-11-2026 sobre [Ranking Liga Regional 6.0.xlsx](./referencias/RANKING%20LIGA%20REGIONAL%206.0.xlsx). El libro contiene diez hojas de categoría y seis columnas de fechas con valores; la columna Fecha 7 está vacía en las diez hojas. Por eso sus totales son sumas de seis fechas históricas y no constituyen todavía un ranking de temporada 2026 completo.

## Evidencia reproducible

| Hoja | Jugadores | Celdas con 15 | Jugadores con 15 | Celdas con 71 | Jugadores con 71 |
| --- | ---: | ---: | ---: | ---: | ---: |
| PENECA | 30 | 22 | 16 | 0 | 0 |
| PRE INFANTIL INICIAL | 41 | 35 | 24 | 0 | 0 |
| PRE INFANTIL FEDERADO | 26 | 27 | 14 | 0 | 0 |
| INFANTIL INICIAL | 54 | 35 | 30 | 0 | 0 |
| INFANTIL FEDERADO | 34 | 36 | 21 | 0 | 0 |
| JUVENIL INICIAL | 50 | 45 | 24 | 0 | 0 |
| JUVENIL FEDERADO | 51 | 45 | 23 | 0 | 0 |
| TC FEDERADO | 136 | 102 | 72 | 46 | 36 |
| TC AFICIONADO | 132 | 81 | 62 | 21 | 20 |
| TC DAMAS | 32 | 30 | 16 | 0 | 0 |
| **Total** | **586** | **458** | **302** | **67** | **56** |

Los 71 puntos solo aparecen en TC Federado y TC Aficionado. La distribución es compatible con la hipótesis 33.º–64.º, pero el Excel no conserva una llave completa de 64, una ronda de eliminación ni una resolución de Liga que permita demostrar esos puestos. Los 15 aparecen en todas las categorías, incluso mezclados con fechas sin participación; el patrón no demuestra por sí solo que correspondan a eliminación en grupos.

La hoja conserva una anomalía aritmética: `TC AFICIONADO / JOSE PINO` tiene fechas `[0, 0, 0, 0, 15, 15]` y total almacenado `15`; la suma de las seis fechas es `30`. Debe corregirse en la fuente histórica o quedar documentada por la autoridad. No se importó ni se usó para el cálculo oficial.

Las filas 3.º–8.º incluyen nombres, posición y puntos por fecha, pero no incluyen el vínculo verificable “eliminado por” ni el cuadro de partidos suficiente para reconstruirlo. Por tanto, los patrones observados son descriptivos y no autorizan el criterio hipotético. La migración 026 deja esos puestos pendientes hasta una resolución deportiva auditable.

## Comparación con las Bases 2026

- Verificado en el Excel: las puntuaciones 78, 81, 84, 86, 88, 90, 93, 95, 97 y 100 aparecen y coinciden con la escala oficial.
- No verificado en el Excel: la séptima fecha oficial y la regla de conservar las seis mejores de siete, porque Fecha 7 está vacía en todas las hojas.
- No autorizado: 15, 71 y el orden 3.º–8.º según el eliminador. Se mantienen como hipótesis informativas en el simulador, separadas del ranking oficial.
- La jornada 8 no se incorpora: el padrón oficial de 026 solo acepta fechas 1–7 de la temporada 2026.

## Estado de 026

La auditoría de la migración confirma tablas inmutables con RLS habilitado, RPC separadas para Administrador, Juez General y consulta pública, siete fechas distintas de la misma temporada, exclusión de la jornada 8, puntos solo desde resultados confirmados y bandas oficiales 81/78 únicamente para cuadros completos. Las resoluciones de puestos 3.º–8.º guardan autoridad, referencia, motivo, actor e instante; una revocación agrega historial y no edita el total histórico.

No se agregaron partidos ni se modificaron las migraciones 001–025. El archivo [026_ranking_oficial_2026.sql](../supabase/migrations/026_ranking_oficial_2026.sql) queda preparado para aplicación manual, sin ejecución remota y sin activar hipótesis. Antes de instalarlo, la Liga debe confirmar la séptima fecha y resolver el tratamiento oficial de 15, 71, puestos 3.º–8.º y la anomalía de JOSE PINO.
