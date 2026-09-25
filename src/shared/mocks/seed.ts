import type { Business, BusinessStaff, MyBusiness } from '@/shared/schemas/business'
import type { BusinessPlaceDetail } from '@/shared/schemas/business-place'
import { Category, Subcategory } from '@/shared/schemas/taxonomy'
import type { BusinessRewardSummary } from '@/shared/schemas/business-reward'

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
 * Username semilla usado por el mock login (`POST /auth/login`,
 * `handlers.ts`) para minar un JWT con claims de identidad (#72 PR2, ver
 * `shared/mocks/mock-jwt.ts`). `GET /business-staff/me` (que originaba este
 * username) se borró en #72 PR4: la identidad ahora viene decodificada del
 * JWT, no de un endpoint aparte.
 */
export const SEED_BUSINESS_STAFF_USERNAME = 'maria_cafe70'

/**
 * Escenarios demo de `GET /business/mine` (real-backend-readiness PR6a,
 * design "Mock status demo"): un `MyBusiness` por cada uno de los 5 estados
 * reales del backend, más `none` para el caso "sin negocio propio"
 * (`myBusiness: null` → el handler responde `[]`). Comparten `businessId`
 * con `SEED_BUSINESS.id` a propósito — las semillas de lugares/recompensas
 * ya referencian ese id, y PR6b migra esos consumidores al contrato real
 * sin necesitar otro UUID.
 *
 * `?mockBusiness=` (`shared/mocks/mock-business-param.ts`, leído por
 * `shared/mocks/browser.ts`) y `setMockBusiness()` (`test/mock-business.ts`)
 * son los dos únicos puntos que aplican uno de estos escenarios sobre el
 * mock db — ningún handler debe construir un `MyBusiness` ad hoc.
 */
export const SEED_BUSINESS_SCENARIOS = {
  Active: {
    businessId: SEED_BUSINESS.id,
    name: SEED_BUSINESS.displayName,
    status: 'Active',
    rejectionReason: null,
    rejectedAtUtc: null,
    hasLegalDocument: true,
    legalDocumentWaived: false,
    logoUrl: null,
    hasVerificationVideo: false,
  },
  Paused: {
    businessId: SEED_BUSINESS.id,
    name: SEED_BUSINESS.displayName,
    status: 'Paused',
    rejectionReason: null,
    rejectedAtUtc: null,
    hasLegalDocument: true,
    legalDocumentWaived: false,
    logoUrl: null,
    hasVerificationVideo: false,
  },
  Suspended: {
    businessId: SEED_BUSINESS.id,
    name: SEED_BUSINESS.displayName,
    status: 'Suspended',
    rejectionReason: null,
    rejectedAtUtc: null,
    hasLegalDocument: true,
    legalDocumentWaived: false,
    logoUrl: null,
    hasVerificationVideo: false,
  },
  PendingVerification: {
    businessId: SEED_BUSINESS.id,
    name: SEED_BUSINESS.displayName,
    status: 'PendingVerification',
    rejectionReason: null,
    rejectedAtUtc: null,
    hasLegalDocument: false,
    legalDocumentWaived: false,
    logoUrl: null,
    hasVerificationVideo: false,
  },
  Rejected: {
    businessId: SEED_BUSINESS.id,
    name: SEED_BUSINESS.displayName,
    status: 'Rejected',
    rejectionReason:
      'El documento legal no coincide con el nombre registrado ante cámara de comercio.',
    rejectedAtUtc: '2026-09-01T12:00:00Z',
    hasLegalDocument: true,
    legalDocumentWaived: false,
    logoUrl: null,
    hasVerificationVideo: false,
  },
  none: null,
} as const satisfies Record<MyBusiness['status'] | 'none', MyBusiness | null>

export type MyBusinessScenario = keyof typeof SEED_BUSINESS_SCENARIOS

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
    xpReward: 0,
    geoPointsReward: 12,
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
    xpReward: 0,
    geoPointsReward: 12,
    status: 'Draft',
    photos: [],
  },
]

/**
 * Recompensas semilla con la forma REAL del dominio `Reward`. Dos estados
 * sembrados a propósito: una publicada con imagen y una en borrador sin
 * ella, que es justo el caso que el botón de publicar tiene que bloquear.
 */
