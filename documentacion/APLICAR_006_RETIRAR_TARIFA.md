# Aplicar y verificar 006: dependencia de tarifa

Archivo: [006_retirar_dependencia_tarifa.sql](../supabase/migrations/006_retirar_dependencia_tarifa.sql).
Estado: preparado para revisión y aplicación manual; no aplicado en Supabase por Codex.
Requiere 001–003, la 004 histórica y 005 ya aplicadas. No reaplicar 004 local.
007 queda reservada para programación deportiva.

## Alcance exacto

- Reemplaza el CHECK de habilitación de `public.competencias` por el mismo CHECK
  sin `tarifa_clp IS NOT NULL`. Mantiene actividad, publicación y ambos plazos.
- Reemplaza `privado_inscripciones.validar_inscripcion_004()` conservando exactamente
  el cuerpo de 005 salvo `or c.tarifa_clp is null` en la condición de disponibilidad.
  Permite solicitar y aceptar sin tarifa solo cuando se cumplen todos los demás requisitos.
- No cambia firmas de RPC, RLS, ACL, propietarios, triggers, roles, elegibilidad,
  representación, auditoría, aprobación deportiva, estados, plazos ni bloqueos de concurrencia.
- Conserva la columna nullable, su CHECK no negativo, datos y snapshots, incluidos
  los nuevos con el campo histórico NULL. No hay DML ni valores ficticios.
- Conserva `validar_competencia_003()`, incluida la protección de valores históricos
  y plazos mientras la competencia esté publicada o habilitada.

Antes de modificar objetos, comprueba cuerpos y seguridad de los validadores,
historial y RPC, los triggers críticos, RLS, aislamiento privado, ausencia del cupo
de 004 y la definición exacta del CHECK. Solo normaliza CRLF/LF de funciones.
Una diferencia, predecesor incorrecto o reaplicación produce un error `006:`.
No eliminar esas comprobaciones para forzar la aplicación.

## Prueba previa local

Con Node y PostgreSQL 18 instalados en Windows en la ruta usada por el runner:

```powershell
node supabase/tests/006_retirar_dependencia_tarifa.test.mjs
```

El runner crea y elimina su propio clúster temporal dentro de `test-results`, en
127.0.0.1:55406, con bases `liga_006_test` y `liga_006_flow`. No usa variables de
conexión externas, claves ni URLs de Supabase. No conectar el runner a otro clúster.
Requiere el puerto libre; no detiene procesos externos para liberarlo.

## Aplicación manual, una sola vez

1. Revisar el archivo completo y disponer del respaldo habitual del proyecto.
   Confirmar que 005 ya está aplicada y elegir un momento sin operaciones de inscripción.
2. En el proyecto correcto de Supabase, abrir SQL Editor como propietario `postgres`.
   Ejecutar primero las consultas de inventario siguientes y conservar los resultados.
3. Pegar y ejecutar **solo** el contenido completo de 006, incluyendo `BEGIN` y `COMMIT`.
   Usa bloqueo exclusivo breve sobre competencias/inscripciones, con `lock_timeout=5s`
   y `statement_timeout=60s`. No ejecutar 001–005, fixtures ni pruebas en Supabase.
4. Si hay error, no asumir éxito ni continuar con cambios parciales. La transacción
   no debe confirmarse; si la sesión queda abortada, cerrarla con `ROLLBACK`.
   Ante bloqueo, reintentar en una ventana tranquila; ante error `006:`, revisar las
   definiciones reales. No quitar el guard ni volver a aplicar migraciones previas.
5. Repetir las consultas de verificación. Los recuentos deben conservarse; el CHECK
   de habilitación ya no debe mencionar tarifa y la condición monetaria del validador
   debe estar ausente. Registrar la aplicación manual en el estado del proyecto.

## Inventario y verificación de solo lectura

Antes y después:

```sql
select count(*) as competencias,
       count(*) filter (where tarifa_clp is null) as sin_tarifa
from public.competencias;
select count(*) as solicitudes from public.inscripciones;
select count(*) as eventos from public.inscripciones_historial;

select conname, pg_get_constraintdef(oid) as definicion, convalidated
from pg_constraint
where conrelid = 'public.competencias'::regclass and contype = 'c'
order by conname;

select p.oid::regprocedure as funcion, p.prosecdef, p.proconfig,
       position(' or c.tarifa_clp is null' in replace(p.prosrc, E'\r\n', E'\n')) = 0
         as sin_condicion_monetaria
from pg_proc p
where p.oid = 'privado_inscripciones.validar_inscripcion_004()'::regprocedure;

select relname, relrowsecurity
from pg_class
where oid in ('public.competencias'::regclass, 'public.inscripciones'::regclass,
              'public.inscripciones_historial'::regclass);
```

Después se espera `sin_condicion_monetaria=true`, `prosecdef=true`,
`proconfig={search_path=""}` y RLS activa en las tres tablas. Sigue existiendo
`tarifa_clp >= 0`: protege datos históricos, no obliga a introducir importes.
El número de competencias, solicitudes, eventos y competencias sin tarifa no cambia.
No hacer inscripciones de prueba con cuentas/personas reales para verificar la migración.
La prueba funcional completa corresponde al runner local o a un staging autorizado.

## Coordinación con la aplicación

Este cambio prepara PostgreSQL; no implementa el Panel del Jugador ni programación.
La versión actual de la aplicación conserva los bloqueos explícitos por requisito
heredado en `openingBlockers` y en el formulario del Juez. **Solo después de confirmar
la aplicación remota de 006**, deberá retirarse ese bloqueo de la aplicación y ajustar
sus pruebas. Mientras tanto puede persistir un botón deshabilitado aunque PostgreSQL
ya permita la operación. No se retiran anticipadamente esos bloqueos en esta entrega.
