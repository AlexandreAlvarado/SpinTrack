# Validación final de 032 — 2026-11-23

La [migración 032](../supabase/migrations/032_publicacion_deportiva_segura.sql) queda validada para instalación manual sobre 001–029. No se ejecutó SQL remoto, no se hizo push ni despliegue. Las migraciones 001–029 y los datos reales permanecen intactos.

## Cambios y protección

Las RPC históricas 025/026 y sus nuevas entradas 032 aplican la misma reserva, incluso para operadores autenticados. Menores y participantes con edad desconocida mantienen participación y puntuación con «Participante con identidad reservada». Los adultos con nacimiento registrado conservan su nombre actual. Los nombres de snapshots se vuelven a proyectar por jugador; nunca se devuelve el nombre histórico almacenado.

No hay autorizaciones verificables de menores en el esquema. No se inventaron, ni se presume autorización al aceptar términos. El control usa la fecha registrada: no acredita documentalmente el nacimiento ni evita inferencias externas sobre un torneo. La función auxiliar no tiene EXECUTE para anon, authenticated ni service_role. El cliente no recurre a las RPC históricas si falta 032.

032 ahora detiene la instalación si falta 029/025/026 o detecta la 030 retirada. No repara estados divergentes automáticamente. La instalación es transaccional y se ejecuta una sola vez.

## Identificador del ranking

Se sustituyó el COUNT DISTINCT correlacionado por DENSE_RANK particionado por configuración. Cada jugador recibe el mismo ID numérico en todas sus fechas, sin colisiones dentro de cada alcance. Se conserva el contrato JSON. No se cambió el motor deportivo.

playerId es local al alcance y a la respuesta, no una FK privada. Distintas categorías pueden usar el mismo número y una retirada puede renumerarlo. No debe persistirse ni enviarse a RPC privadas. El cliente actual recalcula cada alcance y no mantiene selecciones persistentes por jugador. Las pruebas verifican categorías distintas, siete fechas, retiradas, agrupación, totales, seis mejores puntuaciones, primeros lugares, posiciones y empates.

## Evidencia local

PostgreSQL 18.1 temporal en 127.0.0.1, sin cargar credenciales ni conectar a Supabase:

- Baseline 029 y reejecución completa de 025, 028 y 029 con 032 instalada: permisos, operaciones deportivas, legalidad, RLS y concurrencia conservados.
- Escenario 026 original completo antes de 032: reproduce la exposición histórica. Después de 032 se confirma que ya no se reproduce.
- Todas las filas de tablas públicas comparadas antes/después; cuerpos, ACL y configuración de todas las funciones ajenas al cambio comparados en public y privado_inscripciones.
- Consultas 025, 026 y ambas 032 bajo anon sin claims y bajo Administrador, Juez y Jugador. Entradas históricas y nuevas equivalentes después de 032.
- Menor, nacimiento desconocido, adulto, cumpleaños 18, cambio posterior de edad, snapshots con nombres adulterados y búsqueda recursiva de nombres/columnas privadas en respuestas anidadas.
- Calendario y metadatos completos; solo se normalizan los campos de identidad que deben reservarse. Sets, clasificaciones vigentes, partidos, llaves, campeón/subcampeón y propiedades deportivas del ranking conservados.
- Fuente sintética de siete jornadas en una vista dentro de una transacción revertida. No se alteran resultados ni reglas reales.
- Creación/preparación de competencia por Administrador, inscripción y aceptación de menor por Administrador y Juez; rechazo de solicitudes ajenas/anónimas. Referencias exclusivamente sintéticas en el clúster desechable, sin equivalencia institucional.
- Rechazo atómico sin 029 o con 030 retirada. Auditorías anterior/posterior ejecutadas localmente.

Node 22.20.0: **605/605** pruebas aprobadas. TypeScript y build Next.js 16.4.6 aprobados. ESLint sin errores; cuatro advertencias preexistentes. Las dos pruebas antiguas de suspensión se actualizaron conservando la cobertura de protección: publicación selectiva y ausencia de fallback inseguro. No se retiraron comprobaciones legales para obtener aprobaciones.

