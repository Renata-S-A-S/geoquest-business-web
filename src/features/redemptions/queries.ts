import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getRedemptionByQrToken } from './api/get-redemption-by-qr-token'
import { scanRedemption } from './api/scan-redemption'
import type { RedemptionPreview } from '@/shared/schemas/business-redemption'

/**
 * Keys de la slice `redemptions` — B-04. Mismo criterio que `placeKeys` y
 * `rewardKeys`: un archivo, una feature, y las keys en un solo lugar para que
 * invalidar no se desincronice de leer.
 */
export const redemptionKeys = {
  history: (businessId: string) => ['redemptions', 'history', businessId] as const,
}

/**
 * Busca el canje por token (#44 → #45).
 *
 * **Es una mutación, no una query, y eso es deliberado.** Un `useQuery` es
 * para datos que se leen, se cachean y se refetchean solos; esto es una acción
 * puntual que el staff dispara al pegar un código. Cachearla sería peor que
 * inútil: el resultado deja de ser válido en 30 minutos (RN-REW-04) y queda
 * obsoleto para siempre en cuanto alguien confirma el canje. Un refetch en
 * background mostrándole al staff una previsualización revivida de un código
 * ya usado es exactamente el error que este flujo no puede permitirse.
 *
 * Tampoco se cachea el token como parte de una key: es un secreto de un solo
 * uso, no un identificador de recurso.
 */
export function useRedemptionLookup(businessId: string | undefined) {
  return useMutation<RedemptionPreview, unknown, string>({
    mutationFn: (qrToken: string) => getRedemptionByQrToken(businessId as string, qrToken),
  })
}

/**
 * Confirma el canje (#46). Nunca optimista: el canje es irreversible y de un
 * solo uso, así que mostrar éxito antes de que el backend lo confirme sería
 * decirle al staff que entregue algo que quizá no se registró.
 *
 * Invalida `['redemptions']` (el historial ya no es el mismo) y la lista de
 * recompensas, porque canjear mueve el `stockRemaining` que muestra B-03.
 */
export function useScanRedemption(businessId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { userRewardId: string; qrToken: string }) =>
      scanRedemption(businessId as string, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['redemptions'] })
      void queryClient.invalidateQueries({ queryKey: ['rewards'] })
    },
  })
}
