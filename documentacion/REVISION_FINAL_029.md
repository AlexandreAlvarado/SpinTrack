# Revisión final antes de instalar únicamente 029

## Secuencia y retirada de 031

Se revisó completa 031. Recrea tablas/políticas/funciones legales de 028, reconfigura sus triggers y retira con `IF EXISTS` los vetos generales de la 030. No restaura consultas públicas ni edición 029. No aporta una capacidad necesaria con 028 instalada y funcional; además, sus validaciones antiguas convierten el booleano de metadata a texto, mientras que 028 exige el booleano JSON real. No conviene sobrescribir la validación más estricta de 028.

031 fue retirada de migraciones y archivada íntegra en [referencias-retiradas](../supabase/referencias-retiradas/031_activar_aceptacion_aprobada.sql). Su SHA256 se comparó antes y después. No se ejecutó. Los tests históricos leen ahora la referencia archivada y no forman parte de la secuencia vigente. No se modifica el SQL de 001–029.

La carpeta de migraciones contiene 001–029: **el único archivo posterior a la 028 es 029**. Esto confirma la secuencia local, no el historial remoto de instalaciones, al que no se dispone de acceso SQL administrativo. La premisa remota es la confirmación del desarrollador: 028 instalada y 029 pendiente. No reaplicar ninguna anterior, no rellenar números ni registrar 030/031 como instaladas.

## Auditoría de RPC públicas: riesgo pendiente

025 permite EXECUTE a anon y authenticated, usa SECURITY DEFINER y proyecta explícitamente el calendario, competencias publicadas/aprobadas, nombres de participantes, clasificaciones y nombres conservados en snapshots, partidos de grupos, eliminatorias, campeón y subcampeón. Los resultados pendientes no se presentan como confirmados.

026 también permite EXECUTE público y usa SECURITY DEFINER; su fuente interna accede a fichas y participantes. Publica identificador deportivo `playerId`, nombre, fecha de jornada, puntos, puesto y estado, además de categorías/temporadas. Puede incluir participantes con resultado pendiente, sin puntos definitivos. No publica por ello un resultado provisional como oficial, pero sí una identidad deportiva.

Las proyecciones revisadas NO incluyen correo de acceso, contraseña, fecha completa de nacimiento, UUID de cuenta ni referencias administrativas. El acceso directo a jugadores, fuentes internas y resoluciones tiene restricciones distintas de las RPC. RLS de las tablas no filtra por sí sola lo que devuelve una función SECURITY DEFINER ejecutada con privilegios del propietario.

**Hallazgo:** ninguna de las dos consultas verifica autorización individual de publicación, representación, minoría de edad ni edad desconocida. Publicar la competencia o validar un reglamento no acredita esas autorizaciones. Una ficha de menor o edad desconocida puede aparecer con su nombre y resultados. No hay garantía suficiente para certificar que no se expongan datos de menores que requieran autorización.

La prueba aislada modifica temporalmente el nacimiento de una ficha sintética a diez años y comprueba que la respuesta anónima completa de 025 y 026 es idéntica a la anterior, con su identidad aún presente. También comprueba recursivamente que no se incorporen las claves privadas examinadas. Todo se revierte en PostgreSQL local; no se consultaron identidades reales para reproducirlo.

En remoto se usan exclusivamente GET/HEAD: versión/estado legal y permisos HTTP de las RPC, sin descargar nombres o resultados. Esto no permite inspeccionar sus cuerpos instalados. Para contrastarlos, se entrega [auditoría de catálogo de solo lectura](../supabase/audits/025_026_solo_lectura.sql); ejecutar manualmente y comparar con 025/026 locales. No se ejecutó SQL remoto.

`PERSONAL_DATA_REVIEW_PENDING = true` permanece intacto. Sus filtros de interfaz NO impiden invocaciones directas de las RPC. No se levanta esa restricción ni se presume consentimiento por aceptar términos.

## Solución propuesta para revisión, sin nueva migración pendiente

No reintroducir 030 ni vaciar todas las consultas. Preparar en una tarea separada un control de publicación selectivo en PostgreSQL, después de acordar el procedimiento institucional:

1. Registrar únicamente el estado de verificación, finalidad/alcance, referencia mínima de la autorización o fundamento aplicable, quién la verificó y su revocación. No incorporar documentos de menores o consentimientos ficticios. Gestión restringida a la autoridad administrativa existente; nunca editable desde el perfil o metadata de Auth.
2. Falta de verificación o edad desconocida debe conservar identidad reservada. Ser adulto tampoco acredita automáticamente cualquier publicación. La aceptación general no determina este estado.
3. Mantener calendario y metadatos de competencias. Conservar marcadores, puestos y puntos publicables; proyectar los nombres autorizados y sustituir los demás por una identidad reservada. No emitir `jugador_id`/`playerId` real para quienes carezcan de autorización; utilizar, si es necesario, identificadores opacos limitados al alcance deportivo y gestionados por el servidor. No cambiar resultados ni su cálculo.
4. Aplicar el mismo control a TODOS los caminos: participantes, nombres en snapshots aprobados, grupos, rondas, campeón/subcampeón y ranking. No filtrar por coincidencia de nombres ni devolver JSON histórico sin proyección. Revalidar autorizaciones en cada consulta para que una revocación afecte también al historial público.
5. Los alias son seudónimos, no una garantía de anonimato. Revisar categorías pequeñas, horarios, clubes y combinaciones que permitan identificar al menor; reducir esos detalles cuando corresponda. Si una publicación sigue siendo identificable y requiere autorización ausente, reservar esa parte concreta, manteniendo el resto del calendario/resultados/ranking.
6. Probar anon y authenticated directamente en PostgreSQL: adulto autorizado, menor autorizado, menor sin verificar, edad desconocida, revocación, snapshots y ausencia de claves privadas, preservando puntajes e historial.

