import { apiClient } from '@/shared/lib/api-client'
import type { ScanRedemptionInput } from '@/shared/schemas/business-redemption'

/**
 * `POST /portal/businesses/{businessId}/redemptions/scan` — paso 2 de B-04
 * (#46). Verificado contra `RedemptionEndpoints.cs` en `main`@e0f0e9a
 * (PR #210, redemption-scan-by-token): el body es **solo** `{ qrToken }` —
 * `userRewardId` ya no es parte del contrato, el token es la única clave de
 * resolución (comparado por hash contra `RedemptionTokenResolution`).
 *
 * Devuelve **204 No Content**, así que no hay nada que parsear y el retorno es
 * `void`. Por eso el estado post-canje (#48) se arma con los datos que ya
 * trajo la previsualización, no con una respuesta del servidor: el issue #48
 * espera un `UserReward` con `status: 'Redeemed'`, `redeemedAt` y
 * `redeemedByStaffId`, y nada de eso llega.
 *
 * El `staffExplorerId` no viaja en el body: el backend lo saca del claim `sub`
 * del token. Si falta o es inválido responde **401** antes de cualquier
 * chequeo de negocio.
 *
 * El 404 (`RedemptionToken.NotFound`) es literal — "no existe ese token" — y
 * ya no está sobrecargado: desde la decision #1473 (token de 256 bits, no
 * enumerable) un token de OTRO negocio devuelve su propio 403
 * (`RedemptionToken.OtherBusiness`) en vez de compartir el 404
 * anti-enumeration que aplicaba a `userRewardId` (amendment #1452, ya no
 * vigente para este flujo).
 */
export async function scanRedemption(
  businessId: string,
  input: ScanRedemptionInput
): Promise<void> {
  await apiClient.post(`/portal/businesses/${businessId}/redemptions/scan`, input)
}
