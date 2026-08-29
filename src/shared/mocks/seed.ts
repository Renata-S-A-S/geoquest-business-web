import type { Business, BusinessStaff } from '@/shared/schemas/business'
import type { Place } from '@/shared/schemas/place'
import type { Reward } from '@/shared/schemas/reward'

/**
 * Semilla mínima pero coherente con el ERD — un negocio verificado, su
 * staff, dos lugares (BusinessVenue) y una recompensa General. IDs fijos
 * para que los tests y la demo manual sean deterministas.
 */
export const SEED_BUSINESS: Business = {
  id: '00000000-0000-0000-0000-000000000001',
  legalName: 'Café de la 70 SAS',
  displayName: 'Café de la 70',
  email: 'contacto@cafe70.co',
  category: 'gastronomia',
  status: 'Active',
  legalDocumentType: 'NIT',
  legalDocumentNumber: '900123456-7',
  googleMapsPlaceId: 'ChIJ_seed_place_id',
  isGoogleMapsVerified: true,
  isInformalBusiness: false,
  trustScore: 4.6,
  trustStatus: 'Premium',
  totalRedemptions: 12,
  totalReports: 0,
  isPlatformOwned: false,
  commercialAgreementSignedAt: '2026-08-01T00:00:00Z',
  createdAt: '2026-08-01T00:00:00Z',
}

export const SEED_BUSINESS_STAFF: BusinessStaff = {
  id: '00000000-0000-0000-0000-000000000002',
  businessId: SEED_BUSINESS.id,
  fullName: 'María Restrepo',
  email: 'maria@cafe70.co',
  role: 'owner',
  status: 'Active',
  createdAt: '2026-08-01T00:00:00Z',
}

export const SEED_PLACES: Place[] = [
  {
    id: '00000000-0000-0000-0000-000000000010',
    businessId: SEED_BUSINESS.id,
    name: 'Café de la 70 — Sede Laureles',
    placeType: 'BusinessVenue',
    category: 'gastronomia',
    subcategory: 'cafe',
    coordinates: { lat: 6.2447, lng: -75.5916 },
    timeZoneId: 'America/Bogota',
    checkInRadiusMeters: 100,
    photos: ['https://picsum.photos/seed/cafe70-1/400/300'],
    xpReward: 0,
    geoPointsReward: 12,
    isVerified: true,
    status: 'Active',
    totalCheckIns: 143,
    allowedInDiscoveryRoutes: false,
    createdAt: '2026-08-01T00:00:00Z',
  },
]

export const SEED_REWARDS: Reward[] = [
  {
    id: '00000000-0000-0000-0000-000000000020',
    businessId: SEED_BUSINESS.id,
    placeId: SEED_PLACES[0].id,
    title: '2x1 en café de especialidad',
    type: 'Discount',
    rewardCategory: 'General',
    geoPointsCost: 100,
    minLevelRequired: null,
    linkedTouristPlaceId: null,
    linkedPlaceWindowDays: null,
    stock: 50,
    stockRedeemed: 8,
    estimatedValueCop: 15000,
    validFrom: null,
    validUntil: null,
    status: 'Active',
  },
]
