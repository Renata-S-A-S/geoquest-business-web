import { describe, expect, it } from 'vitest'
import { placeSchema } from './place'

const validPlace = {
  id: '11111111-1111-1111-1111-111111111111',
  businessId: '22222222-2222-2222-2222-222222222222',
  name: 'Café de la 70',
  placeType: 'BusinessVenue',
  category: 'gastronomia',
  subcategory: 'cafe',
  coordinates: { lat: 6.244, lng: -75.581 },
  timeZoneId: 'America/Bogota',
  checkInRadiusMeters: 100,
  photos: ['https://cdn.example.com/1.jpg'],
  xpReward: 0,
  geoPointsReward: 12,
  isVerified: false,
  status: 'Draft',
  totalCheckIns: 0,
  allowedInDiscoveryRoutes: false,
  createdAt: '2026-08-29T00:00:00Z',
}

describe('placeSchema', () => {
  it('parses a valid BusinessVenue payload', () => {
    expect(placeSchema.parse(validPlace)).toMatchObject({ placeType: 'BusinessVenue' })
  })

  it('rejects placeType "TouristSite" — the portal never creates those (ADR-041)', () => {
    expect(() => placeSchema.parse({ ...validPlace, placeType: 'TouristSite' })).toThrow()
  })

  it(
    'rejects a payload shaped like the old (pre-ADR-043) pointsReward field, without ' +
      'xpReward/geoPointsReward — this is exactly the shape the outdated B-02 flow in ' +
      'Confluence still describes',
    () => {
      const staleShape = { ...validPlace, pointsReward: 50 } as Record<string, unknown>
      delete staleShape.xpReward
      delete staleShape.geoPointsReward

      expect(() => placeSchema.parse(staleShape)).toThrow()
    }
  )

  it('rejects checkInRadiusMeters outside the 50–1000 range from B-02', () => {
    expect(() => placeSchema.parse({ ...validPlace, checkInRadiusMeters: 10 })).toThrow()
    expect(() => placeSchema.parse({ ...validPlace, checkInRadiusMeters: 5000 })).toThrow()
  })

  it('rejects zero photos — B-02 requires at least 1', () => {
    expect(() => placeSchema.parse({ ...validPlace, photos: [] })).toThrow()
  })
})
