import axios from 'axios'
import { useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { useReward } from '@/features/rewards/queries'
import { useMyBusiness } from '@/features/business/queries'
import { usePlaces } from '@/features/places/queries'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { RewardDetailView } from '@/features/rewards/reward-detail-view'
import { RewardStatusAction } from '@/features/rewards/reward-status-action'
import { RewardImageUpload } from '@/features/rewards/reward-image-upload'

/**
 * Contenedor del detalle de recompensa (#109, B-03). Hermano de
 * `PlaceDetailPage` (#35).
 *
 * Tres queries, cada una con su motivo:
 * - `useMyBusiness()` porque la ruta lleva el `businessId` en el path.
 * - `useReward()` para el detalle en sí.
 * - `usePlaces()` solo para poner el NOMBRE del lugar en vez de su UUID. No
 *   bloquea: si todavía no resolvió, la vista muestra una etiqueta neutra. Un
 *   dato cosmético no puede frenar la pantalla entera, mismo criterio que el
 *   select de lugares en `RewardForm`.
 */
export function RewardDetailPage() {
  const { t } = useTranslation('rewards')
  const { rewardId } = useParams<{ rewardId: string }>()
  /**
   * Marca que se llegó acá desde `RewardForm` justo tras publicar (#204).
   * Solo entonces tiene sentido el nudge de imagen: en cualquier otra visita
   * al detalle, una recompensa sin imagen no es una novedad que insistir.
   */
  const location = useLocation()
  const justPublished = Boolean(
    (location.state as { justPublished?: boolean } | null)?.justPublished
  )
  const businessQuery = useMyBusiness()
  const rewardQuery = useReward(businessQuery.data?.businessId, rewardId)
  const placesQuery = usePlaces()

  if (businessQuery.isPending) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-4">
        <p role="status">{t('detail.loading')}</p>
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
          {t('detail.errors.business')}
        </p>
        <Button variant="primary" onClick={() => businessQuery.refetch()}>
          {t('detail.retry')}
        </Button>
      </div>
    )
  }

  if (rewardQuery.isPending) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-4">
        <p role="status">{t('detail.loading')}</p>
      </div>
    )
  }

  if (rewardQuery.isError) {
    /**
     * 404 y 403 colapsan en el mismo mensaje, y es deliberado: el backend
     * devuelve el MISMO 403 `RewardPortal.NotBusinessOwner` para un
     * `businessId` desconocido y para el de otro dueño (anti-enumeración,
     * `PortalAccess.cs:22`). El portal no puede distinguir "no existe" de "no
     * es tuya", así que no debe afirmar ninguna de las dos.
     *
     * Tampoco se ofrece reintentar: ninguno de los dos se arregla repitiendo
     * el mismo request.
     */
    const status = axios.isAxiosError(rewardQuery.error)
      ? rewardQuery.error.response?.status
      : undefined
    const isNotFoundOrForbidden = status === 404 || status === 403

    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
        <p role="alert" className="font-sans text-xs text-alert">
          {isNotFoundOrForbidden
            ? t('detail.errors.notFound')
            : getProblemDetailsMessage(rewardQuery.error, t('detail.errors.generic'))}
        </p>
        {!isNotFoundOrForbidden && (
          <Button variant="primary" onClick={() => rewardQuery.refetch()}>
            {t('detail.retry')}
          </Button>
        )}
      </div>
    )
  }

  const placeName = (placesQuery.data ?? []).find(
    (place) => place.placeId === rewardQuery.data.placeId
  )?.name

  return (
    <RewardDetailView
      reward={rewardQuery.data}
      placeName={placeName}
      justPublished={justPublished}
      actions={
        <RewardStatusAction businessId={businessQuery.data.businessId} reward={rewardQuery.data} />
      }
      imageSlot={
        <RewardImageUpload businessId={businessQuery.data.businessId} reward={rewardQuery.data} />
      }
    />
  )
}
