import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { usePlaces } from '@/features/places/queries'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { PlacesView } from '@/features/places/places-view'

/**
 * B-02 — Listado de lugares del negocio (#29). Reemplaza el
 * `RoutePlaceholder` que ocupaba esta ruta.
 *
 * Contenedor: el fork pendiente/error/éxito vive acá y `PlacesView`
 * recibe solo datos ya resueltos, mismo reparto que
 * `business-profile-page.tsx` (#72).
 *
 * Una lista vacía NO es un caso de error ni se trata acá: un negocio
 * recién registrado legítimamente no tiene lugares, y ese estado lo
 * resuelve `DataTable` con el `emptyState` que arma la vista.
 */
export function PlacesPage() {
  const { t } = useTranslation('places')
  const placesQuery = usePlaces()

  if (placesQuery.isPending) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-4">
        <p role="status">{t('list.loading')}</p>
      </div>
    )
  }

  if (placesQuery.isError) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
        <p role="alert" className="font-sans text-xs text-alert">
          {getProblemDetailsMessage(placesQuery.error, t('list.errors.generic'))}
        </p>
        <Button variant="primary" onClick={() => placesQuery.refetch()}>
          {t('list.retry')}
        </Button>
      </div>
    )
  }

  return <PlacesView places={placesQuery.data} />
}
