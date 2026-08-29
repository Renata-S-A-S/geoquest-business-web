# Kickoff del Portal B2B (Negocios) — scaffolding de `geoquest-business-web`

## Context

El diagrama del sistema en `🏗️ Arquitectura Técnica` ya contempla un **`Portal B2B (Negocios)`** como cliente separado de la misma API REST + SignalR Hub. No es una decisión nueva: es una pieza prevista desde el diseño original que nunca se materializó. Hoy existen dos frontends previstos y solo uno construido (`geoquest-web`, exploradores).

El slice **004-business-rewards** (29 ago – 19 sep 2026) construye el backend de `Business` + `Rewards` + KYC + comisiones. Derek toma el backend; este plan cubre el frente que lo acompaña.

**Qué nos da Confluence y qué no.** El ERD define las **entidades** (`Business`, `BusinessStaff`, `Reward`, `UserReward`, `Commission`, `Subscription`) con sus campos, y `🏢 Flujos del Negocio` define los **flujos** B-01 a B-05. Lo que **no** existe en ninguna parte son los **endpoints**: verbos, paths, forma de request/response. Eso lo proponemos nosotros y por eso el entregable crítico es un documento de contratos que Derek valida — no un resumen de lo que ya estaba escrito.

**Lo que esta sesión NO hace:** no implementa ningún flujo funcional. El objetivo es dejar un proyecto bien fundado, arquitectónicamente consistente con `geoquest-web`, con los contratos definidos y documentados, listo para que los flujos entren después sin refactor.

### Decisiones ya tomadas por el founder (29 ago 2026)

| Decisión                | Resuelto                                                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo                    | **Tercer repositorio separado**: `Renata-S-A-S/geoquest-business-web`                                                                                                              |
| Bloqueo de backend      | **Mock-first**: nosotros definimos los contratos, mock data + persistencia en `localStorage`; al final se le entrega a Derek un documento con todo lo necesario para implementar   |
| Alcance                 | **Solo set-up**: arquitectura escalable, consistencia con `geoquest-web` (estructura de archivos, colores, diseño), Confluence actualizado, proyecto preparado para flujos futuros |
| Auth de `BusinessStaff` | **Decisión abierta del backend.** El frontend asume "JWT con claim de rol" y lo aísla detrás de un puerto propio                                                                   |

---

## Fase 0 — Prerrequisitos, en este orden

Sin Issue no se empieza, y sin repo no hay dónde abrir la Issue. Secuencia exacta:

1. **Crear el repo vacío** `Renata-S-A-S/geoquest-business-web` (privado, sin plantilla, con `main` como rama base). Esto no es una work unit: es un prerrequisito, no produce diff.
2. **Configurar el repo antes del primer PR**: squash-only merge (deshabilitar merge commit y rebase merge, igual que `geoquest-web` por ADR-032) y **crear los labels** — un repo nuevo trae los de GitHub por defecto, no los del proyecto. Mínimo: `module:business`, `type:chore`, `type:feat`, `type:fix`, `type:docs`, `priority:mvp`.
3. **Reservar los números de ADR en Confluence** agregando las tres entradas al índice de `📝 Decisiones & ADRs` en estado _"🚧 Borrador"_, **antes** de empezar. Derek está trabajando el slice 004 en paralelo y puede necesitar ADRs propios; el índice es el único mecanismo que tenemos para no colisionar. Si al momento de ejecutar el último aceptado ya no es ADR-045, se corren los números — verificar contra Confluence, no contra este plan.
4. **Abrir la Issue épica** en el repo nuevo:
   - Título: `[business] Scaffold del Portal B2B — estructura, tooling, contratos mock y design system`
   - Labels: `module:business` · `type:chore` · `priority:mvp`
   - **Un solo dueño** (Jose David), anunciado a Derek antes de arrancar — es transversal, no cabe repartirlo por módulo.
   - Slice: `004b-business-portal-scaffold`, siguiendo el patrón ya usado con `002b-frontend-scaffold` y `003b-frontend-map-discovery`.
5. **Acordar con Derek cómo se revisan estos PRs.** El workflow exige revisión cruzada antes de mergear y Derek va a estar metido en el backend del slice 004. Acordar antes de empezar una de dos: (a) Derek revisa solo los PRs con decisión arquitectónica (WU0, WU2, WU4, WU5) y el documento de contratos, y el resto pasa con `/code-review`; o (b) revisa todo con SLA de 24h. Lo que **no** puede pasar es descubrirlo con seis PRs abiertos esperando.

