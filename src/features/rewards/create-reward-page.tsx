import { useSearchParams } from 'react-router-dom'
import { RewardForm } from '@/features/rewards/reward-form'

/**
 * B-03 — Alta de recompensa (#38, #40, #41). Reemplaza el
 * `RoutePlaceholder` de `/recompensas/nueva` que registró #36.
 *
 * Lee `?lugar=` para preseleccionar el lugar asociado. Eso permite entrar
 * desde el detalle de un lugar con el campo ya resuelto, sin acoplar el
 * formulario a la navegación: si el parámetro no viene, la recompensa
 * arranca válida en todos los lugares.
 */
export function CreateRewardPage() {
  const [searchParams] = useSearchParams()

  return <RewardForm defaultPlaceId={searchParams.get('lugar') ?? undefined} />
}
