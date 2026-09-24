import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { useBusinessMe, useBusinessStaffMe } from '@/features/business/queries'
import { canEditBusinessProfile } from '@/features/business/can-edit-business-profile'
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
 * El link de edición (`/negocio/editar`, PR5) llega en esta PR: compone
 * `useBusinessStaffMe()` además de `useBusinessMe()` y deriva `canEdit` con
 * `canEditBusinessProfile` (D4). La lectura del rol NO bloquea la lectura
 * del negocio — son fallas independientes (mismo criterio que el fork de
 * `BusinessProfileEditPage`): si `staffQuery` está pendiente o en error,
 * `canEdit` cae a `false` (fail-safe, nunca fail-open) y la pantalla igual
 * muestra los datos del negocio que sí se pudieron leer.
 */
export function BusinessProfilePage() {
  const { t } = useTranslation('business')
  const businessQuery = useBusinessMe()
  const staffQuery = useBusinessStaffMe()

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

  const canEdit = staffQuery.data ? canEditBusinessProfile(staffQuery.data.role) : false

  return <BusinessProfileView business={businessQuery.data} canEdit={canEdit} />
}
