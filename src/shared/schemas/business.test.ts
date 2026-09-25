import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  businessSchema,
  registerBusinessInputSchema,
  businessStaffRoleSchema,
  businessStaffSchema,
  myBusinessSchema,
} from './business'

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
  termsAccepted: true,
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

  it('rejects termsAccepted: false (#24)', () => {
    expect(() =>
      registerBusinessInputSchema.parse({ ...baseRegisterInput, termsAccepted: false })
    ).toThrow()
  })

  it('rejects a missing termsAccepted', () => {
    const { termsAccepted: _terms, ...withoutTerms } = baseRegisterInput
    expect(() => registerBusinessInputSchema.parse(withoutTerms)).toThrow()
  })

  it('accepts termsAccepted: true', () => {
    expect(() =>
      registerBusinessInputSchema.parse({ ...baseRegisterInput, termsAccepted: true })
    ).not.toThrow()
  })

  it('rejects termsAccepted: false even when commercialAgreementAccepted is true (#24)', () => {
    expect(() =>
      registerBusinessInputSchema.parse({
        ...baseRegisterInput,
        commercialAgreementAccepted: true,
        termsAccepted: false,
      })
    ).toThrow()
  })
})

describe('businessStaffRoleSchema', () => {
  it.each(['Owner', 'Manager', 'Staff'] as const)(
    'acepta el valor %s (BusinessStaffRole.cs del backend)',
    (role) => {
      expect(() => businessStaffRoleSchema.parse(role)).not.toThrow()
    }
  )

  it('rechaza el valor legacy en minúscula "owner" (casing incorrecto vs. el backend)', () => {
    expect(() => businessStaffRoleSchema.parse('owner')).toThrow()
  })

  it('rechaza un valor fuera del enum', () => {
    expect(() => businessStaffRoleSchema.parse('Admin')).toThrow()
  })
})

const baseBusinessStaff = {
  id: '22222222-2222-2222-2222-222222222222',
  businessId: '11111111-1111-1111-1111-111111111111',
  fullName: 'María Restrepo',
  email: 'maria@cafe70.co',
  role: 'Owner',
  status: 'Active',
  createdAt: '2026-08-01T00:00:00Z',
}

describe('businessStaffSchema', () => {
  it('parsea un BusinessStaff válido con role Owner', () => {
    expect(businessStaffSchema.parse(baseBusinessStaff)).toMatchObject({ role: 'Owner' })
  })

  it('rechaza el role legacy en minúscula "owner"', () => {
    expect(() => businessStaffSchema.parse({ ...baseBusinessStaff, role: 'owner' })).toThrow()
  })

  it('rechaza un role fuera de Owner/Manager/Staff', () => {
    expect(() => businessStaffSchema.parse({ ...baseBusinessStaff, role: 'SuperAdmin' })).toThrow()
  })
})

/**
 * `myBusinessSchema` — contrato REAL de `GET /business/mine` (real-backend-readiness
 * PR6a). A diferencia de `businessSchema` (arriba), acá cada test confirma
 * los 5 estados reales del backend y que un payload con la forma LEGACY
 * (`id`/`displayName`, 3 estados) no cuela solo porque comparte el nombre
 * "business".
 */
const baseMyBusiness = {
  businessId: '11111111-1111-1111-1111-111111111111',
  name: 'Café de la 70',
  status: 'Active',
  rejectionReason: null,
  rejectedAtUtc: null,
  hasLegalDocument: true,
  legalDocumentWaived: false,
  logoUrl: null,
  hasVerificationVideo: false,
}

describe('myBusinessSchema', () => {
  it.each(['Active', 'Paused', 'Suspended', 'PendingVerification', 'Rejected'] as const)(
    'acepta el status %s (MyBusinessResult del backend)',
    (status) => {
      expect(() => myBusinessSchema.parse({ ...baseMyBusiness, status })).not.toThrow()
    }
  )

  it('rechaza un status fuera de los 5 valores reales', () => {
    expect(() => myBusinessSchema.parse({ ...baseMyBusiness, status: 'Pending' })).toThrow()
  })

  it('acepta rejectionReason/rejectedAtUtc/logoUrl con valor no nulo (negocio rechazado)', () => {
    const rejected = {
      ...baseMyBusiness,
      status: 'Rejected',
      rejectionReason: 'El documento legal no coincide con el nombre registrado.',
      rejectedAtUtc: '2026-09-01T12:00:00Z',
      logoUrl: 'https://cdn.geoquest.app/logos/cafe70.png',
    }
    expect(myBusinessSchema.parse(rejected)).toMatchObject({ status: 'Rejected' })
  })

  it('acepta la forma [] a través de z.array (0 negocios propios)', () => {
    expect(z.array(myBusinessSchema).parse([])).toEqual([])
  })

  it('parsea un array con un solo elemento', () => {
    expect(z.array(myBusinessSchema).parse([baseMyBusiness])).toHaveLength(1)
  })

  it('rechaza el payload LEGACY de businessSchema (id/displayName, sin businessId/name)', () => {
    expect(() =>
      myBusinessSchema.parse({
        id: '11111111-1111-1111-1111-111111111111',
        displayName: 'Café de la 70',
        status: 'Active',
      })
    ).toThrow()
  })
})
