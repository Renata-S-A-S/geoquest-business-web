import { apiClient } from '@/shared/lib/api-client'
import {
  businessRewardSummarySchema,
  type BusinessRewardSummary,
  type UpdateBusinessRewardInput,
} from '@/shared/schemas/business-reward'

/**
 * `PUT /portal/businesses/{businessId}/rewards/{rewardId}` — issue #110.
 *
 * ✅ Ruta REAL, verificada en `Api/PortalRewardsEndpoints.cs:30` contra
 * backend `main` @ `ea471f4`. Devuelve el `PortalRewardResult` actualizado
 * (200), no un 204, así que la respuesta sirve para sembrar la cache.
 *
 * ⚠️⚠️ **REEMPLAZO TOTAL: `null` BORRA.** Ver el JSDoc de
 * `updateBusinessRewardInputSchema`. El tipo del parámetro es el input
 * COMPLETO justamente para que el compilador no deje mandar un objeto
 * parcial: omitir `placeId` acá desvincula el lugar en el servidor.
 *
 * ⚠️ El `input` incluye `menuItemId` aunque el portal nunca lo ofrezca. Es
 * obligatorio precisamente por el reemplazo total: mandarlo ausente lo
 * borraría. El formulario lo reenvía tal como vino del detalle.
 */
export async function updateReward(
  businessId: string,
  rewardId: string,
  input: UpdateBusinessRewardInput
): Promise<BusinessRewardSummary> {
  const { data } = await apiClient.put(
    `/portal/businesses/${businessId}/rewards/${rewardId}`,
    input
  )
  return businessRewardSummarySchema.parse(data)
}