---

## Paso 1 — Leer el repo real antes de copiar nada

`geoquest-web` **no está clonado** en este directorio (aquí solo hay documentos de proceso). La regla del workflow es explícita: verificar contra la fuente viva, nunca contra una copia vieja ni contra lo que dice Confluence de memoria. Ya hubo dos informes de auditoría con hallazgos falsos por saltarse esto.

```bash
gh repo clone Renata-S-A-S/geoquest-web /tmp/geoquest-web-ref
```

De ahí se copian **literalmente** (no se reinventan):

- `eslint.config.js`, `.prettierrc`, `tsconfig*.json`, `vite.config.ts`, `.nvmrc` (o la versión de Node que use el CI)
- Los nombres de los scripts de `package.json` — el portal debe responder a los mismos comandos: `dev`, `test`, `test:watch`, `test:coverage`, `lint`, `format`, `format:check`
- Los tokens de Tailwind v4 en `src/styles/` (paleta, tipografía, radios)
- El workflow de GitHub Actions (`lint → format:check → test:coverage → build` + `pr-title`)
- La forma de `src/features/*/` (cada feature con sus `components/`, `hooks/`, `api.ts`)
- La estructura del cliente Axios y de los schemas Zod de `shared/schemas/` — **la estructura, no el contenido de auth** (ver Paso 3)

Si algo de lo que dice Confluence no coincide con el repo real, **gana el repo** para convenciones de código (y se corrige Confluence).

---

## Paso 2 — Estructura del proyecto

Misma organización por feature que `geoquest-web`, con las diferencias que impone ser un panel de gestión y no una PWA de campo:

```
src/
  app/
    routes.tsx
    providers.tsx
    layout/            # sidebar fijo desktop-first (NO bottom nav)
  features/
    auth/              # login de BusinessStaff (placeholder)
    onboarding/        # B-01 registro + verificación
    places/            # B-02
    rewards/           # B-03
    redemptions/       # B-04 validar QR
    analytics/         # B-05 dashboard
  shared/
    components/ui/     # primitivos shadcn, sin tocar
    components/        # composiciones propias
    hooks/
    lib/               # axios, query client, session port, utils
    schemas/           # Zod espejando el ERD — el contrato vive acá
    mocks/             # MSW handlers + storage adapter
  styles/              # tokens de marca
```

Cada `features/*` se crea **vacía con su placeholder de ruta**. La carpeta existiendo es la señal de dónde va cada flujo futuro; el contenido llega en sus propios slices.

### Diferencias deliberadas frente a `geoquest-web`

| Pieza         | `geoquest-web`                      | Portal B2B                      | Por qué                                                                                                                                                                                |
| ------------- | ----------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navegación    | Bottom nav <1024px / rail ≥1024px   | **Sidebar fijo, desktop-first** | El staff opera desde mostrador o escritorio; el único flujo con vocación móvil es escanear el QR (B-04)                                                                                |
| PWA           | `vite-plugin-pwa` + manifest        | **No en el scaffold**           | Un panel de gestión no necesita instalarse ni offline. Se reevalúa si B-04 termina usándose desde celular. Beneficio lateral: sin service worker propio no hay conflicto con el de MSW |
| Mapbox        | Central (mapa home)                 | Se instala recién en B-02       | Ubicar el pin de un `Place` es el único uso; no entra en el scaffold                                                                                                                   |
| Framer Motion | Micro-interacciones de gamificación | **No**                          | La celebración de XP/badges es lenguaje de explorador, no de negocio                                                                                                                   |

**Paridad explícita (no son diferencias, se replican igual):** React 18 + TS, Vite 6, Zustand, TanStack Query v5, React Router v6, shadcn/ui + Tailwind v4, React Hook Form + Zod, Axios, Phosphor Icons, react-i18next con ES+EN, hosting en Vercel, Vitest + RTL + MSW. i18n entra **desde el scaffold** por la misma razón que en `geoquest-web`: retrofitearlo cuesta caro (lo confirma su WU11).

### Sistema de diseño: qué se hereda y qué no

`🎨 Identidad de Marca & Sistema de Diseño` dice explícitamente _"No incluye el Portal B2B ni el panel de admin"_ — extender la marca a B2B es una decisión nueva, no un dato existente.

