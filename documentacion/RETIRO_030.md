> Actualizacion: 031 tambien fue retirada sin cambiar su SQL. Solo 029 sigue pendiente. Consultar [revision final y pasos exactos](REVISION_FINAL_029.md). Las referencias a conservar 031 en migraciones describen el estado anterior.

# Secuencia vigente tras retirar 030

La 030 NO está instalada, según confirmación del desarrollador. No es necesaria para la versión legal aprobada `2026-11-19.1`: contiene exclusivamente bloqueos temporales. Se retiró de `supabase/migrations` y se conservó íntegra en [referencias-retiradas](../supabase/referencias-retiradas/030_resguardo_revision_institucional.sql). No aplicar esa copia ni registrar 030 como instalada.

No se requiere SQL de reversión: nada de 030 se ejecutó. No se modifica el funcionamiento de las RPC originales 025/026, los triggers y aceptación 028 ni la función segura de perfil 029. No se renumeran migraciones.

## Orden manual

1. Conservar 001–028 instaladas; no volver a aplicarlas.
2. Revisar y aplicar únicamente [029](../supabase/migrations/029_editar_perfil_deportivo.sql), si sigue pendiente. Conserva controles de titularidad, NULL, concurrencia y antecedentes deportivos.
3. Omitir 030, retirada. El hueco es intencional; no generar una migración ficticia para rellenarlo.
4. **NO ejecutar 031**. Su SQL permanece sin modificaciones en migraciones, por petición expresa. No ejecutar indiscriminadamente toda la carpeta ni `supabase db push`: incluiría 031. Una futura revisión deberá decidir su retiro o alcance.

031 elimina con `DROP TRIGGER IF EXISTS` los dos vetos generales de 030 y reinstala/repara el subsistema legal de 028. No depende obligatoriamente de esos triggers: tolera su ausencia. Tampoco restaura las consultas públicas ni el permiso de edición que 030 retiraba. Su prueba existente representa ese escenario histórico y ahora lee la copia archivada; no se ejecutó esa prueba ni 031 en esta tarea. Con 028 activa y funcional no se ha identificado necesidad de aplicar 031.

## Datos personales y menores

Se mantiene `PERSONAL_DATA_REVIEW_PENDING = true`: la aplicación continúa limitando publicación de identidades, resultados y ranking personales y la edición de datos personales pendiente de autorización. La aprobación legal no equivale a esas autorizaciones. Por tanto, retirar 030 preserva las implementaciones originales de base de datos, pero no levanta automáticamente las restricciones de la interfaz.

Estas restricciones de aplicación no constituyen una política de autorización individual en las RPC originales 025/026. Un cliente con acceso directo puede invocarlas según sus permisos originales. No se certifica protección adicional de menores en ese acceso: antes de publicar datos que requieran autorización, deben verificarse las autorizaciones y controles institucionales correspondientes. No se presume mayoría de edad ni consentimiento por registro o aceptación. En esta tarea no se amplió la publicación ni se incorporaron autorizaciones ficticias.

## Pruebas

Se comprueba la secuencia 001–029 en PostgreSQL temporal con datos sintéticos, sin instalar 030/031. Las pruebas verifican que 029 conserva las definiciones y permisos de las consultas públicas, junto con edición propia, conflictos, antecedentes y RLS. La suite 028 comprueba registro y aceptación reales en PostgreSQL aislado.

Los tests históricos 030/031 conservan su escenario leyendo la referencia retirada; no son pasos de instalación ni forman parte de la validación de la secuencia vigente. Las migraciones 001–029 y el SQL de 031 deben conservar sus hashes. No se ejecutó SQL remoto, no se modificaron datos reales y no hubo despliegue.

Resultado final: PostgreSQL 028 y 029 aprobados, incluidas sus regresiones 023; 601/601 pruebas Node aprobadas; TypeScript aprobado; ESLint sin errores y cuatro advertencias preexistentes. Comprobación SHA256: migraciones 001–029 y SQL de 031 intactos. No se ejecutó 030 ni 031, tampoco en la base aislada de esta revisión.