Comandos reproducibles desde la raíz:

```powershell
node supabase/tests/032_publicacion_segura.test.mjs
node supabase/tests/032_regresion_privada.test.mjs 025
node supabase/tests/032_regresion_privada.test.mjs 028
node supabase/tests/032_regresion_privada.test.mjs 029
node --test tests/*.test.mjs
npm run typecheck
npm run lint
npm run build
```

Los runners usan los binarios PostgreSQL 18 de la ruta local de las pruebas históricas. La secuencia conserva 004 histórica más 005 correctiva; no inventa una 007 inexistente.

## Perfil privado: límite existente

La RPC 029 funciona y pasó sus pruebas después de 032; la edición administrativa mantiene sus permisos. Sin embargo, PERSONAL_DATA_REVIEW_PENDING sigue en true y la interfaz/acción de autoservicio del jugador sigue suspendida. Se añadió una prueba con la configuración real para dejarlo explícito. Instalar 029/032 no habilita ese formulario. Habilitarlo requiere una decisión separada sobre esa configuración. Esto no bloquea inscripciones de operadores ni participación de menores.

## Estado remoto y orden exacto

La última confirmación documentada indica 028 instalada y 029 pendiente. Esta sesión no consultó el catálogo remoto; no puede confirmar si eso cambió. Los archivos locales no acreditan instalaciones remotas.

1. Ejecutar manualmente [032_preinstalacion_solo_lectura.sql](../supabase/audits/032_preinstalacion_solo_lectura.sql). Esperado: versión 2026-11-19.1, 025/026 presentes, ausencia de 030. Comparar las definiciones con las migraciones conocidas. Si ya existe alguna función 032, detener y revisar.
2. Si perfil_029 es NULL y las anteriores están completas, ejecutar TODO [029_editar_perfil_deportivo.sql](../supabase/migrations/029_editar_perfil_deportivo.sql), una vez. Si existe, verificarla y no repetirla. No reaplicar 001–028.
3. Confirmar 029 SECURITY DEFINER, search_path vacío y EXECUTE para authenticated, no para anon/service_role.
4. Ejecutar TODO [032_publicacion_deportiva_segura.sql](../supabase/migrations/032_publicacion_deportiva_segura.sql), de BEGIN a COMMIT, una vez y en consulta separada. No ejecutar las referencias retiradas 030/031.
5. Ejecutar [032_postinstalacion_solo_lectura.sql](../supabase/audits/032_postinstalacion_solo_lectura.sql). Debe examinar seis funciones: cuatro RPC públicas habilitadas para anon/authenticated; auxiliar deshabilitada para ambos; 029 habilitada para authenticated y no anon. service_role sin EXECUTE en las seis. Igualdades 025/032 y 026/032 true; torneos object y ranking array; tablas privadas examinadas sin SELECT anónimo. Contadores cero pueden ser legítimos: contrastar con los datos publicados.
6. Probar PostgREST con clave pública y sin sesión, además de las consultas SQL bajo rol anon. Revisar calendario, grupos, clasificación, partidos, finales y ranking: identidades protegidas ausentes y participación/puntuaciones presentes. No crear autorizaciones para pasar la prueba ni compartir respuestas personales en informes.
7. Con cuentas autorizadas validar login, aceptación, paneles, inscripciones y preparación/operación, incluida vista de celular. El autoservicio de perfil conserva el límite anterior.
8. Publicar Vercel manualmente después de esas comprobaciones. El código nuevo requiere 032 instalada; el servidor anterior puede seguir ocultando datos hasta publicar el nuevo código.

**Conclusión:** 032 lista para copiar al SQL Editor con esas precondiciones. La prueba local no certifica el esquema remoto ni sustituye la verificación posterior. No hubo SQL remoto, push ni despliegue.
