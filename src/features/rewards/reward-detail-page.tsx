import axios from 'axios'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { useReward } from '@/features/rewards/queries'
import { useBusinessMe } from '@/features/business/queries'
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
 * - `useBusinessMe()` porque la ruta lleva el `businessId` en el path.
 * - `useReward()` para el detalle en sí.
 * - `usePlaces()` solo para poner el NOMBRE del lugar en vez de su UUID. No
 *   bloquea: si todavía no resolvió, la vista muestra una etiqueta neutra. Un
 *   dato cosmético no puede frenar la pantalla entera, mismo criterio que el
 *   select de lugares en `RewardForm`.
 */
export function RewardDetailPage() {
  const { t } = useTranslation('rewards')
  const { rewardId } = useParams<{ rewardId: string }>()
  const businessQuery = useBusinessMe()
  const rewardQuery = useReward(businessQuery.data?.id, rewardId)
  const placesQuery = usePlaces()

  if (businessQuery.isError) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
        {/*
          Copia traducida DIRECTA, no vía el `fallback` de
          `getProblemDetailsMessage`: ese helper resuelve
          `detail ?? title ?? fallback`, así que un `InternalError` crudo del
          backend le ganaría al texto traducido.
        */}
        <p role="alert" className="font-sans text-xs text-alert">
          {t('detail.errors.business')}
        </p>
        <Button variant="primary" onClick={() => businessQuery.refetch()}>
          {t('detail.retry')}
        </Button>
      </div>
    )
  }

  if (businessQuery.isPending || rewardQuery.isPending) {
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
      actions={<RewardStatusAction businessId={businessQuery.data.id} reward={rewardQuery.data} />}
      imageSlot={<RewardImageUpload businessId={businessQuery.data.id} reward={rewardQuery.data} />}
    />
  )
}
