# Ranking individual 2026

Continuación: [hallazgos e hipótesis reportados del Ranking Liga Regional 6.0](./HIPOTESIS_RANKING_2026.md). Preparación configurable solo de simulación; criterios por eliminador, 15 y 71 puntos deshabilitados y fuera del cálculo oficial.

## Revisión previa y diseño de 026

Fuentes: Bases locales, §4 (p.1), §7 (p.3), §9 (pp.4–5), §10 (p.5), §22 (p.7 del archivo); Excel de cuarta fecha, hoja Grupos (220 filas, 16 columnas). El Excel contiene nóminas por grupo, no posiciones finales ni reglas de desempate. No se importa como resultado.

Se revisaron 001–025: `jugadores.id` es la identidad deportiva estable, independiente del perfil opcional y del nombre; `participantes_competencia` enlaza esa misma identidad entre jornadas. No se fusionan homónimos. Las eliminatorias 018 guardan ganador y perdedor confirmados y son inmutables después de confirmarse. 025 no calcula ranking. Una final confirmada en cuadro finalizado permite determinar 1.º y 2.º. Perder semifinal no distingue 3.º/4.º; perder cuartos no distingue 5.º–8.º. §10 entrega dos medallas de tercero, mientras §9 diferencia 3.º y 4.º: **la medalla no determina puntos**.

Diseño revisado antes de preparar SQL: dos tablas nuevas, sin modificar 001–025: configuración documental inmutable por categoría de temporada, con siete fechas explícitas; historial inmutable de resoluciones de puestos ambiguos (incluye revocación). Solo RPC con comprobación de rol escribe. No se guarda un total editable. La proyección pública publica exclusivamente identidades deportivas, nombres y resultados computables; conserva referencias y actores privados.

## Reglas implementadas

- Escala exacta de §9 hasta 32.º; no hay puntos definidos después de 32.º.
- Suma de hasta seis mejores puntuaciones confirmadas; suma de todas las siete y victorias para desempate. Ausencia y pendiente se muestran como estados, no como puntuaciones cero asignadas.
- Grupos empatados que alcanzan los tres primeros puestos: total de siete, después primeros lugares; empate persistente compartido y pendiente de partido autorizado. Fuera del podio no se aplican desempates adicionales. El orden visual por nombre no concede posición.
- Ranking provisional mientras falten fechas, competencias finalizadas o puestos puntuables resueltos. Incluso un desempate aritmético se presenta provisional hasta completar la temporada.
- Solo siete fechas seleccionadas explícitamente por Administrador, de 2026 y numeradas 1–7, misma temporada, reglamento validado y respaldo de alcance por categoría/modalidad individual. Ninguna configuración se crea con la migración.
- Campeón/subcampeón solo desde final confirmada y cuadro finalizado. Para perdedores de octavos/dieciseisavos se computan bandas 9–16/17–32 únicamente si el cuadro está completo (sin pases, todos sus cruces iniciales reales y confirmados). En cuadros con pases la banda queda pendiente de interpretación deportiva; no se deduce posición por orden, nombre, sets o ranking previo.
- Semifinales y cuartos: Juez General puede registrar o revocar una resolución respaldada de autoridad de Liga, motivo y referencia, únicamente dentro de la banda compatible con la derrota confirmada. No puede asignar un puesto ya utilizado. La resolución nunca altera los partidos ni agrega tercer lugar. El historial conserva actor, instante y decisión anterior.
- Eliminados en grupos, pases con banda incierta y otras situaciones sin puesto demostrable quedan pendientes, sin puntos. Los eliminados en rondas anteriores a dieciseisavos se muestran sin escala disponible.

## Confirmaciones de Liga pendientes

1. Procedimiento para distinguir 3.º/4.º y 5.º–8.º, atendiendo a las dos medallas de tercero. No se propone encuentro adicional ni se igualan puntos.
2. Posiciones de no clasificados de grupos, cuadros con pases y casos excepcionales. El sistema no permite adjudicarlas arbitrariamente.
3. Alcance anual exacto de cada categoría/modalidad y padrón documental de las siete fechas. Las categorías de cuarta fecha no prueban por sí solas la separación anual.
4. La página 5 dice «3da Versión» mientras la portada indica cuarta versión 2026: se implementan los criterios solicitados por el desarrollador para 2026; la configuración exige respaldo formal que ratifique su aplicación.
5. Jornada 8 preexistente: el esquema admite números 1–100 y publicación no acredita oficialidad. Se confirmó mediante el calendario público el 18-11-2026: jornada id 2, número 8, temporada id 1 «Temporada 2026», 14-11-2026, Gimnasio Las Ánimas, Valdivia, publicada, categoría Peneca / Inicial / mixta. No se encontró una resolución que cambie las siete fechas. Se conserva y se excluye; no se renumera ni se elimina. Esta lectura pública no acredita el estado de filas privadas ni autoriza a renumerar la fecha 8 como séptima.
6. Partido de definición: deberá ser autorizado y trazado por la Liga mediante un procedimiento específico. Esta versión lo señala pendiente y no genera un partido ni resuelve su resultado.