Esta propuesta no crea tablas ni nuevas migraciones y no afirma que el riesgo ya esté resuelto. 029 puede instalarse para su finalidad privada, pero **no habilita ni certifica la publicación personal de 025/026**. Resolver ese control antes de ampliar/publicar identidades que requieran autorización. La aprobación de textos legales no elimina esta condición.

## Verificación legal 028: alcance real

La aplicación activa `2026-11-19.1`. Las acciones llaman realmente a Auth y a las RPC de 028; la fecha y el usuario los genera/valida PostgreSQL. Las pruebas locales 028 comprueban altas legítimas, rechazo de versiones/booleans falsos, aceptación persistente propia, idempotencia y RLS. 029 conserva este subsistema.

La lectura remota comprueba versión activa y respuesta de estado. No permite demostrar una escritura de registro o aceptación real sin modificar datos. No se crea una cuenta ni se acepta por una sesión abierta. No se presenta esa prueba real como realizada. Para completar la revisión instalada, ejecutar manualmente [028_solo_lectura.sql](../supabase/audits/028_solo_lectura.sql) y comparar triggers/funciones/permisos con 028; después realizar la prueba autorizada de registro, correo, aceptación y nuevo login con una cuenta de prueba. No se ha identificado una corrección incremental necesaria para el flujo legal, con la evidencia disponible.

## Pasos exactos para aplicar solo 029

1. En el SQL Editor del proyecto Supabase correcto, ejecutar únicamente estas consultas de lectura:

```sql
begin transaction read only;
select version from public.version_legal_028 where id;
select to_regprocedure('public.estado_legal_028()') as estado_028,
       to_regprocedure('public.aceptar_terminos_028(text,boolean)') as aceptar_028,
       to_regprocedure('public.editar_mi_perfil_deportivo_029(bigint,date,bigint,bigint,jsonb)') as perfil_029;
select count(*) as vetos_030 from pg_trigger
where tgname in ('resguardo_alta_revision_030','resguardo_aceptacion_revision_030')
  and not tgisinternal;
commit;
```

Esperado: versión `2026-11-19.1`, ambas funciones 028 existentes, `perfil_029` NULL y `vetos_030 = 0`. Si difiere, detener y revisar; no ejecutar reparaciones automáticas. Completar antes la auditoría de 028 si aún no se han contrastado sus definiciones.

2. Abrir [029_editar_perfil_deportivo.sql](../supabase/migrations/029_editar_perfil_deportivo.sql). Copiar **todo el archivo original**, desde BEGIN hasta COMMIT, a una consulta nueva del SQL Editor. Ejecutar una sola vez. No concatenar otros archivos ni ejecutar `supabase db push` como sustituto de este paso manual. 029 crea una función; no actualiza fichas ni cuentas.

3. Comprobar su instalación con lectura:

```sql
begin transaction read only;
select p.oid::regprocedure as funcion, p.prosecdef, p.proconfig,
       has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
       has_function_privilege('anon',p.oid,'execute') as anon_execute,
       has_function_privilege('service_role',p.oid,'execute') as service_execute
from pg_proc p
where p.oid=to_regprocedure('public.editar_mi_perfil_deportivo_029(bigint,date,bigint,bigint,jsonb)');
commit;
```

Esperado: una fila, `prosecdef = true`, `search_path` vacío en `proconfig`, permisos true/false/false respectivamente. Conservar el registro de ejecución. El SQL Editor no actualiza automáticamente el historial de Supabase CLI; no marcar ninguna otra migración como instalada ni alterar ese historial sin reconciliarlo expresamente.

4. No repetir 029 si ya existe. Si falla, conservar el error y revisar antes de reintentar. No eliminar funciones o permisos para forzar la instalación. La restricción independiente de edición personal de la aplicación sigue activa; instalar la RPC no equivale a levantarla.

No hubo SQL remoto, cambios en datos reales ni despliegue. La prueba de aceptación remota sigue siendo una validación manual pendiente.

## Resultado de las comprobaciones

- PostgreSQL aislado 026: aprobado, incluida reproducción del riesgo de publicación de un menor sintético y ausencia de las claves privadas examinadas.
- PostgreSQL aislado 028 y 029: aprobados, con regresiones 023 de permisos, arbitraje e historial. No se instalaron 030/031.
- Node: 602/602 aprobadas. TypeScript aprobado. ESLint sin errores, cuatro advertencias preexistentes. No se realizó un nuevo build en esta tarea.
- GET/HEAD remoto: versión `2026-11-19.1`, estado legal disponible, RPC 025/026 accesibles para anónimo (HTTP 200), jugadores/aceptaciones/operaciones sin lectura anónima y perfiles sin filas visibles. Sin descarga de nombres o resultados.
- SHA256: 001–029 intactas; 031 archivada idéntica. La única migración local posterior a 028 es 029.

Conclusión: 029 queda preparada para instalación manual con las comprobaciones indicadas. No se certifica todavía la protección selectiva de menores en las RPC públicas ni una escritura real de aceptación en Supabase. Esos límites no quedan resueltos al instalar 029.
