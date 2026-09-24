import axios from 'axios'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { usePlace } from '@/features/places/queries'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { PlaceDetailView } from '@/features/places/place-detail-view'

/**
 * B-02 — Detalle de un lugar (#35). Contenedor: el fork
 * pendiente/error/éxito vive acá y `PlaceDetailView` recibe el lugar ya
 * resuelto, mismo reparto que el resto del repo.
 *
 * El 404 merece su propio mensaje. El backend devuelve el mismo
 * `GetBusinessPlaceByIdQuery.NotFound` tanto para un id inexistente como
 * para uno de otro negocio (403 aparte), y "ese lugar no existe o no es de
 * tu negocio" es más útil que un genérico: le dice al dueño que revise el
 * enlace en vez de reintentar.
 */
export function PlaceDetailPage() {
  const { t } = useTranslation('places')
  const { placeId } = useParams<{ placeId: string }>()
  const placeQuery = usePlace(placeId)

  if (placeQuery.isPending) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-4">
        <p role="status">{t('detail.loading')}</p>
      </div>
    )
  }

  if (placeQuery.isError) {
    const isNotFound =
      axios.isAxiosError(placeQuery.error) &&
      (placeQuery.error.response?.status === 404 || placeQuery.error.response?.status === 403)

    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
        <p role="alert" className="font-sans text-xs text-alert">
          {isNotFound
            ? t('detail.errors.notFound')
            : getProblemDetailsMessage(placeQuery.error, t('detail.errors.generic'))}
        </p>
        {!isNotFound && (
          <Button variant="primary" onClick={() => placeQuery.refetch()}>
            {t('detail.retry')}
          </Button>
        )}
      </div>
    )
  }

  return <PlaceDetailView place={placeQuery.data} />
}
