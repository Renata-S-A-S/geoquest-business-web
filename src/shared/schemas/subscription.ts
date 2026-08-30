import { z } from 'zod'

/**
 * `Subscription` — SOLO LECTURA en este scaffold. Durante el MVP todos los
 * negocios están en plan Free (ADR-016 difiere la monetización a Q1 2027);
 * no se modela ninguna UI de pago ni de upgrade de plan. Este schema existe
 * para que el portal pueda mostrar "Plan: Free" en algún lugar, no más.
 */
export const subscriptionPlanSchema = z.enum(['Free', 'Starter', 'Growth', 'Pro']) // RN-BIZ-05

export const subscriptionSchema = z.object({
  id: z.string().uuid(),
  explorerId: z.string().uuid().nullable(), // exactamente uno de explorerId/businessId tiene valor (nota del ERD)
  businessId: z.string().uuid().nullable(),
  plan: subscriptionPlanSchema,
  status: z.string(), // sin valores confirmados — no se propone enum sin fuente
  currentPeriodStart: z.string().datetime().nullable(),
  currentPeriodEnd: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  paymentMethod: z.string().nullable(),
  lastPaymentAt: z.string().datetime().nullable(),
  lastPaymentAmount: z.number().nonnegative().nullable(),
  nextBillingAt: z.string().datetime().nullable(),
  gracePeriodEndsAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})
export type Subscription = z.infer<typeof subscriptionSchema>
