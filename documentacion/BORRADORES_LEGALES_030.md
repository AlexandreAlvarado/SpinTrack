> Documento historico: 030 retirada y NO aplicable. Consultar [secuencia vigente](RETIRO_030.md).

# SpinTrack — revisión institucional de términos y privacidad

Estado: borradores para el Presidente. Revisión normativa: 19 de noviembre de 2026. No se acredita aprobación institucional ni se activa el borrador como contrato aceptado.

## Documentos

- [Términos y condiciones](../src/app/terminos/page.tsx): responsable oficial, cuenta única, alcance gratuito, permisos, obligaciones, arbitraje y reclamos, privacidad, menores, suspensión, historial, disponibilidad y aceptación.
- [Política de privacidad](../src/app/privacidad/page.tsx): datos y finalidades efectivas, fundamento pendiente por finalidad, información pública/privada, menores, proveedores, cookies/PWA, seguridad, conservación y derechos.

Se conservan el diseño y las rutas. Se incorporan nombre institucional, RUT, ubicación y correo entregados por el desarrollador. No se inventan domicilio postal, proveedor SMTP, autorizaciones, plazos ni contratos.

## Fuentes oficiales consultadas

- [Ley 19.628, versión previa a la reforma](https://www.bcn.cl/leychile/navegar?idNorma=141599&idVersion=2023-05-09): fundamento del tratamiento, finalidad, reserva y derechos, especialmente artículos 4, 6, 7, 9 y 12–16.
- [Ley 21.430](https://www.bcn.cl/leychile/navegar?idNorma=1173643): privacidad y datos de niños, niñas y adolescentes, artículo 33.
- [Ley 21.719](https://www.bcn.cl/leychile/navegar?idNorma=1209272): reforma con entrada en vigor el 1 de diciembre de 2026. Se distingue expresamente del régimen vigente al revisar estos borradores.

Los textos no afirman que toda actividad de la Liga esté cubierta por una excepción legal ni que aceptar términos constituya consentimiento para cualquier uso. La Liga debe documentar el fundamento por finalidad antes de habilitarla y revisar su adecuación al régimen aplicable al momento de operar.

## Resguardo temporal de menores y publicación

No se encontró un registro verificable de autorizaciones de menores o de publicación individual. No se presume mayoría de edad por falta de nacimiento, por categoría, por tener cuenta ni por aceptar términos. Tampoco se inventa un procedimiento institucional de representación.

Se adopta una restricción temporal conservadora, sin depender de una variable enviada por el navegador:

- Registro público suspendido en la interfaz y acción del servidor.
- Nuevas aceptaciones suspendidas: no se pide aceptar un documento no aprobado.
- Edición personal de nacimiento, club y localidad suspendida. Se conserva la consulta propia.
- Publicación identificable de torneos y ranking suspendida, incluso para visitantes que hayan iniciado sesión. Se conservan metadatos del calendario, sin participantes o resultados individuales.
- No se cambian reglas, cálculos, asignaciones, resultados ni herramientas de operación deportiva interna.

El bloqueo amplio incluye adultos porque actualmente falta una distinción verificable y una autorización individual de publicación. Es un resguardo transitorio, no una política definitiva de exclusión de menores ni una certificación de cumplimiento para tratamientos internos preexistentes. La Liga sigue debiendo revisar el fundamento de esos tratamientos y no introducir información de menores que necesite autorizaciones aún no verificadas.

La [migración 030](../supabase/referencias-retiradas/030_resguardo_revision_institucional.sql), **pendiente de revisión y aplicación manual**, refuerza el resguardo ante acceso directo a Supabase: conserva implementaciones deportivas con ejecución revocada a clientes, expone únicamente calendario sin personas, devuelve ranking público vacío, bloquea altas en Auth y nuevas aceptaciones, y revoca la edición personal por RPC de 029. No crea tablas ni modifica registros deportivos. Requiere 025–029 y el esquema previo.

**Límite importante:** los bloqueos del código protegen la aplicación, pero no sustituyen aplicar 030 para cerrar las RPC y altas directas de una base remota. No se ha aplicado 030 ni ninguna otra migración remotamente. No se puede presentar el Supabase remoto como protegido por estos nuevos bloqueos hasta su aplicación y comprobación autorizadas.

## Versiones y aceptación

En [legal.ts](../src/lib/legal.ts) se conserva `LEGAL_VERSION = 2026-11-19.1` como identificador histórico del mecanismo existente. La propuesta es `LEGAL_DRAFT_VERSION = 2026-11-19.2-borrador`, distinta de la versión aceptada. El estado `LEGAL_REVIEW_PENDING` permanece activo.

No se modifica `version_legal_028` ni se atribuye el texto nuevo a aceptaciones antiguas. Las cuentas con aceptación vigente conservan ese registro y no se les vuelve a pedir en cada acceso. Quienes no la tengan ven la revisión pendiente, sin aceptar el borrador. Registro conserva la casilla obligatoria inicialmente desmarcada, pero el envío está deshabilitado y el servidor lo rechaza durante esta revisión.

Se reutiliza el almacenamiento seguro de 028: identidad de sesión/registro, fecha generada por PostgreSQL, versión contrastada en servidor y unicidad por usuario/versión. Se conserva RLS de lectura propia, la idempotencia del mecanismo y los correos/callback de Auth. No se enviaron correos reales.

La futura activación requiere aprobación, congelar y archivar el texto definitivo, asignar un identificador de versión aprobado, coordinarlo entre servidor y base mediante una nueva migración revisada, y comunicar el cambio. No basta desactivar una bandera: también deben existir controles de menores y publicación y revisarse los bloqueos de 030. No se incluye un interruptor de usuario o metadatos para eludirlos.

## Decisiones que debe resolver la Liga

1. Aprobación del Presidente, fecha de activación, comunicación y conservación del texto definitivo por versión.
2. Procedimiento de menores: edad, representación, evidencia mínima, autorizaciones por finalidad, responsables, acceso y revocación.
3. Fundamento jurídico por finalidad y autorización/alcance de publicación deportiva, también de adultos e historial.
4. Proveedor SMTP, servicios efectivamente contratados, regiones, encargados/subencargados, transferencias internacionales y garantías.
5. Dirección postal completa para notificaciones; procedimiento y responsables de solicitudes de privacidad, suspensión y reclamos, respetando los plazos legales.
6. Criterios y periodos de conservación por tipo de dato, respaldos, supresión, disociación e incidentes.
7. Inventario efectivo de cookies y registros de alojamiento y revisión de la adecuación a la reforma al operar desde el 1 de diciembre de 2026.

## Validación y archivos

- TypeScript: aprobado.
- ESLint: cero errores; cuatro advertencias preexistentes fuera de esta entrega.
- Suite Node: 593/593. Los escenarios deportivos/autenticación previos se mantienen en contexto de servicio aprobado simulado; [pruebas específicas](../tests/legal-documents.test.mjs) comprueban el estado real de borrador y sus restricciones.
- [Pruebas PostgreSQL 030](../supabase/tests/030_resguardo_revision.test.mjs): clúster temporal local con datos sintéticos, incluyendo regresiones 028 (registro, aceptación, RLS, concurrencia) y 023 (cuenta única, arbitraje y autoarbitraje). Aprobadas. Se comprobó que fichas, cuentas, aceptaciones y resultados permanecen intactos al instalar el resguardo.
- Build de producción: aprobado.
- Navegador local: ambas páginas renderizan el borrador, datos oficiales, enlaces legales y contacto institucional.

Además de los dos documentos y [legal.ts](../src/lib/legal.ts), se ajustaron las acciones y formularios de [registro](../src/app/actions.ts), [autenticación](../src/components/auth-form.tsx), [aceptación](../src/app/aceptar-terminos/actions.ts) y su [pantalla](../src/app/aceptar-terminos/page.tsx); los accesos de [perfil deportivo](../src/app/panel/jugador/perfil/actions.ts) y su [pantalla](../src/app/panel/jugador/perfil/page.tsx); las lecturas de [torneos públicos](../src/lib/public-tournaments.ts) y [ranking](../src/lib/ranking-data.ts), con avisos en [torneos](../src/components/public-tournament.tsx) y [ranking público](../src/app/ranking/page.tsx). Se añadió el mensaje de revisión en [auth-flow.ts](../src/lib/auth-flow.ts) y se adaptaron los dobles de pruebas de los flujos anteriores.

**Vercel:** las páginas y el build están técnicamente preparados para una vista previa de revisión. No se declara lista la apertura pública integral: requiere decisiones institucionales, los controles pendientes y la aplicación manual del resguardo de base de datos antes de exponer datos reales. No se hizo deploy, push ni modificación de datos reales. No se editaron migraciones 001–029.
