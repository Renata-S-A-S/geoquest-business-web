import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { useBusinessMe, useBusinessStaffMe } from '@/features/business/queries'
import { canEditBusinessProfile } from '@/features/business/can-edit-business-profile'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { BusinessProfileForm } from '@/features/business/business-profile-form'

/**
 * Container — `/negocio/editar` (issue #72, PR5, decisión de diseño D4).
 * El gate de Owner vive ACÁ, no en `src/app/routes.tsx` (excluido de
 * cobertura, sin test por convención del repo — un gate ahí sería
 * intestable contra el gate duro 80/85/75/80) ni en el formulario (que
 * tendría que montarse para recién ahí anunciar que no se puede usar).
 *
 * Compone `useBusinessMe()` + `useBusinessStaffMe()` y bifurca en CUATRO
 * ramas: pending (cualquiera de las dos) / error (cualquiera de las dos,
 * con reintento independiente por query) / no-Owner (aviso traducido, NO
 * un redirect — un deep link que redirige en silencio parece roto — y NO
 * inputs deshabilitados, que se verían visualmente idénticos al
 * congelamiento permanente de RN-BIZ-01 mientras significan algo distinto)
 * / éxito (el formulario, precargado con el `Business` ya leído).
 *
 * Sin default permisivo: si `staffQuery` falla, la rama de error existente
 * se activa — la lectura fallida nunca otorga permiso en silencio (D4).
 */
export function BusinessProfileEditPage() {
  const { t } = useTranslation('business')
  const businessQuery = useBusinessMe()
  const staffQuery = useBusinessStaffMe()

  if (businessQuery.isPending || staffQuery.isPending) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-4">
        <p role="status">{t('profile.loading')}</p>
      </div>
    )
  }

  if (businessQuery.isError || staffQuery.isError) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
        <p role="alert" className="font-sans text-xs text-alert">
          {getProblemDetailsMessage(
            businessQuery.error ?? staffQuery.error,
            t('profile.errors.generic')
          )}
        </p>
        <Button
          variant="primary"
          onClick={() => {
            if (businessQuery.isError) businessQuery.refetch()
            if (staffQuery.isError) staffQuery.refetch()
          }}
        >
          {t('profile.retry')}
        </Button>
      </div>
    )
  }

  if (!canEditBusinessProfile(staffQuery.data.role)) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-sans text-sm text-ink">{t('editForm.notOwner.message')}</p>
        <Link to="/negocio" className="font-sans text-xs font-bold text-teal hover:underline">
          {t('editForm.notOwner.backLink')}
        </Link>
      </div>
    )
  }

  return <BusinessProfileForm business={businessQuery.data} />
}
