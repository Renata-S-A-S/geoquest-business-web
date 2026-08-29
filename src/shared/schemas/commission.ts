import { z } from 'zod'

/**
 * `Commission` — generada automáticamente al pasar una UserReward a
 * Redeemed (nota del ERD). Durante el MVP (plan Free de negocios) su
 * status es 'Waived' según el mismo ERD — ADR-016 difiere la monetización.
 *
 * ⚠️ Pregunta abierta para Derek (ver contratos-portal-b2b.md): ¿el portal
 * expone esta pantalla durante el MVP si el status siempre es Waived? RN-
 * BIZ-06 define comisión 5-10%, pero no hay nada que mostrar hasta v1
 * post-MVP. Este schema existe para no bloquear si la respuesta es "sí,
 * mostrarla igual, en modo informativo".
 */
export const commissionStatusSchema = z.enum(['Waived', 'Pending', 'Settled']) // solo 'Waived' confirmado (ERD, nota MVP)

export const commissionSchema = z.object({
  id: z.string().uuid(),
  userRewardId: z.string().uuid(),
  businessId: z.string().uuid(),
  rewardId: z.string().uuid(),
  rewardEstimatedValue: z.number().nonnegative(),
  commissionRate: z.number().min(0).max(1), // RN-BIZ-06: 5%–10%, definida en el Acuerdo Comercial según plan
  commissionAmount: z.number().nonnegative(),
  status: commissionStatusSchema,
  billingPeriod: z.string(), // shape sin confirmar (¿'2026-09'? ¿ISO week?) — a confirmar con Derek
  createdAt: z.string().datetime(),
  settledAt: z.string().datetime().nullable(),
})
export type Commission = z.infer<typeof commissionSchema>
