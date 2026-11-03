# Liga Regional de Tenis de Mesa Los Ríos — PWA

**Hito 1: base funcional** del proyecto de título. Diseñado para **un solo desarrollador**, de forma incremental.

## Qué está implementado

- Inicio público, navegación responsive y calendario conectado a Supabase.
- Registro e inicio de sesión con Supabase Auth; los usuarios nuevos reciben **solo rol Jugador**.
- Paneles protegidos distintos para Administrador, Juez General, Árbitro y Jugador.
- Redirección automática al panel por rol, con **verificación del token en servidor**.
- Panel del Administrador: registrar temporadas, crear fechas y publicar fechas que aparecen públicamente.
- Esquema PostgreSQL con RLS, restricciones, trigger de perfil y separación de responsabilidades.
- Manifest, íconos, instalación PWA compatible y página de recuperación para navegación sin conexión.

**No está implementado aún**: inscripciones, jugadores/clubes/categorías, generación de grupos, llaves, resultados set a set, ranking, asignación de árbitros, sincronización offline de marcadores, edición/borrado de temporadas/fechas ni pruebas automatizadas. Las tarjetas de los paneles correspondientes son **planificación visual, no botones funcionales**. **No es una aplicación terminada ni lista para producción.**

## Requisitos

- Windows 10/11 con [Node.js LTS](https://nodejs.org/) **22 o posterior**, npm y Visual Studio Code.
- Cuenta de [Supabase](https://supabase.com/) y proyecto nuevo.
- Git recomendado, pero no es imprescindible para ejecutar.

## Instalación en VS Code (Windows PowerShell)

1. Descomprime este ZIP en una carpeta de trabajo, por ejemplo `Documentos\proyectos`.
2. Abre VS Code, `Archivo > Abrir carpeta`, elige `liga-tenis-mesa-pwa`.
3. Abre la terminal integrada y ejecuta:

   ```powershell
   npm install
   Copy-Item .env.example .env.local
   ```

4. En Supabase, crea un proyecto. Espera que su base de datos esté lista y abre **SQL Editor > New query**. Copia **todo** `supabase/migrations/001_base_segura.sql` y ejecútalo una sola vez. Este archivo está hecho para un proyecto **nuevo**: no lo ejecutes sobre una base de datos existente sin revisar las tablas y políticas.
5. Ve a **Project Connect / API Keys** y copia **Project URL** y **Publishable key**. Edita `.env.local`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

   Si tu proyecto ofrece una *anon key* antigua en vez de Publishable key, consulta la documentación de Supabase y usa la clave pública equivalente. **Nunca pongas la secret key o service_role en NEXT_PUBLIC_**.
6. En Supabase > **Authentication > URL Configuration** establece:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: agrega `http://localhost:3000/auth/callback`.
7. En la terminal de VS Code:

   ```powershell
   npm run dev
   ```

8. Abre **http://localhost:3000**. Registra tu cuenta en `/registro` y confirma el correo si Supabase lo solicita. Podrás entrar como Jugador.

## Convertir tu cuenta en Administrador — solo en desarrollo

**Hazlo después de registrarte.** En Supabase > SQL Editor, ejecuta esto reemplazando el correo por **el tuyo**:

```sql
update public.perfiles
set rol = 'administrador'
where id = (select id from auth.users where email = 'TU_CORREO@EJEMPLO.COM');
```

No hay ninguna página pública para convertirse en Administrador. Para crear una cuenta de Juez General o Árbitro, cada persona se registra como Jugador y tú — como administrador del proyecto, desde SQL Editor durante este hito — le cambias el rol a `juez_general` o `arbitro`.

**Advertencia:** la edición de roles desde el panel del Administrador no está construida aún. Esto es un procedimiento de configuración inicial, no el flujo final de operación.

## Primera prueba completa

1. Entra en `/panel`: el sistema te redirige al panel según tu rol.
2. Como Administrador, crea una temporada, por ejemplo **Temporada 2026**.
3. Crea una fecha, por ejemplo n.° 1, una fecha válida, comuna **Valdivia**, recinto de ejemplo y estado **Publicada**.
4. Ve al inicio o a `/calendario`: la fecha aparece sin necesidad de iniciar sesión.
5. Crea otra fecha como **Borrador**: no debe aparecer para usuarios públicos.
6. Registra otra cuenta como Jugador: no debe entrar a `/panel/administrador` cambiando la URL.

## Estructura principal

```text
liga-tenis-mesa-pwa/
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                        # Inicio público
│  │  ├─ calendario/page.tsx             # Fechas públicas
│  │  ├─ registro/page.tsx               # Registro
│  │  ├─ login/page.tsx                  # Acceso
│  │  ├─ panel/                          # Paneles por rol
│  │  ├─ actions.ts                       # Acciones del servidor
│  │  ├─ manifest.ts                      # PWA manifest
│  │  └─ auth/callback/route.ts          # Confirmación por correo
│  ├─ components/                        # Componentes reutilizables
│  ├─ lib/auth.ts                         # Autorización por perfil
│  ├─ lib/supabase/                      # Clientes SSR y proxy
│  └─ proxy.ts                            # Renovación de sesión Next 16
├─ public/sw.js                          # Offline de navegación básico
└─ supabase/migrations/001_base_segura.sql
```

## Ruta sugerida de desarrollo — próximo hito

1. Completar entidades base: clubes, jugadores, categorías y administración de roles.
2. Inscripciones con verificación de categoría y estado.
3. Juez General: revisión de participantes, grupos de 3–4 y programación.
4. Árbitro: partidos asignados y resultado set a set.
5. Clasificación, llaves, cierre de resultados oficiales y ranking.
6. Pruebas integradas y offline real, dejando explícito cuándo hay datos sin sincronizar.

**Importante:** los reglamentos específicos (elegibilidad, desempates, sets, puntuación, clasificación y excepciones) se deben codificar a partir de las **bases oficiales de la Liga**, no de suposiciones de una IA.

## Verificaciones locales

```powershell
npm run typecheck
npm run lint
npm run build
```

## Seguridad

- `profiles.rol` no se establece por datos enviados desde el formulario: la base siempre registra `jugador`.
- Los cambios de privilegios se validan en servidor y por políticas **Row Level Security**.
- Los borradores de fechas no pueden leerse con las credenciales anónimas.
- Las rutas privadas usan `auth.getClaims()` para verificar el JWT, no solo `getSession()` en servidor.
- El Service Worker **no** guarda datos privados en caché.
- Para producción todavía faltan políticas detalladas para los módulos deportivos, control de errores y pruebas de concurrencia.

## Fuentes técnicas oficiales

- [Autenticación SSR Supabase / Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Progressive Web Apps Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Row Level Security de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)
