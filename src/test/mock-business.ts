import { applyMockBusinessScenario } from '@/shared/mocks/db'
import type { MyBusinessScenario } from '@/shared/mocks/seed'

/**
 * Helper de test (real-backend-readiness PR6a) para simular cada estado de
 * `GET /business/mine` sin construir un `MyBusiness` a mano en cada test.
 * Delgado a propósito: la mutación real vive en `applyMockBusinessScenario`
 * (`shared/mocks/db.ts`), la misma función que usa `shared/mocks/browser.ts`
 * para la demo pública vía `?mockBusiness=` — un solo punto de verdad para
 * "qué significa cada escenario".
 */
export function setMockBusiness(scenario: MyBusinessScenario): void {
  applyMockBusinessScenario(scenario)
}
