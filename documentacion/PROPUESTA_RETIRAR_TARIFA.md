# Retirar la dependencia de tarifa: propuesta para revisión

Estado actualizado: se autorizó preparar la corrección y se creó
[006_retirar_dependencia_tarifa.sql](../supabase/migrations/006_retirar_dependencia_tarifa.sql).
No se ejecutó en Supabase ni se auditó el esquema remoto. Las migraciones 001–005
permanecen intactas. 007 queda reservada para programación deportiva.
Las dependencias siguientes describen el estado ANTERIOR a aplicar 006.
Instrucciones vigentes: [aplicar y verificar 006](./APLICAR_006_RETIRAR_TARIFA.md).

## Dependencias comprobadas

| Objeto | Dependencia actual | Consecuencia |
| --- | --- | --- |
| `public.competencias`, CHECK de 003 | `inscripciones_habilitadas` exige `activo`, `publicada`, `tarifa_clp IS NOT NULL` y ambos plazos | Una competencia nueva puede guardarse como borrador sin tarifa, pero no habilitar inscripciones. |
| `public.validar_competencia_003()`, trigger vigente reemplazado por 005 | Impide cambiar tarifa o plazos mientras la competencia esté publicada o habilitada | Ocultar el campo no permite enviar NULL en UPDATE: borraría un dato y podría impedir cambios administrativos legítimos. |
| `privado_inscripciones.validar_inscripcion_004()`, trigger `validar_inscripcion`, versión de 005 | Para estado `pendiente` o `aceptada`, rechaza `c.tarifa_clp IS NULL` con SQLSTATE 23514 (`Competencia no disponible`) | Bloquea solicitudes nuevas y aceptación de pendientes sin ese dato, aunque los demás requisitos se cumplan. No es una comprobación de pago. |
| RPC `public.solicitar_inscripcion(...)` | Inserta en `inscripciones`, ejecutando el trigger anterior | No se puede eludir el requisito llamando a la RPC directamente. |
| RPC `public.resolver_inscripcion(...)` | Actualiza `inscripciones`, ejecutando el mismo trigger | Aceptar sigue sujeto al requisito. Rechazar/cancelar conserva sus roles, estados y evidencia; no debe bloquearse por esta dependencia. |
| Antecedentes de inscripción e historial | El trigger incorpora `tarifa_clp`; el historial conserva snapshots que pueden incluirla anidada | Los datos históricos deben permanecer intactos; la interfaz filtra únicamente su presentación. |

Fuentes: [003](../supabase/migrations/003_categorias_competencias.sql),
[004](../supabase/migrations/004_inscripciones.sql) y
[005](../supabase/migrations/005_eliminar_cupo_maximo.sql). En 005 se distinguen
las definiciones esperadas históricas de los cuerpos nuevos; ambos conservan
el requisito de tarifa. No reaplicar 004 ni modificar archivos anteriores.

## Diseño autorizado para preparar 006; aplicación remota pendiente

1. Comprobar en un entorno autorizado la definición real del CHECK de competencias,
   ambos validadores, triggers, dependencias y ACL. Identificar el CHECK por su
   definición, sin adivinar su nombre generado. Detenerse ante diferencias.
2. Reemplazar solo el CHECK de habilitación para retirar `tarifa_clp IS NOT NULL`,
   manteniendo activo, publicación, plazos no nulos y sus demás constraints.
   Conservar la columna nullable, su CHECK de valores históricos no negativos y
   todos sus datos; no usar ceros, DEFAULT ficticio, rellenos ni limpieza automática.
3. Reemplazar únicamente el validador de inscripciones vigente para retirar el
   término `c.tarifa_clp IS NULL` de la disponibilidad deportiva. Conservar identidad,
   autorización, representación, jugador activo, elegibilidad, categoría/reglamento,
   preparación/aprobación, jornada publicada, inicio futuro, plazos, estados,
   evidencia, auditoría, concurrencia y la ausencia de máximo general de participantes.
4. Conservar la protección actual de `validar_competencia_003()` sobre valores
   históricos y plazos: no necesita eliminarse para dejar de exigir tarifa.
   La 006 conserva también ese campo en los snapshots nuevos (puede ser NULL);
   nunca reescribir antecedentes ni historial existentes.
5. Conservar firmas de RPC, triggers, RLS, roles, propietarios, `SECURITY DEFINER`,
   `search_path` y permisos. Mantener privado el esquema de funciones internas.
6. Solo después de validar/aplicar el cambio aprobado, retirar coordinadamente el
   bloqueo heredado del servidor y de la interfaz. No activar esta parte antes:
   PostgreSQL seguiría rechazando solicitudes aunque la pantalla anunciara disponibilidad.

## Comprobaciones de 006 y verificación posterior

La suite SQL aislada de 006 ya pasó en PostgreSQL 18 local, incluida concurrencia
con tarifas NULL y conservación de datos/seguridad. La aplicación y verificación
en Supabase siguen siendo manuales y no se realizaron desde esta sesión.

- En base aislada: habilitar, solicitar y aceptar una competencia sin tarifa cuando
  todos los requisitos deportivos/administrativos sean válidos; comprobar que NULL
  permanece NULL y que los valores históricos no cambian.
- Rechazar publicación/habilitación o aceptación sin los demás requisitos, y probar
  roles ajenos, representación inválida, solicitudes fuera de plazo e inicio alcanzado.
- Conservar rechazo y cancelación documentados, historial, auditoría, concurrencia,
  ACL y ausencia de cupos máximos generales. Revisar snapshots nuevos e históricos.
- Ejecutar además pruebas Auth/PostgREST en un entorno autorizado antes del despliegue.

## Comportamiento de la aplicación mientras esté pendiente

La interfaz no muestra ni solicita importes; guardar una competencia omite la columna
financiera tanto en INSERT como UPDATE e ignora intentos de enviarla desde el cliente.
La aplicación conserva la comprobación heredada para habilitar inscripciones y explica
el bloqueo sin pedir al usuario un importe. El Juez no puede elegir Aceptar cuando
el dato heredado está ausente; Rechazar sigue disponible y la RPC mantiene la autoridad
final. No se introducen pagos, comprobantes ni gestión financiera.

El panel del Jugador todavía es informativo: actualmente no existe un formulario de
solicitud ni una acción cliente que llame a `solicitar_inscripcion`. No se afirma
haber probado un formulario inexistente ni la compatibilidad remota del esquema.