## Operación y despliegue

026 se prepara y prueba exclusivamente en PostgreSQL temporal. **No aplicada remotamente**. Revisar y aplicar manualmente antes de usar los paneles. Administrador: Ranking → registrar categoría, reglamento, siete fechas y respaldo. Juez General: Ranking → resolver únicamente pendientes compatibles con semifinal/cuartos, o revocar dejando motivo. Se muestran identificadores deportivos para evitar homónimos. No hay formulario de totales.

Una configuración es inmutable: una corrección de alcance requiere revisión técnica/documental antes de sustituirla. Las resoluciones deportivas sí admiten revocación y nueva decisión trazada. Retirar la publicación de una competencia o la validación de su reglamento impide que su información siga computándose públicamente.

## Archivos y verificación local (18-11-2026)

- [Migración incremental 026](../supabase/migrations/026_ranking_oficial_2026.sql): tablas, permisos, protección del alcance, resoluciones y proyecciones. 001–025 sin cambios.
- [Motor](../src/lib/ranking.ts), [consulta pública](../src/lib/ranking-data.ts), [página pública](../src/app/ranking/page.tsx), [tabla y filtros](../src/components/public-ranking.tsx). Se retira el contrato de presentación anterior `src/lib/public-ranking.ts`, que no tenía cálculo ni consumidores productivos restantes.
- [Panel Administrador](../src/app/panel/administrador/ranking/page.tsx), [acciones con rol](../src/app/panel/administrador/ranking/actions.ts), [panel Juez](../src/app/panel/juez-general/ranking/page.tsx), [gestión](../src/components/ranking-management.tsx), [formularios bajo demanda](../src/components/ranking-forms.tsx), enlaces en [menú Administrador](../src/components/admin-navigation.tsx) y [menú Juez](../src/components/judge-navigation.tsx).
- [Pruebas del motor](../tests/ranking.test.mjs), [acciones y lectura](../tests/ranking-actions.test.mjs), [PostgreSQL temporal](../supabase/tests/026_ranking.test.mjs); se actualizan [pruebas públicas](../tests/public-pages.test.mjs) y [menú administrativo](../tests/admin-presentation.test.mjs) para el nuevo flujo. [ESLint](../eslint.config.mjs) excluye resultados temporales y reconoce CommonJS en archivos `.cjs` existentes.

Resultados:

- PostgreSQL 18 temporal 001–026: pasó. Configuración explícita, rechazo de duplicados/fecha 8 y roles ajenos, datos privados inaccesibles, resultados pendientes sin puntos, campeón y subcampeón confirmados, no clasificados de grupos pendientes, resolución de semifinales compatible y sin puestos repetidos, revocación, historial inmutable y retiro de publicación. Escenarios adicionales 16/32 verifican puntuación por banda sin puesto único, pases pendientes y rondas anteriores sin escala. Solo fixtures locales; no se aplicó nada remotamente.
- Node: 493 pruebas, 491 pasan. Las 57 pruebas focalizadas de ranking, páginas públicas y presentación administrativa pasan. Dos fallos anteriores: [orden del menú del Juez](../tests/judge-navigation.test.mjs) espera enlaces avanzados ausentes y [selección activa de Preparación](../tests/preparacion-deportiva.test.mjs) espera `aria-current` en una ruta sin enlace. Ambos reproducidos por separado sustituyendo exclusivamente el menú con su versión original de `git show HEAD`, sin alterar archivos de trabajo. Se conservan y no se debilitan las pruebas.
- TypeScript: sin errores. ESLint: sin errores; tres advertencias preexistentes en runners SQL 009, 013 y 018.
- Navegador: consulta real pública falla de forma segura al faltar 026 remota. Tabla con fixture sintético separado comprobada a 320 y 1280 píxeles CSS, sin desbordamiento de página; desplazamiento horizontal confinado a la tabla. El fixture nunca se guardó en la aplicación ni en Supabase. La pestaña se restauró a la ruta real.
