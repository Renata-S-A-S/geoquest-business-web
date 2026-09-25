import { setupWorker } from 'msw/browser'
import { handlers } from '@/shared/mocks/handlers'
import { applyMockBusinessScenario } from '@/shared/mocks/db'
import { resolveMockBusinessScenario } from '@/shared/mocks/mock-business-param'

/**
 * Worker de navegador — usado en `npm run dev` y en el deploy de Vercel
 * mientras `VITE_USE_MOCKS=true` (default). A diferencia de geoquest-web,
 * que solo usa MSW dentro de Vitest: acá el backend de Business no existe
 * todavía, así que el portal necesita poder demostrarse sin él, incluido
 * un preview público. Ver "Diferencias deliberadas" en el plan.
 *
 * `?mockBusiness=Active|Paused|Suspended|PendingVerification|Rejected|none`
 * (real-backend-readiness PR6a, design "Mock status demo") aplica el
 * escenario ANTES de que el worker arranque — así la primera petición a
 * `GET /business/mine` ya lo ve, sin depender de un reload. Sin parámetro o
 * con uno inválido, queda el escenario sembrado por defecto (`Active`).
 */
const mockBusinessScenario = resolveMockBusinessScenario(window.location.search)
if (mockBusinessScenario) applyMockBusinessScenario(mockBusinessScenario)

export const worker = setupWorker(...handlers)
