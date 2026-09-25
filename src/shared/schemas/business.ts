import { z } from 'zod'

/**
 * `Business` — derivado del ERD (🗺️ Modelo de Datos, Confluence, act. 28
 * ago 2026) + RN-BIZ. El backend de Business no existe todavía (slice
 * 004-business-rewards, arranca 29 ago 2026): este schema es una PROPUESTA
 * de contrato, no una confirmación contra código fuente (a diferencia de
 * los schemas de auth de geoquest-web, que sí pudieron confirmarse así).
 * Ver contratos-portal-b2b.md para lo que Derek tiene que validar/corregir.
 *
 * `status`: solo "Suspended" está citado textualmente en Confluence
 * (RN-BIZ-04, cascada de desactivación). "Pending" y "Active" son
 * propuesta del frontend a partir del flujo B-01 (verificación con SLA de
 * 48h implica un estado previo a Active) — sin confirmar contra el backend.
 */
export const businessStatusSchema = z.enum(['Pending', 'Active', 'Suspended'])

/** NIT | RUT | RFC | RUC según país (RN-BIZ-01) — único subcampo de Business con valores citados literalmente. */
export const legalDocumentTypeSchema = z.enum(['NIT', 'RUT', 'RFC', 'RUC'])
export type LegalDocumentType = z.infer<typeof legalDocumentTypeSchema>

export const businessSchema = z.object({
  id: z.string().uuid(),
  legalName: z.string(),
  displayName: z.string(),
  email: z.string().email(),
  category: z.string(),
  status: businessStatusSchema,
  legalDocumentType: z.string(), // ver legalDocumentTypeSchema — acá queda z.string() para no romper lecturas si el backend agrega un valor nuevo
  legalDocumentNumber: z.string(),
  googleMapsPlaceId: z.string().nullable(),
  isGoogleMapsVerified: z.boolean(),
  isInformalBusiness: z.boolean(),
  trustScore: z.number(), // RN-REW-08: promedio ponderado de experienceRating, ventana 90 días
  trustStatus: z.enum(['Premium', 'Active', 'UnderReview', 'Suspended']), // umbrales exactos en RN-REW-08
  totalRedemptions: z.number().int().nonnegative(),
  totalReports: z.number().int().nonnegative(),
  isPlatformOwned: z.boolean(), // true solo para el negocio semilla "GeoQuest Oficial" (ADR-025) — nunca en el portal
  commercialAgreementSignedAt: z.string().datetime().nullable(), // RN-BIZ-03: checkbox + timestamp
  createdAt: z.string().datetime(),
})
export type Business = z.infer<typeof businessSchema>

/**
 * Input del formulario B-01 (registro de negocio) — issue #21. `POST
 * /business/register`, contratos-portal-b2b.md §2.1. A diferencia de
 * `businessSchema` (schema de lectura, sin constraints de validación), acá
 * sí se exige contenido real (`.min(1)`) porque este schema maneja
 * directamente los mensajes de error del formulario — mismo criterio que
 * `createPlaceInputSchema` en `place.ts`.
 */
export const registerBusinessInputSchema = z.object({
  legalName: z.string().min(1),
  displayName: z.string().min(1),
  email: z.string().min(1).email(),
  category: z.string().min(1), // vía Select (#18) — ver business-category-options.ts, lista sin confirmar
  legalDocumentType: legalDocumentTypeSchema,
  legalDocumentNumber: z.string().min(1),
  // RN-BIZ-03: aceptación obligatoria del acuerdo comercial — input-only,
  // el backend/mock nunca persiste este campo tal cual (ver handlers.ts,
  // que lo destructura antes de guardar `commercialAgreementSignedAt`).
  commercialAgreementAccepted: z.boolean().refine((value) => value === true),
  // Issue #24: aceptación obligatoria de los Términos y
  // Condiciones — igual que el acuerdo comercial, input-only. Es un gate
  // de envío puro: no se persiste ni genera timestamp (ver handlers.ts,
  // que también lo destructura antes de guardar `Business`).
  termsAccepted: z.boolean().refine((value) => value === true),
})
export type RegisterBusinessInput = z.infer<typeof registerBusinessInputSchema>