export const SEED_REWARDS: BusinessRewardSummary[] = [
  {
    rewardId: '00000000-0000-0000-0000-000000000020',
    businessId: SEED_BUSINESS.id,
    title: '2x1 en café de especialidad',
    description: 'Llevá dos cafés pagando uno, de lunes a jueves.',
    geoPointsCost: 100,
    estimatedValueCop: 15000,
    status: 'Published',
    stockTotal: 50,
    stockRemaining: 42,
    placeId: SEED_PLACES[0].placeId,
    menuItemId: null,
    imageUrl: 'https://picsum.photos/seed/reward-2x1/400/300',
  },
  {
    rewardId: '00000000-0000-0000-0000-000000000021',
    businessId: SEED_BUSINESS.id,
    title: 'Postre gratis con bebida caliente',
    description: 'Un postre de la vitrina llevando cualquier bebida caliente.',
    geoPointsCost: 80,
    estimatedValueCop: 12000,
    status: 'Draft',
    stockTotal: null,
    stockRemaining: null,
    placeId: null,
    menuItemId: null,
    imageUrl: null,
  },
]

/**
 * Canjes semilla para B-04. Tienen la forma real de `RedemptionLookupResult`
 * más los campos que el mock necesita para resolver por token: el token en
 * claro y el negocio dueño.
 *
 * ⚠️ El backend guarda `QrTokenHash` (SHA-256 hex del token), **nunca el token
 * en claro**. El mock guarda el claro porque no tiene con qué hashear de forma
 * equivalente y porque nada de esto es un secreto real. No copiar ese campo a
 * ningún schema de contrato.
 *
 * Seis casos sembrados a propósito: los dos `origin` (#47), un `Redeemed` y un
 * `Expired` (los dos motivos de `isRedeemable: false` más importantes del
 * flujo) y un `PendingReservation`/`Failed` (el tercer motivo, que comparte
 * copy). El `Redeemed` además queda con `qrExpiresAtUtc: null` a propósito,
 * para probar que la previsualización no rompe cuando el backend no manda esa
 * fecha (deja de ser relevante una vez resuelto el canje).
 *
 * Los tokens tienen la forma real (44 caracteres base64 terminados en `=`) y
 * evitan `+` y `/` a propósito, para no depender de encoding de query string
 * en los tests.
 */
export const SEED_PURCHASED_QR_TOKEN = `Pur${'A'.repeat(40)}=`
export const SEED_PRIZE_QR_TOKEN = `Pri${'B'.repeat(40)}=`
export const SEED_REDEEMED_QR_TOKEN = `Red${'C'.repeat(40)}=`
export const SEED_EXPIRED_QR_TOKEN = `Exp${'D'.repeat(40)}=`
export const SEED_PENDING_QR_TOKEN = `Pen${'E'.repeat(40)}=`
export const SEED_FAILED_QR_TOKEN = `Fai${'F'.repeat(40)}=`

export interface MockUserReward {
  userRewardId: string
  rewardId: string
  rewardTitle: string
  rewardDescription: string
  explorerId: string
  /** `null` cuando el `ExplorerRef` todavía no se proyectó (decision #1473). */
  explorerUsername: string | null
  origin: 'Purchased' | 'Prize'
  geoPointsCostSnapshot: number
  qrExpiresAtUtc: string | null
  /** Solo del mock — el backend guarda el hash. Ver el comentario de arriba. */
  qrToken: string
  businessId: string
  /** Estado EFECTIVO — lo que el handler de lookup/scan lee directo, sin derivar de fechas. */
  status: 'Earned' | 'Redeemed' | 'Expired' | 'PendingReservation' | 'Failed'
}

/** Fecha fija y lejana para que ningún test dependa del reloj. */
const FAR_FUTURE = '2099-01-01T00:00:00Z'