- **Se hereda tal cual:** paleta (Explorer teal `#0EA5A0`, Sunset coral `#FF7A59`, Spring green `#3ECF8E`, Jungle ink `#10262B`, Cloud cream `#FFF9F2`, Alert red `#E5484D`), tipografía (Baloo 2 / Nunito / Space Mono), Phosphor Icons peso fill, shadcn/ui + Tailwind v4, modo claro y oscuro.
- **No se hereda:** la firma visual lúdica — borde rasgado, sello de barrio rotado, textura topográfica. Un dueño de negocio evaluando comisiones necesita densidad de datos y sobriedad, no una libreta de aventura. Coral queda restringido a acentos puntuales, no a celebración.
- **Pendiente heredado:** la paleta de modo oscuro exacta **no está definida** en Confluence (figura como pendiente abierto en esa misma página). El scaffold define los tokens dark del portal y hay que decidir explícitamente si se proponen como los del sistema completo o quedan acotados al portal. Se resuelve en WU2, no se descubre después.

Esto va a **ADR-047** (ver abajo) porque es una decisión de producto con la que Derek debe estar de acuerdo, no una preferencia de implementación.

---

## Paso 3 — Contratos, mocks y el puerto de sesión

El corazón del entregable. La estrategia es _contrato primero, mock después_ — el precedente es ADR-037 (rutas: el frontend arrancó con datos sembrados mientras el backend no tenía lectura) y el contraejemplo es BL-002 (`interests` llegaba como enteros en vez de strings, detectado recién al integrar; el fix "obvio" del issue además reventaba en runtime).

### 3.1 Schemas Zod

En `shared/schemas/`, derivados del ERD, uno por entidad: `Business`, `BusinessStaff`, `Reward`, `UserReward`, `Commission`, `Subscription`, y `Place` en su forma B2B.

- `Place.pointsReward` **ya no existe** — se partió en `xpReward` + `geoPointsReward` (ADR-043), y los GeoPoints de un `BusinessVenue` los fija GeoQuest, no el negocio (ADR-041). El flujo B-02 de Confluence está desactualizado en ese punto.
- Un `Place` creado desde el portal es `placeType = BusinessVenue` por definición (ADR-041), y solo esos cuentan para el límite de plan (RN-BIZ-05).
- `UserReward.origin` distingue comprada vs otorgada (ADR-045) — el portal debe mostrarlo en B-04, porque una otorgada no descuenta saldo.
- `Subscription` entra al scaffold **solo como lectura**: durante el MVP todos los negocios son plan Free (ADR-016 difiere la monetización) y `Commission.status = Waived`. No se modela ninguna UI de pago.
- Las relaciones que cruzan módulos son **soft references** (Guid sin FK): el contrato no puede asumir joins ni datos embebidos que el backend no vaya a poder resolver barato.
- Cada schema lleva en un comentario el ADR o la RN de origen. Si el ERD se vuelve a mover —cambió el 28 de agosto con ADR-040 a 045—, un grep encuentra qué tocar.

### 3.2 Puerto de sesión — aquí es donde NO se copia `geoquest-web`

El interceptor de Axios de `geoquest-web` renueva el token contra `/auth/refresh` del módulo Identity, pensado para un `Explorer`. La autenticación de `BusinessStaff` es **precisamente la decisión abierta**: copiar ese interceptor tal cual es asumir la respuesta y quedarse con código que hay que desarmar después.

El scaffold define un puerto `SessionPort` en `shared/lib/` con la superficie mínima —`getAccessToken()`, `refresh()`, `signOut()`— y **una sola implementación mock** en este slice. El interceptor de Axios consume el puerto, nunca un endpoint concreto. Cuando Derek cierre el mecanismo real, cambia una implementación y ni las features ni el interceptor se enteran. Esta es la única pieza donde la estructura de `geoquest-web` se copia pero su contenido no.

### 3.3 Mocks con MSW

