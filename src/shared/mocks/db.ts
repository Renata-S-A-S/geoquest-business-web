import { createMockStorage, type MockStorage } from '@/shared/mocks/storage'
import { SEED_BUSINESS, SEED_BUSINESS_STAFF, SEED_PLACES, SEED_REWARDS } from '@/shared/mocks/seed'
import type { Business, BusinessStaff } from '@/shared/schemas/business'
import type { Place } from '@/shared/schemas/place'
import type { Reward } from '@/shared/schemas/reward'

const STORAGE_KEY = 'geoquest-business.mock-db'

interface MockDb {
  business: Business
  businessStaff: BusinessStaff
  places: Place[]
  rewards: Reward[]
}

function seedDb(): MockDb {
  return {
    business: SEED_BUSINESS,
    businessStaff: SEED_BUSINESS_STAFF,
    places: [...SEED_PLACES],
    rewards: [...SEED_REWARDS],
  }
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
