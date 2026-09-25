import { createMockStorage, type MockStorage } from '@/shared/mocks/storage'
import {
  SEED_BUSINESS,
  SEED_BUSINESS_SCENARIOS,
  SEED_PLACES,
  SEED_REWARDS,
  SEED_USER_REWARDS,
  type MockUserReward,
  type MyBusinessScenario,
} from '@/shared/mocks/seed'
import type { Business, MyBusiness } from '@/shared/schemas/business'
import type { BusinessPlaceDetail } from '@/shared/schemas/business-place'
import type { BusinessRewardSummary } from '@/shared/schemas/business-reward'

const STORAGE_KEY = 'geoquest-business.mock-db'

interface MockDb {
  /**
   * Negocio legado (contrato de `GET /business/me`, 3 estados). Sigue
   * siendo la fuente de `business-settings-section.tsx`/`pending-page.tsx`
   * hasta que esas pantallas migren a `myBusiness` (real-backend-readiness
   * PR6c, próximo lote — ver apply-progress). **Ya NO es la fuente de
   * autorización**: `denyUnlessOwner`/`denyUnlessActive` leen `myBusiness`.
   */
  business: Business
  places: BusinessPlaceDetail[]
  rewards: BusinessRewardSummary[]
  /** Canjes de B-04. Los muta el handler de escaneo al confirmar. */
  userRewards: MockUserReward[]
  /**
   * Negocio propio con la forma REAL de `MyBusinessResult` — ÚNICA fuente
   * de AUTORIZACIÓN (real-backend-readiness PR6c, ítem mandatorio de la
   * review de PR6b): `denyUnlessOwner`/`denyUnlessActive`
   * (`shared/mocks/handlers.ts`) y `GET /business/mine` leen de acá, para
   * que las guardas de escritura coincidan con lo que la UI real muestra.
   * Antes `denyUnlessOwner`/`denyUnlessActive` leían `business` (legado,
   * solo 3 estados), desincronizado del negocio que `/business/mine` ya
   * exponía desde PR6a. `null` representa "sin negocio propio" (`GET
   * /business/mine` responde `[]`).
   */
  myBusiness: MyBusiness | null
}

/**
 * Semilla CLONADA en profundidad, no por referencia.
 *
 * ⚠️ `[...SEED_PLACES]` copiaba el arreglo pero **compartía los objetos**.
 * Los handlers que mutan estado in situ — publicar un lugar, publicar una
 * recompensa — escribían entonces sobre las constantes del módulo, y esa
 * mutación sobrevivía a `resetDb()` porque la semilla misma quedaba
 * corrompida. El síntoma es un test que pasa solo o falla según el ORDEN en
 * que corre, que es la clase de falla más cara de diagnosticar.
 *
 * `structuredClone` corta la referencia, incluidos los arreglos anidados
 * (`photos`). Detectado al cubrir los 409 de publicación (#34).
 */
function seedDb(): MockDb {
  return structuredClone({
    business: SEED_BUSINESS,
    places: SEED_PLACES,
    rewards: SEED_REWARDS,
    userRewards: SEED_USER_REWARDS,
    myBusiness: SEED_BUSINESS_SCENARIOS.Active,
  })
}

/**
 * Un solo blob JSON bajo `STORAGE_KEY`, leído/escrito a través del
 * `MockStorage` inyectable — nunca `localStorage` directo (ver storage.ts).
 * `storage` es un parámetro con default para poder testear con un adapter
 * en memoria fresco por test, sin compartir estado entre tests.
 */
export function readDb(storage: MockStorage = createMockStorage()): MockDb {
  return storage.get<MockDb>(STORAGE_KEY) ?? seedDb()
}

export function writeDb(db: MockDb, storage: MockStorage = createMockStorage()): void {
  storage.set(STORAGE_KEY, db)
}

export function resetDb(storage: MockStorage = createMockStorage()): void {
  storage.clear(STORAGE_KEY)
}

/**
 * Único punto que escribe un escenario de `GET /business/mine` sobre el mock
 * db — usado tanto por `shared/mocks/browser.ts` (demo pública vía
 * `?mockBusiness=`) como por `test/mock-business.ts` (`setMockBusiness()`).
 * Clona el escenario semilla antes de guardarlo: `MemoryStorageAdapter`
 * (proyecto Vitest 'node') guarda la referencia cruda sin serializar, así
 * que escribir el objeto de `SEED_BUSINESS_SCENARIOS` sin clonar dejaría un
 * mismo objeto compartido entre `readDb()` de distintos tests.
 */
export function applyMockBusinessScenario(
  scenario: MyBusinessScenario,
  storage: MockStorage = createMockStorage()
): void {
  const db = readDb(storage)
  db.myBusiness = structuredClone(SEED_BUSINESS_SCENARIOS[scenario])
  writeDb(db, storage)
}
