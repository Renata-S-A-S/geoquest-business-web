import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { useRewards } from '@/features/rewards/queries'
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
 */
export function RewardsPage() {
  const { t } = useTranslation('rewards')
  const rewardsQuery = useRewards()

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
