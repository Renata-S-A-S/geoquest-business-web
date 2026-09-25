import { apiClient } from '@/shared/lib/api-client'
import type { ScanRedemptionInput } from '@/shared/schemas/business-redemption'

/**
 * `POST /portal/businesses/{businessId}/redemptions/scan` — paso 2 de B-04
 * (#46). **Este endpoint SÍ existe**, verificado contra
 * `RedemptionEndpoints.cs` en `main`@fbec604.
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
 * ⚠️ El 404 (`ScanRedemptionQrCommand.RewardNotFound`) está **sobrecargado a
 * propósito**: cubre tanto "no existe ese `UserReward`" como "existe pero es
 * de OTRO negocio", con el mismo código para no permitir enumeración
 * (amendment #1452 del backend, que reemplazó un 403 del draft). Por eso la
 * copia de ese error es vaga a propósito — afirmar "este código no existe"
 * filtraría justo lo que el backend decidió esconder.
 */
export async function scanRedemption(
  businessId: string,
  input: ScanRedemptionInput
): Promise<void> {
  await apiClient.post(`/portal/businesses/${businessId}/redemptions/scan`, input)
}
