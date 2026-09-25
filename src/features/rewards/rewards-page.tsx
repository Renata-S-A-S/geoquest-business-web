import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { useRewards } from '@/features/rewards/queries'
import { useMyBusiness } from '@/features/business/queries'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { RewardsView } from '@/features/rewards/rewards-view'

/**
 * B-03 — Listado de recompensas del negocio (#36). Reemplaza el
 * `RoutePlaceholder` que ocupaba esta ruta.
 *
 * Contenedor: el fork pendiente/error/éxito vive acá y `RewardsView` recibe
 * solo datos ya resueltos, mismo reparto que `PlacesPage` (#29) y
 * `BusinessProfilePage` (#72).
 *
 * Una lista vacía NO es un caso de error: un negocio recién registrado
 * legítimamente no tiene recompensas, y ese estado lo resuelve `DataTable`
 * con el `emptyState` que arma la vista.
 *
 * **Dos queries, no una.** Las rutas de recompensas llevan el `businessId`
 * en el path, así que antes de pedir el listado hay que resolver de qué
 * negocio se trata. El contenedor forkea sobre las dos porque si la lectura
 * del negocio falla, la del listado se queda `enabled: false` y por lo tanto
 * `isPending` para siempre: sin este fork, un `GET /business/me` caído se
 * vería como un spinner eterno en vez de un error con reintento.
 */
export function RewardsPage() {
  const { t } = useTranslation('rewards')
  const businessQuery = useMyBusiness()
  const rewardsQuery = useRewards(businessQuery.data?.businessId)

  /**
   * `data === null` (`/business/mine` devolvió `[]`, sin negocio propio)
   * colapsa en la misma rama que un error de red: sin `businessId`,
   * `rewardsQuery` quedaría `enabled: false` para siempre (spinner eterno).
   * El gate real (`BusinessGateway`, PR7a) la reemplaza por una pantalla
   * dedicada.
   */
  if (businessQuery.isError || businessQuery.data === null) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
        <p role="alert" className="font-sans text-xs text-alert">
          {t('list.errors.business')}
        </p>
        <Button variant="primary" onClick={() => businessQuery.refetch()}>
          {t('list.retry')}
        </Button>
      </div>
    )
  }

  if (rewardsQuery.isPending) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-4">
        <p role="status">{t('list.loading')}</p>
      </div>
    )
  }

  if (rewardsQuery.isError) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
        <p role="alert" className="font-sans text-xs text-alert">
          {getProblemDetailsMessage(rewardsQuery.error, t('list.errors.generic'))}
        </p>
        <Button variant="primary" onClick={() => rewardsQuery.refetch()}>
          {t('list.retry')}
        </Button>
      </div>
    )
  }

  return <RewardsView rewards={rewardsQuery.data} />
}
