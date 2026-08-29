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

export const businessSchema = z.object({
  id: z.string().uuid(),
  legalName: z.string(),
  displayName: z.string(),
  email: z.string().email(),
  category: z.string(),
  status: businessStatusSchema,
  legalDocumentType: z.string(), // NIT | RUT | RFC | RUC según país (RN-BIZ-01)
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