- **Dos entornos, un solo juego de handlers.** MSW corre como service worker en el navegador (`setupWorker`) y como `setupServer` en Vitest. Los handlers se comparten; lo que cambia es el arranque.
- **El storage va detrás de una interfaz**, no `localStorage` directo. En el navegador la implementación es `localStorage`; en los tests es in-memory. Si los handlers tocan `localStorage` directo, la suite de Vitest se rompe o arrastra estado entre tests — es el error clásico de este montaje y hay que evitarlo por diseño, no parcheándolo después.
- **Un solo punto de conmutación**: `VITE_USE_MOCKS`. Nada de `if (mock)` desperdigado por las features. Con el flag apagado, el cliente Axios apunta a `VITE_API_BASE_URL`.
- **Defaults explícitos y documentados en `.env.example`**: `VITE_USE_MOCKS=true` mientras el backend no exista, incluido el build de Vercel. Si el flag queda mal por default, el portal desplegado se ve en blanco y el síntoma no señala la causa.
- **`mockServiceWorker.js` va commiteado en `public/`** (lo genera `npx msw init public/`). Sin ese archivo el worker no arranca en el build desplegado, aunque en `npm run dev` todo funcione.
- **Errores en formato `problem+json` (RFC7807)**, igual que el backend real. Anotar BL-006 como pendiente conocido: el backend hoy ignora `Accept-Language` y devuelve `detail` en español hardcodeado, así que el portal hereda el mismo hueco de i18n que `geoquest-web`.

---

## Paso 4 — Tooling, CI y cómo aplica TDD a un scaffold

- ESLint flat config + Prettier + `eslint-config-prettier`, copiados de `geoquest-web`.
- Vitest + Testing Library + MSW.
- GitHub Actions en cada PR **sin filtro de rama** (el repo va a usar PRs encadenados que a veces targetean ramas feature): `lint → format:check → test:coverage → build`, más el check de Conventional Commits sobre el título del PR (`amannn/action-semantic-pull-request`, **pineado por SHA**).
- Node pinneado a la misma versión que usa el CI de `geoquest-web`.
- Deploy en Vercel, proyecto aparte, con `VITE_USE_MOCKS=true` en las variables de entorno del proyecto.

### TDD en un scaffold

El repo exige TDD estricto, pero la mitad de estas work units son configuración, donde "test primero" no significa nada. La regla operativa para este slice:

- **Con test primero (hay lógica real):** el storage adapter de los mocks, los schemas Zod (casos válidos e inválidos, especialmente los enums que reventaron en BL-002), el wrapper de rutas protegidas, el interceptor contra el `SessionPort`, los helpers de i18n.
- **Sin test unitario (es configuración):** Vite, ESLint, Prettier, Tailwind, el workflow de Actions. Lo que los valida es que el CI pase, y eso es su verificación.

Escribirlo así en el README evita la discusión en cada PR.

### Coverage gate

El umbral **no se fija en WU1**: en ese momento no hay código y cualquier número es inventado. Se instala Vitest con coverage habilitado y **sin gate** en WU1, y el gate bloqueante se agrega en la work unit final, con el umbral derivado del baseline realmente medido sobre el scaffold terminado. Es el mismo criterio que usó `geoquest-web` (baseline medido, ratchet hacia arriba), aplicado en el momento en que es posible medirlo. No se copia su número.

### PRs encadenados

⚠️ **BL-004 / BL-005 aplican desde el primer eslabón**: al mergear uno, retargetear explícitamente `gh pr edit <n> --base main` en el resto de la cadena _inmediatamente_, y verificar contenido real en `main` (`git show origin/main:archivo`) antes de dar nada por cerrado. El estado `MERGED` de GitHub ya mintió dos veces en este proyecto.

⚠️ **El límite de ~400 líneas se mide sobre código escrito a mano.** Archivos generados y lockfiles quedan fuera del conteo: `package-lock.json` solo ya son miles de líneas y los primitivos que genera el CLI de shadcn también. La intención de la regla es proteger el foco de la revisión, y nadie revisa un lockfile línea por línea. Se declara en la descripción de cada PR qué parte del diff es generada, para que el revisor sepa dónde mirar.

---

## Plan de PRs (cadena `stacked-to-main`)

Un PR por work unit. El repo ya existe y está configurado antes de WU0 (Fase 0).

