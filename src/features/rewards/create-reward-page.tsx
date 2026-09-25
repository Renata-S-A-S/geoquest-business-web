import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { RewardForm } from '@/features/rewards/reward-form'
import { useMyBusiness } from '@/features/business/queries'

/**
 * Contenedor del alta de recompensa (#38, #40, #41).
 *
 * Resuelve el `businessId` antes de montar el formulario, porque
 * `POST /portal/businesses/{businessId}/rewards` lo lleva en el path. El
 * formulario recibe un `businessId` ya resuelto y nunca un `undefined`: así
 * no tiene que defenderse de un estado que no le corresponde manejar, y no
 * existe la rama «enviar sin saber a qué negocio».
 *
 * El lugar preseleccionado llega por query string (`?lugar=<placeId>`)
 * cuando se entra desde el detalle de un lugar.
 */
export function CreateRewardPage() {
  const { t } = useTranslation('rewards')
  const [searchParams] = useSearchParams()
  const businessQuery = useMyBusiness()

  if (businessQuery.isPending) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-4">
        <p role="status">{t('createForm.loading')}</p>
      </div>
    )
  }

  /**
   * `data === null` (`/business/mine` devolvió `[]`, sin negocio propio)
   * colapsa en la misma rama de error: sin `businessId` no hay path que
   * llamar, así que el formulario tampoco debe montarse.
   */
  if (businessQuery.isError || businessQuery.data === null) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
        {/*
          Copia traducida DIRECTA, no vía el `fallback` de
          `getProblemDetailsMessage`: ese helper resuelve
          `detail ?? title ?? fallback`, así que un `InternalError` crudo del
          backend le ganaría al texto traducido. Y para «no pudimos
          identificar tu negocio» el detalle del servidor no aporta nada que
          un dueño de negocio pueda accionar.
        */}
        <p role="alert" className="font-sans text-xs text-alert">
          {t('createForm.errors.business')}
        </p>
        <Button variant="primary" onClick={() => businessQuery.refetch()}>
          {t('createForm.retry')}
        </Button>
      </div>
    )
  }

  return (
    <RewardForm
      businessId={businessQuery.data.businessId}
      defaultPlaceId={searchParams.get('lugar') ?? undefined}
    />
  )
}
