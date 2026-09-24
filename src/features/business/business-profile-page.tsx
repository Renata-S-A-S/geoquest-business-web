import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { useBusinessMe } from '@/features/business/queries'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { BusinessProfileView } from '@/features/business/business-profile-view'

/**
 * Container — `/negocio` (issue #72, PR2). Compone `useBusinessMe()` (ya
 * existente desde la PR1) y bifurca pending/error/success, el mismo punto
 * portable que ya usa `pending-page.tsx`: el fork vive acá, no en
 * `BusinessProfileView`, que solo recibe datos ya resueltos.
 *
 * El bloque de error sigue el criterio que YA usa este repo en
 * `pending-page.tsx` (alerta inline `role="alert"` vía
 * `getProblemDetailsMessage` + botón de reintento) en vez de copiar el
 * patrón del Explorer (degradación parcial de una sección): acá no hay una
 * segunda query independiente que pueda fallar por separado, así que un
 * fork binario alcanza.
 *
 * A propósito NO hay ningún link ni botón de edición en esta pantalla
 * todavía: `/negocio/editar` (PR5) y el gate de Owner que decide si el
 * link aparece (PR4, `GET /business-staff/me`) no existen en esta PR.
 */
export function BusinessProfilePage() {
  const { t } = useTranslation('business')
  const businessQuery = useBusinessMe()

  if (businessQuery.isPending) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-4">
        <p role="status">{t('profile.loading')}</p>
      </div>
    )
  }

  if (businessQuery.isError) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
        <p role="alert" className="font-sans text-xs text-alert">
          {getProblemDetailsMessage(businessQuery.error, t('profile.errors.generic'))}
        </p>
        <Button variant="primary" onClick={() => businessQuery.refetch()}>
          {t('profile.retry')}
        </Button>
      </div>
    )
  }

  return <BusinessProfileView business={businessQuery.data} />
}