| PR  | Alcance                                                                                                                                              | Depende de |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| WU0 | Vite 6 + React 18 + TS, estructura de carpetas vacía, `.nvmrc`, `.env.example`, README con las convenciones del repo                                 | —          |
| WU1 | Tooling: ESLint, Prettier, Vitest + RTL con coverage **sin gate**, GitHub Actions (`quality` + `pr-title`)                                           | WU0        |
| WU2 | Design system: Tailwind v4 + tokens de marca, fuentes, `shadcn init`, Phosphor en reemplazo de lucide, modo claro/oscuro con la paleta dark decidida | WU0        |
| WU3 | App shell: React Router v6, providers, layout con sidebar, `SessionPort` + wrapper de rutas protegidas, error boundary por feature                   | WU2        |
| WU4 | Capa de datos: Axios sobre el `SessionPort`, TanStack Query, Zustand (solo estado de cliente), schemas Zod del ERD                                   | WU3        |
| WU5 | Mocks: handlers MSW compartidos, storage adapter con las dos implementaciones, seed coherente con el ERD, `mockServiceWorker.js`                     | WU4        |
| WU6 | i18n ES/EN, placeholders de ruta para B-01…B-05, **coverage gate con el baseline medido**                                                            | WU5        |

WU1 y WU2 pueden ir en paralelo una vez mergea WU0. El resto es secuencial. El coverage gate se deja al final a propósito (ver arriba), lo que hace que WU6 dependa de WU5 aunque i18n por sí solo no dependa.

---

## Entregables de la sesión

### 1. `plan-geoquest-business-web.md`

El plan de trabajo versionado, en el repo nuevo.

### 2. `contratos-portal-b2b.md` — **el entregable crítico**

Lo que le permite a Derek arrancar el backend sin volver a preguntar:

- **Endpoints propuestos** con verbo, path, request y response para B-01 a B-05. Van marcados como _propuesta del frontend_, no como especificación cerrada: el ERD daba entidades, no rutas.
- Shape exacto de cada payload, con los schemas Zod como fuente ejecutable.
- Reglas de negocio que el backend debe hacer cumplir, citadas: RN-BIZ-01 a 06, RN-REW-04 (QR de 30 min), RN-REW-05 (stock → `Exhausted`), RN-REW-06 (solo el negocio dueño valida), RN-REW-08 (trustScore y sus umbrales).
- **Preguntas abiertas que Derek debe cerrar**, marcadas como tales:
  - Autenticación de `BusinessStaff`: ¿mismo Identity con claim de rol, o login propio? ¿Aplica Google OAuth o solo email/password?
  - ¿Se expone `Commission` al portal durante el MVP? RN-BIZ-06 define 5-10%, pero ADR-016 difiere la monetización y el ERD dice `status = Waived` en el MVP.
  - Subida del documento legal y del video de 30s (RN-BIZ-02): ¿SAS de Azure Blob directo desde el cliente, o endpoint del backend?
  - RN-BIZ-05 dice que los límites de plan son "configurables sin deploy" — ¿el portal los lee de un endpoint, o los hardcodea el frontend por ahora?
- **Desfases detectados entre Confluence y el ERD**, para que no se implementen como están escritos: el flujo B-02 todavía habla de un `pointsReward` mínimo de 50 definido por el negocio, cosa que ADR-041 y ADR-043 ya invalidaron.

### 3. Borradores de ADR

Los números se reservan en el índice de Confluence en la Fase 0. Al 29 de agosto el último aceptado es ADR-045, pero **hay que reverificarlo** al ejecutar: Derek está trabajando en paralelo.

- **ADR-046 — Tercer repositorio para el Portal B2B.** Extiende el razonamiento de ADR-031 (ciclos de deploy independientes, audiencias distintas) a la relación entre dos frontends. Alternativas descartadas: monorepo de frontends con `packages/ui` (exige migrar un repo ya en producción y adoptar tooling que nadie mantiene), segunda app dentro de `geoquest-web` (acopla los deploys de dos productos distintos).
- **ADR-047 — El Portal B2B hereda la paleta y la tipografía, no la firma lúdica.** Desktop-first, sin borde rasgado ni sello ni textura topográfica. Incluye la paleta de modo oscuro, que estaba pendiente.
- **ADR-048 — Contratos definidos por el frontend, validados por el backend.** Formaliza el mock-first: quién es dueño del contrato mientras no hay implementación, cómo se versiona, y cuándo deja de ser autoritativo — el día que el backend lo implementa, gana el backend.

### 4. Checklist de actualización de Confluence

Se hace **como parte del PR**, no como tarea que se posterga:

