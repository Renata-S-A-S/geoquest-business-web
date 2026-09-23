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
 * `BusinessStaff` — el usuario real que opera el portal. `role` sin
 * enumerar en el ERD; se deja como `string` a propósito (no inventar
 * valores). La autenticación de BusinessStaff es la pregunta abierta
 * central de este handoff — ver contratos-portal-b2b.md.
 */
export const businessStaffSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  fullName: z.string(),
  email: z.string().email(),
  role: z.string(),
  status: z.string(), // sin valores confirmados — no se propone enum sin fuente
  createdAt: z.string().datetime(),
})
export type BusinessStaff = z.infer<typeof businessStaffSchema>
