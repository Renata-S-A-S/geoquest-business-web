import { describe, expect, it } from 'vitest'
import { rewardSchema } from './reward'

const baseReward = {
  id: '11111111-1111-1111-1111-111111111111',
  businessId: '22222222-2222-2222-2222-222222222222',
  placeId: '33333333-3333-3333-3333-333333333333',
  title: '2x1 en café',
  type: 'Discount',
  rewardCategory: 'General',
  geoPointsCost: 100,
  minLevelRequired: null,
  linkedTouristPlaceId: null,
  linkedPlaceWindowDays: null,
  stock: 20,
  stockRedeemed: 0,
  estimatedValueCop: 15000,
  validFrom: null,
  validUntil: null,
  status: 'Active',
}

describe('rewardSchema', () => {
  it('parses a valid General reward', () => {
    expect(rewardSchema.parse(baseReward)).toMatchObject({ rewardCategory: 'General' })
  })

  it('rejects a Special reward without linkedTouristPlaceId (RN-REW-03B)', () => {
    expect(() =>
      rewardSchema.parse({ ...baseReward, rewardCategory: 'Special', linkedTouristPlaceId: null })
    ).toThrow(/linkedTouristPlaceId/)
  })

  it('accepts a Special reward with linkedTouristPlaceId set', () => {
    const special = {
      ...baseReward,
      rewardCategory: 'Special',
      linkedTouristPlaceId: '44444444-4444-4444-4444-444444444444',
      linkedPlaceWindowDays: 7,
    }
    expect(rewardSchema.parse(special)).toMatchObject({ rewardCategory: 'Special' })
  })

  it('rejects a type outside the 4 values from B-03', () => {
    expect(() => rewardSchema.parse({ ...baseReward, type: 'Cashback' })).toThrow()
  })

  it('rejects status "Cancelled" — not one of the confirmed/proposed values', () => {
    expect(() => rewardSchema.parse({ ...baseReward, status: 'Cancelled' })).toThrow()
  })
})
