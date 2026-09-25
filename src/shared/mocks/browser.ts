import { setupWorker } from 'msw/browser'
import { handlers } from '@/shared/mocks/handlers'

/**
 * Worker de navegador — usado en `npm run dev` y en el deploy de Vercel
 * mientras `VITE_USE_MOCKS=true` (default). A diferencia de geoquest-web,
 * que solo usa MSW dentro de Vitest: acá el backend de Business no existe
 * todavía, así que el portal necesita poder demostrarse sin él, incluido
 * un preview público. Ver "Diferencias deliberadas" en el plan.
 *
 * Nota (real-backend-readiness PR6a): `applyMockBusinessScenario()` /
 * `SEED_BUSINESS_SCENARIOS` (`shared/mocks/db.ts`/`seed.ts`) ya existen para
 * simular cada status de `GET /business/mine`, pero la demo pública vía
 * `?mockBusiness=` queda diferida a un slice siguiente (recorte de scope
 * para caber en el presupuesto de revisión de 400 líneas) — hoy solo
 * `test/mock-business.ts` la usa.
 */
export const worker = setupWorker(...handlers)