export const SEED_USER_REWARDS: MockUserReward[] = [
  {
    userRewardId: '00000000-0000-0000-0000-000000000030',
    rewardId: SEED_REWARDS[0].rewardId,
    rewardTitle: SEED_REWARDS[0].title,
    rewardDescription: SEED_REWARDS[0].description,
    explorerId: '00000000-0000-0000-0000-0000000000a1',
    explorerUsername: 'ana_explorer',
    origin: 'Purchased',
    geoPointsCostSnapshot: 100,
    qrExpiresAtUtc: FAR_FUTURE,
    qrToken: SEED_PURCHASED_QR_TOKEN,
    businessId: SEED_BUSINESS.id,
    status: 'Earned',
  },
  // `Prize` con costo 0 — RN-REW-10: no descontó saldo. Es el caso que #47
  // necesita para que el staff no lea ese 0 como un dato roto. `explorerUsername`
  // nulo a propósito, para probar el fallback al id crudo.
  {
    userRewardId: '00000000-0000-0000-0000-000000000031',
    rewardId: SEED_REWARDS[1].rewardId,
    rewardTitle: SEED_REWARDS[1].title,
    rewardDescription: SEED_REWARDS[1].description,
    explorerId: '00000000-0000-0000-0000-0000000000a2',
    explorerUsername: null,
    origin: 'Prize',
    geoPointsCostSnapshot: 0,
    qrExpiresAtUtc: FAR_FUTURE,
    qrToken: SEED_PRIZE_QR_TOKEN,
    businessId: SEED_BUSINESS.id,
    status: 'Earned',
  },
  // Ya canjeado: lookup devuelve 200 con `isRedeemable: false` (nunca 409/410
  // en el lookup); reintentar el escaneo sí devuelve 409 `RedemptionToken.AlreadyRedeemed`.
  // `qrExpiresAtUtc: null` a propósito — ver comentario de arriba.
  {
    userRewardId: '00000000-0000-0000-0000-000000000032',
    rewardId: SEED_REWARDS[0].rewardId,
    rewardTitle: SEED_REWARDS[0].title,
    rewardDescription: SEED_REWARDS[0].description,
    explorerId: '00000000-0000-0000-0000-0000000000a3',
    explorerUsername: 'redeemed_user',
    origin: 'Purchased',
    geoPointsCostSnapshot: 100,
    qrExpiresAtUtc: null,
    qrToken: SEED_REDEEMED_QR_TOKEN,
    businessId: SEED_BUSINESS.id,
    status: 'Redeemed',
  },
  // Vencido: el lookup lo reporta como `Expired` (degradado desde `Earned`,
  // GR-3), nunca como error — el escaneo sí devuelve 410 `RedemptionToken.Expired`.
  {
    userRewardId: '00000000-0000-0000-0000-000000000033',
    rewardId: SEED_REWARDS[0].rewardId,
    rewardTitle: SEED_REWARDS[0].title,
    rewardDescription: SEED_REWARDS[0].description,
    explorerId: '00000000-0000-0000-0000-0000000000a4',
    explorerUsername: 'expired_user',
    origin: 'Purchased',
    geoPointsCostSnapshot: 100,
    qrExpiresAtUtc: '2020-01-01T00:00:00Z',
    qrToken: SEED_EXPIRED_QR_TOKEN,
    businessId: SEED_BUSINESS.id,
    status: 'Expired',
  },
  // `PendingReservation`: tercer motivo de `isRedeemable: false`, comparte
  // copy con `Failed` (spec: "not redeemable for PendingReservation|Failed").
  {
    userRewardId: '00000000-0000-0000-0000-000000000034',
    rewardId: SEED_REWARDS[0].rewardId,
    rewardTitle: SEED_REWARDS[0].title,
    rewardDescription: SEED_REWARDS[0].description,
    explorerId: '00000000-0000-0000-0000-0000000000a5',
    explorerUsername: 'pending_user',
    origin: 'Purchased',
    geoPointsCostSnapshot: 100,
    qrExpiresAtUtc: FAR_FUTURE,
    qrToken: SEED_PENDING_QR_TOKEN,
    businessId: SEED_BUSINESS.id,
    status: 'PendingReservation',
  },
  {
    userRewardId: '00000000-0000-0000-0000-000000000035',
    rewardId: SEED_REWARDS[0].rewardId,
    rewardTitle: SEED_REWARDS[0].title,
    rewardDescription: SEED_REWARDS[0].description,
    explorerId: '00000000-0000-0000-0000-0000000000a6',
    explorerUsername: 'failed_user',
    origin: 'Purchased',
    geoPointsCostSnapshot: 100,
    qrExpiresAtUtc: FAR_FUTURE,
    qrToken: SEED_FAILED_QR_TOKEN,
    businessId: SEED_BUSINESS.id,
    status: 'Failed',
  },
]
