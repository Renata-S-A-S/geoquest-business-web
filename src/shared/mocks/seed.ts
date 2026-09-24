import type { Business, BusinessStaff, BusinessStaffMe } from '@/shared/schemas/business'
import type { BusinessPlaceDetail } from '@/shared/schemas/business-place'
import { Category, Subcategory } from '@/shared/schemas/taxonomy'
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

// `role: 'Owner'` — PascalCase, no 'owner'. Fuente:
// `src/GeoQuest.Modules.Business/Domain/BusinessStaffRole.cs`:
// `internal enum BusinessStaffRole { Owner = 0, Manager = 1, Staff = 2 }`.
// El casing importa: contra un backend real, un `role` en minúscula nunca
// haría match con este enum y `canEditBusinessProfile` fallaría en
// silencio (ningún error de tipo lo detectaría, porque `role` era
// `z.string()` antes de #72 PR4) — ver businessStaffRoleSchema.
export const SEED_BUSINESS_STAFF: BusinessStaff = {
  id: '00000000-0000-0000-0000-000000000002',
  businessId: SEED_BUSINESS.id,
  fullName: 'María Restrepo',
  email: 'maria@cafe70.co',
  role: 'Owner',
  status: 'Active',
  createdAt: '2026-08-01T00:00:00Z',
}

/**
 * Username propuesto para `GET /business-staff/me` (#72, PR4) — no existe
 * en `BusinessStaff` (`businessStaffSchema`), porque vive en el mismo
 * `Identity` que usa el Explorer, enlazado vía `ExplorerId` (contratos
 * §4.1). Si esa proyección es alcanzable para una cuenta que es SOLO
 * BusinessStaff (sin `ExplorerProfile`) es una pregunta abierta — ver
 * `Renata-S-A-S/geoquest#182`. Semilla de demo, no un dato confirmado.
 */
export const SEED_BUSINESS_STAFF_USERNAME = 'maria_cafe70'

/**
 * Vista combinada que sirve `GET /business-staff/me`: el `BusinessStaff`
 * semilla + el `username` propuesto de Identity. No se modela como parte
 * de `MockDb` (ver db.ts) porque `username` no es un campo del dominio
 * `BusinessStaff` — es una proyección que el handler arma en el momento,
 * igual que lo haría un backend real al resolver el `Identity` del
 * bearer token.
 */
export const SEED_BUSINESS_STAFF_ME: BusinessStaffMe = {
  ...SEED_BUSINESS_STAFF,
  username: SEED_BUSINESS_STAFF_USERNAME,
}

/**
 * Lugares semilla con la forma REAL de `BusinessPlaceDetailResult`. El mock
 * guarda siempre el detalle completo y proyecta el resumen en `GET
 * /business/places`, igual que el backend: la lista devuelve 7 campos y el
 * detalle 12.
 */
export const SEED_PLACES: BusinessPlaceDetail[] = [
  {
    placeId: '00000000-0000-0000-0000-000000000010',
    name: 'Café de la 70 — Sede Laureles',
    description: 'Café de especialidad con tostión propia, en el corazón de Laureles.',
    category: Category.Gastronomia,
    subcategory: Subcategory.Cafe,
    latitude: 6.2447,
    longitude: -75.5916,
    checkInRadiusMeters: 100,
    xpReward: 60,
    geoPointsReward: 60,
    status: 'Active',
    photos: ['https://picsum.photos/seed/cafe70-1/400/300'],
  },
  // Segundo lugar en `Draft` y sin fotos (#29): el badge de estado solo
  // prueba algo si hay más de un estado sembrado, y un borrador sin fotos
  // es el caso que el backend declara legítimo — publicar sin fotos
  // devuelve 409 `Place.ActiveRequiresAtLeastOnePhoto`, pero crear no.
  {
    placeId: '00000000-0000-0000-0000-000000000011',
    name: 'Café de la 70 — Sede Envigado',
    description: 'Segunda sede, todavía sin fotos cargadas.',
    category: Category.Gastronomia,
    subcategory: Subcategory.Cafe,
    latitude: 6.1667,
    longitude: -75.5833,
    checkInRadiusMeters: 150,
    xpReward: 50,
    geoPointsReward: 50,
    status: 'Draft',
    photos: [],
  },
]

export const SEED_REWARDS: Reward[] = [
  {
    id: '00000000-0000-0000-0000-000000000020',
    businessId: SEED_BUSINESS.id,
    placeId: SEED_PLACES[0].placeId,
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
    ownTerms: null,
    status: 'Active',
  },
]