- `🏗️ Arquitectura Técnica` → el `Portal B2B (Negocios)` del diagrama pasa de previsto a **en construcción**; agregar el tercer repo al mapa de repositorios.
- `📝 Decisiones & ADRs` → pasar ADR-046/047/048 de borrador a aceptados una vez revisados.
- `🗂️ Tablero SDD` → agregar `004b-business-portal-scaffold` a la lista de **Valores válidos → Slice** (hoy no está) _y_ la fila del slice con su Issue épica.
- `🗺️ Secuencia de Slices y Completitud` → agregar `004b-business-portal-scaffold` a la secuencia.
- `🎨 Identidad de Marca & Sistema de Diseño` → corregir la nota _"No incluye el Portal B2B ni el panel de admin"_, que deja de ser cierta, y cerrar el pendiente de paleta dark.
- `⚛️ Arquitectura Frontend` → crear una página hermana para el Portal B2B en vez de extender esa (son dos productos con navegación, restricciones y audiencias distintas).
- `🏢 Flujos del Negocio` → anotar que B-02 quedó desactualizado por ADR-041/043.
- `📋 Backlog de Descubrimientos` → lo que aparezca durante el scaffold entra acá; no amplía el alcance de este trabajo.

---

## Fuera de alcance (explícito)

- No se toca el backend (`Renata-S-A-S/geoquest`) — ni un archivo.
- No se toca `geoquest-web`, salvo clonarlo como referencia de lectura.
- No se implementa ningún flujo B-01 a B-05: solo sus carpetas y rutas placeholder.
- No se decide monetización (ADR-016 la difiere a Q1 2027; cerrado).
- No se decide el mecanismo de auth de `BusinessStaff` — se aísla tras el `SessionPort` y se documenta como pregunta abierta.
- No se instala Mapbox, Framer Motion, `vite-plugin-pwa` ni el cliente de SignalR.

## Riesgos

| Riesgo                                                                                         | Mitigación                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Los contratos que definamos no coinciden con lo que Derek implemente → retrabajo de reconexión | ADR-048 fija que el backend gana en caso de conflicto; Derek revisa el documento **antes** de implementar, no después                                                          |
| El scaffold se convierte en un tercer set de convenciones divergente                           | WU1/WU2 copian los archivos de configuración de `geoquest-web` literalmente, no "inspirados en"                                                                                |
| La cadena de PRs repite BL-004/BL-005                                                          | Retargeteo explícito de `--base main` tras cada merge + verificación de contenido real en `main`                                                                               |
| Colisión de numeración de ADRs con el slice 004 de Derek                                       | Números reservados como borrador en el índice de Confluence en la Fase 0, y reverificados al ejecutar                                                                          |
| El deploy de Vercel queda en blanco por mocks mal configurados                                 | `VITE_USE_MOCKS=true` explícito en el proyecto de Vercel y en `.env.example`; `mockServiceWorker.js` commiteado; verificación #4 lo prueba en el deploy real, no solo en local |
| El ERD sigue moviéndose (cambió el 28 de agosto con ADR-040 a 045)                             | Cada schema Zod cita su ADR de origen en un comentario                                                                                                                         |

---

## Verificación

### DoD del scaffold (lo que depende solo de nosotros)

En un clon limpio:

```bash
npm ci && npm run lint && npm run format:check && npm run test:coverage && npm run build
```

pasa todo en verde, y además:

1. `npm run dev` levanta el portal con el layout de sidebar y las 5 rutas placeholder navegables.
2. Con `VITE_USE_MOCKS=true`, una pantalla de prueba lee y escribe una entidad contra MSW, y el dato **sobrevive a un reload** del navegador.
3. La misma suite de handlers MSW corre en Vitest sin tocar `localStorage` — los tests pasan en el entorno de Node y **no arrastran estado entre sí** (correr la suite dos veces seguidas da el mismo resultado).
4. El **deploy de preview de Vercel** carga y navega, no solo el `dev` local. Es la verificación real de `mockServiceWorker.js` y del flag.
5. El CI corre en verde sobre el PR real de GitHub.
6. Modo claro y oscuro se alternan sin colores hardcodeados fuera de los tokens.
7. El contenido de cada PR está verificado en `main` (`git show origin/main:<archivo>`), no dado por bueno según el estado `MERGED` de GitHub.

### DoD del handoff (depende de terceros — se trackea, no bloquea el scaffold)

8. `contratos-portal-b2b.md` publicado y notificado a Derek en el Issue.
9. Derek dejó su feedback y las preguntas abiertas quedaron respondidas o explícitamente diferidas.
10. Las páginas de Confluence del checklist actualizadas — verificando el estado contra GitHub primero, nunca al revés.
11. ADR-046/047/048 revisados entre Derek y Jose David, y pasados de borrador a aceptados.
