# GeoQuest — Portal de Negocios (Business Web)

Panel de gestión web para dueños de negocios partner de GeoQuest (`Business` / `BusinessStaff`), separado del frontend de exploradores ([`geoquest-web`](https://github.com/Renata-S-A-S/geoquest-web)) y del backend ([`geoquest`](https://github.com/Renata-S-A-S/geoquest)).

- Plan de trabajo de este scaffold: `plan-geoquest-business-web.md`
- Contratos propuestos al backend: `contratos-portal-b2b.md`
- Arquitectura y decisiones: Confluence, espacio CDP — [🏗️ Arquitectura Técnica](https://renatageoquest.atlassian.net/wiki/spaces/CDP/pages/1343490), [📝 Decisiones & ADRs](https://renatageoquest.atlassian.net/wiki/spaces/CDP/pages/1474562) (ADR-046-BF/047-BF/048-BF/049-BF, reservados en página hija — namespace propio, no colisiona con la numeración plana del backend)
- Slice: `004b-business-portal-scaffold`

## Por qué existe un tercer repo

El diagrama de Arquitectura Técnica ya contemplaba un `Portal B2B (Negocios)` como cliente separado de la misma API. Es un tercer frontend, no una feature de `geoquest-web` — audiencia y ciclo de vida propios. Ver ADR-046-BF (borrador).

## Stack

Mismo stack de `geoquest-web` (paridad deliberada, no reinventar convenciones): React 18 + TypeScript, Vite 6, Zustand, TanStack Query v5, React Router v6, Tailwind CSS v4, React Hook Form + Zod, Axios, Phosphor Icons, react-i18next (ES+EN), Vitest + Testing Library + MSW, `vite-plugin-pwa`, navegación mobile-first (bottom nav / sidebar), hosting en Vercel. Ver ADR-049-BF: el portal pasó de "panel desktop-first" a mobile-first — el catálogo original de "diferencias deliberadas" quedó reducido a lo de abajo.

**Diferencias deliberadas** (detalle y razones en el plan):

| Pieza                 | `geoquest-web`         | Este repo                                                                                                                                                       |
| --------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mapbox, Framer Motion | Sí                     | No (se instalan si B-02 los llega a necesitar)                                                                                                                  |
| MSW                   | Solo en tests (Vitest) | También en el navegador (`npm run dev` y el deploy de Vercel) — el backend de `Business` no existe todavía, así que el portal necesita poder demostrarse sin él |

## Mock-first

El backend de `Business` arranca en paralelo (slice `004-business-rewards`, Derek). Para la mayoría de los flujos, este repo avanza contra contratos definidos por el frontend (`contratos-portal-b2b.md`) y mockeados con MSW + `localStorage`, sin esperar al backend real — esa gobernanza de contratos es ADR-048-BF, **aceptado el 1 sep 2026** (no es un borrador). `VITE_USE_MOCKS=true` es el default hasta que el backend exista — ver `.env.example`.

**Excepción documentada: la subida de archivos.** Esos flujos **sí** esperan al backend real. BL-014 (Derek, 2 sep 2026) rechazó cerrar #14/#22/#26/#31 contra el `Uploader` mock como si fuera la implementación final: siguen bloqueados hasta que exista el backend de subida ([`Renata-S-A-S/geoquest#164`](https://github.com/Renata-S-A-S/geoquest/issues/164)). El mecanismo en sí ya está decidido por **ADR-048** (sin sufijo — otra decisión, distinta de ADR-048-BF): ver §4 de `contratos-portal-b2b.md`.

## Comandos

```bash
npm run dev            # servidor de desarrollo
npm run test           # vitest run
npm run test:watch     # vitest en watch
npm run test:coverage  # cobertura
npm run lint           # eslint .
npm run format         # prettier --write .
npm run format:check   # prettier --check . (esto es lo que corre en CI)
```

Gate de calidad completo antes de abrir un PR: `npm run lint && npm run format:check && npm run test:coverage && npm run build`.

## TDD en un scaffold

TDD estricto aplica igual que en `geoquest-web` y en el backend — pero en un scaffold, "test primero" solo tiene sentido donde hay lógica real:

- **Con test primero:** storage adapter de los mocks, schemas Zod (casos válidos e inválidos), wrapper de rutas protegidas, interceptor de sesión, helpers de i18n.
- **Sin test unitario (es configuración):** Vite, ESLint, Prettier, Tailwind, el workflow de Actions. Lo que los valida es que el CI pase — esa es su verificación.

## Convenciones

- Conventional Commits en todos los commits.
- PRs encadenados (`stacked-to-main`), squash-only merge. Al mergear un eslabón, retargetear el resto de la cadena con `gh pr edit <n> --base main` **de inmediato** y verificar contenido real en `main` (`git show origin/main:archivo`) antes de dar nada por cerrado — ver BL-004/BL-005 en el Backlog de Descubrimientos de Confluence.
- Estructura por feature en `src/features/*`, espejo del patrón ya usado en `geoquest-web` (Vertical Slice, un módulo no depende de las tripas de otro).
