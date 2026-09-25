import { apiClient } from '@/shared/lib/api-client'

/**
 * `POST /portal/businesses/{businessId}/rewards/{rewardId}/republish` — #111.
 *
 * ✅ Ruta REAL, verificada en `Api/PortalRewardsEndpoints.cs:32` contra backend
 * `main` @ `ea471f4`.
 *
 * **Responde 204 SIN BODY**, igual que `pause`. Y acá la ausencia de body
 * duele más, porque el estado resultante **no es deducible del verbo**:
 *
 * ```csharp
 * Status = StockTotal is not null && StockRemaining <= 0
 *     ? RewardStatus.Exhausted
 *     : RewardStatus.Published;
 * ```
 *
 * Republicar una recompensa sin stock la deja `Exhausted`, no `Published`
 * (`Reward.cs:298`). Como el 204 no lo dice, **hay que releer el detalle para
 * saber cómo quedó**. Ver `republishWillExhaust`, que lo anticipa del lado del
 * cliente con los datos que ya tenemos.
 *
 * Transiciones: solo desde `Paused`. Cualquier otro estado → 409
 * `Reward.NotPaused`.
 */
export async function republishReward(businessId: string, rewardId: string): Promise<void> {
  await apiClient.post(`/portal/businesses/${businessId}/rewards/${rewardId}/republish`)
}
