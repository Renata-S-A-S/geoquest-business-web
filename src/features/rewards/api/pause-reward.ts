import { apiClient } from '@/shared/lib/api-client'

/**
 * `POST /portal/businesses/{businessId}/rewards/{rewardId}/pause` — issue #111.
 *
 * ✅ Ruta REAL, verificada en `Api/PortalRewardsEndpoints.cs:31` contra backend
 * `main` @ `ea471f4`.
 *
 * **Responde 204 SIN BODY.** No devuelve la recompensa, así que no hay nada
 * que parsear ni con qué sembrar la cache: después de la acción hay que
 * invalidar y releer. De ahí el `Promise<void>`: devolver algo acá sería
 * inventarlo.
 *
 * Transiciones (`Reward.cs:268-282`): `Published` o `Exhausted` → `Paused`.
 * - 409 `Reward.AlreadyPaused` si ya está pausada.
 * - 409 `Reward.InvalidStatusTransition` desde `Draft` o `Archived`.
 * - 403 `RewardPortal.BusinessNotActive` si el negocio no está `Active`
 *   (`requireActive: true` en toda escritura).
 */
export async function pauseReward(businessId: string, rewardId: string): Promise<void> {
  await apiClient.post(`/portal/businesses/${businessId}/rewards/${rewardId}/pause`)
}
