import { describe, expect, it } from 'vitest'
import { businessSchema } from './business'

const baseBusiness = {
  id: '11111111-1111-1111-1111-111111111111',
  legalName: 'Café de la 70 SAS',
  displayName: 'Café de la 70',
  email: 'contacto@cafe70.co',
  category: 'gastronomia',
  status: 'Active',
  legalDocumentType: 'NIT',
  legalDocumentNumber: '900123456-7',
  googleMapsPlaceId: null,
  isGoogleMapsVerified: false,
  isInformalBusiness: false,
  trustScore: 4.6,
  trustStatus: 'Premium',
  totalRedemptions: 0,
  totalReports: 0,
  isPlatformOwned: false,
  commercialAgreementSignedAt: '2026-08-29T00:00:00Z',
  createdAt: '2026-08-29T00:00:00Z',
}

describe('businessSchema', () => {
  it('parses a valid business', () => {
    expect(businessSchema.parse(baseBusiness)).toMatchObject({ status: 'Active' })
  })

  it('rejects a status outside Pending/Active/Suspended', () => {
    expect(() => businessSchema.parse({ ...baseBusiness, status: 'Rejected' })).toThrow()
  })

  it('rejects a trustStatus outside the 4 tiers from RN-REW-08', () => {
    expect(() => businessSchema.parse({ ...baseBusiness, trustStatus: 'Gold' })).toThrow()
  })

  it('rejects an invalid email', () => {
    expect(() => businessSchema.parse({ ...baseBusiness, email: 'not-an-email' })).toThrow()
  })
})
