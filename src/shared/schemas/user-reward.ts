import { z } from 'zod'

/**
 * `UserReward` — instancia de una recompensa ganada/comprada por un
 * explorador. Es lo que B-04 (validar canje) lee y actualiza.
 *
 * `origin`: 'Purchased' | 'Granted' — ADR-045/RN-REW-10 distinguen
 * explícitamente "comprada con saldo" vs "otorgada como premio" (retos,
 * eventos). Una `Granted` NO descuenta `geoPointsCost` al canjear — el
 * portal debe mostrar esta distinción en B-04, no solo el monto.
 *
 * `status`: 'Earned' y 'Redeemed' citados literalmente (nota del ERD:
 * "Redeemed genera exactamente una comisión"; RN-BIZ-04 menciona 'Earned').
 * 'Reserved' y 'Expired' propuestos — la saga de canje reserva GeoPoints
 * antes de confirmar (geoPointsReserved en GamificationProfile) y el QR
 * tiene ventana de 30 min (RN-REW-04), pero ninguno de los dos términos
 * está citado literalmente para UserReward.status — a confirmar con Derek.
 */
export const userRewardOriginSchema = z.enum(['Purchased', 'Granted'])
export const userRewardStatusSchema = z.enum(['Reserved', 'Earned', 'Redeemed', 'Expired'])
export const reportStatusSchema = z.enum(['Pending', 'Confirmed', 'Dismissed']) // propuesto desde RN-REW-09

export const userRewardSchema = z.object({
  id: z.string().uuid(),
  explorerId: z.string().uuid(),
  rewardId: z.string().uuid(),
  status: userRewardStatusSchema,
  origin: userRewardOriginSchema,
  reservationId: z.string().uuid().nullable(),
  geoPointsSpent: z.number().int().nonnegative(), // 0 cuando origin === 'Granted' (RN-REW-10)
  qrCode: z.string().nullable(),
  qrToken: z.string().nullable(), // firmado server-side (RN-REW-04) — el portal nunca lo genera, solo lo valida
  qrExpiresAt: z.string().datetime().nullable(), // ventana de 30 min desde la generación (RN-REW-04)
  earnedAt: z.string().datetime(),
  redeemedAt: z.string().datetime().nullable(),
  redeemedByStaffId: z.string().uuid().nullable(), // RN-REW-06: solo BusinessStaff del negocio dueño puede validar
  experienceRating: z.number().int().min(1).max(5).nullable(), // RN-REW-07: opcional, incentivado
  rewardHonored: z.boolean(),
  isReported: z.boolean(),
  reportReason: z.string().nullable(),
  reportStatus: reportStatusSchema.nullable(),
  adminNote: z.string().nullable(),
})
export type UserReward = z.infer<typeof userRewardSchema>

/** Payload de B-04: staff confirma canje escaneando/ingresando el QR. */
export const redeemUserRewardInputSchema = z.object({
  qrToken: z.string().min(1),
})
export type RedeemUserRewardInput = z.infer<typeof redeemUserRewardInputSchema>
