import { useTranslation } from 'react-i18next'
import { Banner } from '@/shared/components/ui/banner'
import { useBusinessAccess } from '@/features/business/use-business-access'

/**
 * Aviso persistente Paused/Suspended, montado en `AppShell` arriba de
 * `<main>` en TODA ruta (spec #1547 dominio `business-gateway`,
 * "Paused/Suspended banner disables all writes"). `Active` no renderiza
 * nada — `PendingVerification`/`Rejected`/sin negocio ya quedaron
 * interceptados antes de llegar acá (`BusinessGateway`).
 *
 * El `id` (`useBusinessAccess().bannerId`) es el mismo que cada control de
 * escritura deshabilitado va a apuntar vía `aria-describedby` (PR8b) — una
 * sola fuente para "por qué está bloqueado" (addendum de a11y #1548).
 */
export function BusinessStatusBanner() {
  const { t } = useTranslation('business')
  const { reason, bannerId } = useBusinessAccess()

  if (!reason) return null

  return (
    <Banner id={bannerId} variant={reason === 'paused' ? 'warning' : 'error'}>
      <p className="font-bold">{t(`banner.${reason}.title`)}</p>
      <p>{t(`banner.${reason}.body`)}</p>
    </Banner>
  )
}
