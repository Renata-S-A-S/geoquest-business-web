import { apiClient } from '@/shared/lib/api-client'
import {
  businessRewardSummarySchema,
  type BusinessRewardSummary,
} from '@/shared/schemas/business-reward'

/**
 * `GET /portal/businesses/{businessId}/rewards/{rewardId}` — issue #109.
 *
 * ✅ Ruta REAL, verificada en `Api/PortalRewardsEndpoints.cs:28` contra
 * backend `main` @ `ea471f4`.
 *
 * **Reusa `businessRewardSummarySchema` a propósito.** El detalle y el
 * listado devuelven el MISMO DTO (`PortalRewardResult`): no existe un
 * `PortalRewardDetailResult` aparte. Declarar un segundo schema idéntico solo
 * abriría la puerta a que los dos se desincronicen, así que el "detalle" es
 * un alias de tipo y no una forma nueva.
 *
 * Por eso el detalle **no** muestra nada que el listado no tenga: en
 * particular no hay fechas, porque `Reward` no tiene `CreatedAtUtc` ni
 * `UpdatedAtUtc` (confirmado leyendo la clase completa; `Reward.cs:346-348`
 * lo dice explícitamente). Una pantalla de detalle que dijera "creada el…"
 * estaría inventando el dato.
 *
 * `requireActive: false` en el backend para las lecturas, así que un negocio
 * suspendido puede abrir el detalle aunque no pueda editarlo.
 */
export async function getReward(
  businessId: string,
  rewardId: string
): Promise<BusinessRewardSummary> {
  const { data } = await apiClient.get(`/portal/businesses/${businessId}/rewards/${rewardId}`)
  return businessRewardSummarySchema.parse(data)
}
