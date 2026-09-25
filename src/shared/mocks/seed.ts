import type { Business, BusinessStaff, BusinessStaffMe } from '@/shared/schemas/business'
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
 * Canjes semilla para B-04. Tienen la forma del lookup por token (Opción A de
 * `Renata-S-A-S/geoquest#202`) más los campos que el mock necesita para decidir
 * los errores: el token en claro, el negocio dueño y si ya se canjeó.
 *
 * ⚠️ El backend guarda `QrTokenHash` (SHA-256 hex del token), **nunca el token
 * en claro**. El mock guarda el claro porque no tiene con qué hashear de forma
 * equivalente y porque nada de esto es un secreto real. No copiar ese campo a
 * ningún schema de contrato.
 *
 * Cuatro casos sembrados a propósito: los dos `origin` (que es lo que #47
 * necesita demostrar) más los dos estados que hacen fallar un canje — uno ya
 * canjeado y uno vencido. Sin ellos, los dos errores más importantes del flujo
 * no tendrían cómo probarse.
 *
 * Los tokens tienen la forma real (44 caracteres base64 terminados en `=`) y
 * evitan `+` y `/` a propósito, para que los tests no queden atados al bug de
 * encoding de path que documenta `get-redemption-by-qr-token.ts`.
 */
export const SEED_PURCHASED_QR_TOKEN = `Pur${'A'.repeat(40)}=`
export const SEED_PRIZE_QR_TOKEN = `Pri${'B'.repeat(40)}=`
export const SEED_REDEEMED_QR_TOKEN = `Red${'C'.repeat(40)}=`
export const SEED_EXPIRED_QR_TOKEN = `Exp${'D'.repeat(40)}=`

export interface MockUserReward {
  userRewardId: string
  rewardId: string
  rewardTitle: string
  explorerId: string
  origin: 'Purchased' | 'Prize'
  geoPointsCostSnapshot: number
  estimatedValueCopSnapshot: number
  qrExpiresAtUtc: string
  /** Solo del mock — el backend guarda el hash. Ver el comentario de arriba. */
  qrToken: string
  businessId: string
  redeemedAtUtc: string | null
}

/** Fechas fijas y lejanas para que ningún test dependa del reloj. */
const FAR_FUTURE = '2099-01-01T00:00:00Z'
const LONG_PAST = '2020-01-01T00:00:00Z'

export const SEED_USER_REWARDS: MockUserReward[] = [
  {
    userRewardId: '00000000-0000-0000-0000-000000000030',
    rewardId: SEED_REWARDS[0].rewardId,
    rewardTitle: SEED_REWARDS[0].title,
    explorerId: '00000000-0000-0000-0000-0000000000a1',
    origin: 'Purchased',
    geoPointsCostSnapshot: 100,
    estimatedValueCopSnapshot: 15000,
    qrExpiresAtUtc: FAR_FUTURE,
    qrToken: SEED_PURCHASED_QR_TOKEN,
    businessId: SEED_BUSINESS.id,
    redeemedAtUtc: null,
  },
  // `Prize` con costo 0 — RN-REW-10: no descontó saldo. Es el caso que #47
  // necesita para que el staff no lea ese 0 como un dato roto.
  {
    userRewardId: '00000000-0000-0000-0000-000000000031',
    rewardId: SEED_REWARDS[1].rewardId,
    rewardTitle: SEED_REWARDS[1].title,
    explorerId: '00000000-0000-0000-0000-0000000000a2',
    origin: 'Prize',
    geoPointsCostSnapshot: 0,
    estimatedValueCopSnapshot: 12000,
    qrExpiresAtUtc: FAR_FUTURE,
    qrToken: SEED_PRIZE_QR_TOKEN,
    businessId: SEED_BUSINESS.id,
    redeemedAtUtc: null,
  },
  // Ya canjeado: reintentarlo devuelve 409 `UserReward.InvalidStatusTransition`.
  {
    userRewardId: '00000000-0000-0000-0000-000000000032',
    rewardId: SEED_REWARDS[0].rewardId,
    rewardTitle: SEED_REWARDS[0].title,
    explorerId: '00000000-0000-0000-0000-0000000000a3',
    origin: 'Purchased',
    geoPointsCostSnapshot: 100,
    estimatedValueCopSnapshot: 15000,
    qrExpiresAtUtc: FAR_FUTURE,
    qrToken: SEED_REDEEMED_QR_TOKEN,
    businessId: SEED_BUSINESS.id,
    redeemedAtUtc: '2026-09-01T12:00:00Z',
  },
  // Vencido: 400 `ScanRedemptionQrCommand.QrExpired`, no 409 — ver geoquest#206.
  {
    userRewardId: '00000000-0000-0000-0000-000000000033',
    rewardId: SEED_REWARDS[0].rewardId,
    rewardTitle: SEED_REWARDS[0].title,
    explorerId: '00000000-0000-0000-0000-0000000000a4',
    origin: 'Purchased',
    geoPointsCostSnapshot: 100,
    estimatedValueCopSnapshot: 15000,
    qrExpiresAtUtc: LONG_PAST,
    qrToken: SEED_EXPIRED_QR_TOKEN,
    businessId: SEED_BUSINESS.id,
    redeemedAtUtc: null,
  },
]
