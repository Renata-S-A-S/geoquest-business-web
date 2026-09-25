import axios from 'axios'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { useReward } from '@/features/rewards/queries'
import { useMyBusiness } from '@/features/business/queries'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { RewardEditForm } from '@/features/rewards/reward-edit-form'
import { canEditReward } from '@/shared/schemas/business-reward'

/**
 * Contenedor de la edición de recompensa (#110).
 *
 * Cuatro ramas, mismo reparto que `BusinessProfileEditPage` (#72): negocio
 * fallido, cargando, estado que no permite editar, y formulario.
 *
 * La tercera es la interesante: cuando el estado no permite editar, se explica
 * el motivo y se ofrece volver al detalle, en vez de montar un formulario que
 * se puede llenar entero y falla recién al enviar con un 409
 * `Reward.NotEditable`. Mismo criterio que `PublishPlaceAction`: explicar la
 * precondición, no un control mudo.
 *
 * `canEditReward` replica el guard del servidor EXACTO (`Reward.cs:205`:
 * `Published`, `Exhausted` o `Paused`), no una versión más estricta —
 * `canPublishPlace` ya tuvo ese bug y escondía una acción válida.
 */
export function RewardEditPage() {
  const { t } = useTranslation('rewards')
  const { rewardId } = useParams<{ rewardId: string }>()
  const businessQuery = useMyBusiness()
  const rewardQuery = useReward(businessQuery.data?.businessId, rewardId)

  if (businessQuery.isPending) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-4">
        <p role="status">{t('editForm.loading')}</p>
      </div>
    )
  }

  /**
   * `data === null` (`/business/mine` devolvió `[]`, sin negocio propio)
   * colapsa en la misma rama que un error de red: sin `businessId`,
   * `rewardQuery` quedaría `enabled: false` para siempre (spinner eterno).
   */
  if (businessQuery.isError || businessQuery.data === null) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
        <p role="alert" className="font-sans text-xs text-alert">
          {t('editForm.errors.business')}
        </p>
        <Button variant="primary" onClick={() => businessQuery.refetch()}>
          {t('editForm.retry')}
        </Button>
      </div>
    )
  }

  if (rewardQuery.isPending) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-4">
        <p role="status">{t('editForm.loading')}</p>
      </div>
    )
  }

  if (rewardQuery.isError) {
    const status = axios.isAxiosError(rewardQuery.error)
      ? rewardQuery.error.response?.status
      : undefined
    const isNotFoundOrForbidden = status === 404 || status === 403

    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
        <p role="alert" className="font-sans text-xs text-alert">
          {isNotFoundOrForbidden
            ? t('detail.errors.notFound')
            : getProblemDetailsMessage(rewardQuery.error, t('editForm.errors.generic'))}
        </p>
        {!isNotFoundOrForbidden && (
          <Button variant="primary" onClick={() => rewardQuery.refetch()}>
            {t('editForm.retry')}
          </Button>
        )}
      </div>
    )
  }

  const reward = rewardQuery.data

  if (!canEditReward(reward)) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="font-display text-lg font-bold text-ink">{t('editForm.title')}</h1>
        <Card className="flex flex-col gap-2">
          <p role="alert" className="font-sans text-sm text-ink">
            {t('editForm.notEditableByStatus', { status: t(`list.status.${reward.status}`) })}
          </p>
          <p className="font-sans text-xs text-muted">{t('editForm.notEditableHint')}</p>
          <Link
            to={`/recompensas/${reward.rewardId}`}
            className="font-sans text-xs font-bold text-teal hover:underline"
          >
            {t('editForm.backToDetail')}
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <RewardEditForm
      businessId={businessQuery.data.businessId}
      reward={reward}
      onReload={() => void rewardQuery.refetch()}
    />
  )
}
