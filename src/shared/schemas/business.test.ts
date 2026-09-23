import { describe, expect, it } from 'vitest'
import { businessSchema, registerBusinessInputSchema } from './business'

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

const baseRegisterInput = {
  legalName: 'Café de la 70 SAS',
  displayName: 'Café de la 70',
  email: 'contacto@cafe70.co',
  category: 'gastronomia',
  legalDocumentType: 'NIT',
  legalDocumentNumber: '900123456-7',
  commercialAgreementAccepted: true,
}

describe('registerBusinessInputSchema', () => {
  it('parses a valid register input', () => {
    expect(registerBusinessInputSchema.parse(baseRegisterInput)).toEqual(baseRegisterInput)
  })

  it.each(['legalName', 'displayName', 'email', 'category', 'legalDocumentNumber'] as const)(
    'rejects an empty %s',
    (field) => {
      expect(() =>
        registerBusinessInputSchema.parse({ ...baseRegisterInput, [field]: '' })
      ).toThrow()
    }
  )

  it('rejects an invalid email format', () => {
    expect(() =>
      registerBusinessInputSchema.parse({ ...baseRegisterInput, email: 'not-an-email' })
    ).toThrow()
  })

  it.each(['NIT', 'RUT', 'RFC', 'RUC'] as const)(
    'accepts legalDocumentType %s (RN-BIZ-01)',
    (legalDocumentType) => {
      expect(() =>
        registerBusinessInputSchema.parse({ ...baseRegisterInput, legalDocumentType })
      ).not.toThrow()
    }
  )

  it('rejects a legalDocumentType outside NIT/RUT/RFC/RUC', () => {
    expect(() =>
      registerBusinessInputSchema.parse({ ...baseRegisterInput, legalDocumentType: 'CUIT' })
    ).toThrow()
  })

  it('rejects commercialAgreementAccepted: false (RN-BIZ-03)', () => {
    expect(() =>
      registerBusinessInputSchema.parse({
        ...baseRegisterInput,
        commercialAgreementAccepted: false,
      })
    ).toThrow()
  })

  it('rejects a missing commercialAgreementAccepted', () => {
    const { commercialAgreementAccepted: _accepted, ...withoutAcceptance } = baseRegisterInput
    expect(() => registerBusinessInputSchema.parse(withoutAcceptance)).toThrow()
  })

  it('accepts commercialAgreementAccepted: true', () => {
    expect(() =>
      registerBusinessInputSchema.parse({ ...baseRegisterInput, commercialAgreementAccepted: true })
    ).not.toThrow()
  })
})