/**
 * Nota histórica (#72 PR4, borrado de código muerto): este archivo tenía
 * `updateBusinessMeInputSchema`/`BUSINESS_READONLY_FIELDS` (contrato de
 * `PATCH /business/me`) y `businessStaffMeSchema`/`BusinessStaffMe`
 * (contrato de `GET /business-staff/me`). Ninguno de los dos endpoints
 * existe en el backend real y sus únicos consumidores
 * (`business-profile-form.tsx`, `business-profile-edit-page.tsx`,
 * `can-edit-business-profile.ts`, `get-business-staff-me.ts`,
 * `patch-business-me.ts`) se borraron en la misma PR — ver design-amendments
 * (engram #1550) y decisions (#1546): la identidad ahora viene del JWT
 * (`shared/lib/jwt-claims.ts`), no de este endpoint.
 *
 * `businessStaffRoleSchema`/`businessStaffSchema`/`BusinessStaff` SÍ se
 * conservan: `SEED_BUSINESS_STAFF` (`shared/mocks/seed.ts`) sigue tipado con
 * ellos para minar el JWT del mock login (`sub`/`email`, ver
 * `shared/mocks/mock-jwt.ts`), aunque `role` ya no tiene ningún lector
 * (`canEditBusinessProfile` se borró junto con el gate de edición).
 */
export const businessStaffRoleSchema = z.enum(['Owner', 'Manager', 'Staff'])
export type BusinessStaffRole = z.infer<typeof businessStaffRoleSchema>

/**
 * `BusinessStaff` — el usuario real que opera el portal. `role` usa
 * `businessStaffRoleSchema`: el ERD no enumeraba los valores, pero el
 * enum del backend sí los define (`BusinessStaffRole.cs`: `Owner = 0,
 * Manager = 1, Staff = 2`), así que no corresponde dejarlo como `string`
 * "para no inventar valores" — los valores no son una invención del
 * frontend.
 */
export const businessStaffSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  fullName: z.string(),
  email: z.string().email(),
  role: businessStaffRoleSchema,
  status: z.string(), // sin valores confirmados — no se propone enum sin fuente
  createdAt: z.string().datetime(),
})
export type BusinessStaff = z.infer<typeof businessStaffSchema>

/**
 * `MyBusiness` — mirror CONFIRMADO de `MyBusinessResult`
 * (`GeoQuest.Modules.Business/Contracts/MyBusinessResult.cs`, origin/main),
 * contrato real de `GET /business/mine` (real-backend-readiness PR6a, spec
 * #1547 dominio `business-identity-status`). A diferencia de `businessSchema`
 * (propuesta sin confirmar de #21, con `id`/`displayName`/`email`/`category`
 * y solo 3 estados), este schema es 1:1 con el DTO real: nombres de campo
 * `businessId`/`name`, y NO declara `email`/`category`/valores legales — el
 * backend no los manda acá. Coexiste con `businessSchema` durante el
 * expand/contract de PR6a-6c; PR6c retira el schema legacy y sus
 * consumidores migran a este (PR6b).
 */
export const myBusinessStatusSchema = z.enum([
  'Active',
  'Paused',
  'Suspended',
  'PendingVerification',
  'Rejected',
])
export type MyBusinessStatus = z.infer<typeof myBusinessStatusSchema>

export const myBusinessSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string(),
  status: myBusinessStatusSchema,
  // Nullable, no opcional: el backend serializa `null` explícito para estos
  // tres campos (tipos nullable de C#), nunca omite la clave.
  rejectionReason: z.string().nullable(),
  rejectedAtUtc: z.string().datetime().nullable(),
  hasLegalDocument: z.boolean(),
  legalDocumentWaived: z.boolean(),
  logoUrl: z.string().nullable(),
  hasVerificationVideo: z.boolean(),
})
export type MyBusiness = z.infer<typeof myBusinessSchema>
