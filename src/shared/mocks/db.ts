import { createMockStorage, type MockStorage } from '@/shared/mocks/storage'
import {
  SEED_BUSINESS,
  SEED_BUSINESS_STAFF,
  SEED_PLACES,
  SEED_REWARDS,
  SEED_USER_REWARDS,
  type MockUserReward,
} from '@/shared/mocks/seed'
import type { Business, BusinessStaff } from '@/shared/schemas/business'
import type { BusinessPlaceDetail } from '@/shared/schemas/business-place'
import type { BusinessRewardSummary } from '@/shared/schemas/business-reward'

const STORAGE_KEY = 'geoquest-business.mock-db'

interface MockDb {
  business: Business
  businessStaff: BusinessStaff
  places: BusinessPlaceDetail[]
  rewards: BusinessRewardSummary[]
  /** Canjes de B-04. Los muta el handler de escaneo al confirmar. */
  userRewards: MockUserReward[]
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
    businessStaff: SEED_BUSINESS_STAFF,
    places: SEED_PLACES,
    rewards: SEED_REWARDS,
    userRewards: SEED_USER_REWARDS,
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
