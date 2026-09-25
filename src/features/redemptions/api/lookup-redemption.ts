import { apiClient } from '@/shared/lib/api-client'
import {
  redemptionPreviewSchema,
  type RedemptionPreview,
} from '@/shared/schemas/business-redemption'

/**
 * `POST /portal/businesses/{businessId}/redemptions/lookup` — paso 1 de B-04
 * (#44, #45). Verificado contra `RedemptionEndpoints.cs` en `main`@e0f0e9a
 * (PR #210, redemption-scan-by-token): preview de solo lectura, nunca muta el
 * `UserReward`.
 *
 * Body `{ qrToken }`, igual que el escaneo — no hay `userRewardId` en ningún
 * lado del contrato, porque el QR solo trae el token
 * (`GeoQuestFront`, `src/features/rewards/qr-code-panel.tsx`,
 * `value={qrToken}`) y no hay forma de derivar el id.
 *
 * Nunca devuelve 409/410: un token ya canjeado o vencido igual responde 200
 * con `isRedeemable: false` y `status` explicando por qué (spec "Successful
 * preview"). Los únicos errores son 404 `RedemptionToken.NotFound` y los tres
 * 403 (`RewardPortal.NotBusinessOwner`, `RewardPortal.BusinessNotActive`,
 * `RedemptionToken.OtherBusiness`).
 */
export async function lookupRedemption(
  businessId: string,
  qrToken: string
): Promise<RedemptionPreview> {
  const { data } = await apiClient.post(`/portal/businesses/${businessId}/redemptions/lookup`, {
    qrToken,
  })
  return redemptionPreviewSchema.parse(data)
}
