import { z } from 'zod'

/**
 * `Reward` — ERD + flujo B-03 (🏢 Flujos del Negocio) + RN-REW.
 *
 * `type`: los 4 valores están citados literalmente en el flujo B-03 paso 2
 * ("Descuento / Producto Gratis / Experiencia / Upgrade") — traducidos a
 * PascalCase inglés siguiendo la convención observada en el resto del
 * backend (TouristSite, BusinessVenue, Suspended...), pero SIN confirmar
 * contra código fuente real — Derek valida los nombres exactos.
 *
 * `rewardCategory`: 'General' | 'Special' están citados literalmente en
 * RN-REW-03/03B.
 */
export const rewardTypeSchema = z.enum(['Discount', 'FreeProduct', 'Experience', 'Upgrade'])
export const rewardCategorySchema = z.enum(['General', 'Special'])

export const rewardSchema = z
  .object({
    id: z.string().uuid(),
    businessId: z.string().uuid(),
    placeId: z.string().uuid(),
    title: z.string(),
    type: rewardTypeSchema,
    rewardCategory: rewardCategorySchema,
    geoPointsCost: z.number().int().nonnegative(), // RN-REW-03: única condición de pago siempre obligatoria
    minLevelRequired: z.string().nullable(), // RN-REW-03B: elegibilidad opcional
    linkedTouristPlaceId: z.string().uuid().nullable(), // solo aplica si rewardCategory === 'Special'
    linkedPlaceWindowDays: z.number().int().positive().nullable(),
    stock: z.number().int().nonnegative().nullable(), // RN-REW-05: null = ilimitado (no confirmado, propuesta razonable)
    stockRedeemed: z.number().int().nonnegative(),
    estimatedValueCop: z.number().nonnegative(),
    validFrom: z.string().datetime().nullable(),
    validUntil: z.string().datetime().nullable(),
    ownTerms: z.string().nullable(), // B-03 paso 6: T&C propios opcionales del negocio — no citado literal en Confluence, agregado 1 sep 2026 (gap detectado durante el desglose de tareas de la épica #13)
    // 'Exhausted' citado literalmente (RN-REW-05). 'Paused' citado (RN-BIZ-04,
    // cascada de negocio suspendido). 'Draft'/'Active' propuestos desde B-03
    // ("publica la recompensa" implica un estado previo no publicado).
    status: z.enum(['Draft', 'Active', 'Paused', 'Exhausted']),
  })
  .refine((r) => r.rewardCategory !== 'Special' || r.linkedTouristPlaceId !== null, {
    message: 'Una recompensa Special requiere linkedTouristPlaceId (RN-REW-03B)',
    path: ['linkedTouristPlaceId'],
  })
export type Reward = z.infer<typeof rewardSchema>

/** Input del formulario B-03 (crear recompensa). */
export const createRewardInputSchema = z.object({
  placeId: z.string().uuid(),
  title: z.string().min(1),
  type: rewardTypeSchema,
  rewardCategory: rewardCategorySchema,
  geoPointsCost: z.number().int().positive(),
  minLevelRequired: z.string().nullable(),
  linkedTouristPlaceId: z.string().uuid().nullable(),
  linkedPlaceWindowDays: z.number().int().positive().nullable(),
  stock: z.number().int().positive().nullable(),
  validFrom: z.string().datetime().nullable(),
  validUntil: z.string().datetime().nullable(),
  ownTerms: z.string().nullable(),
})
export type CreateRewardInput = z.infer<typeof createRewardInputSchema>
