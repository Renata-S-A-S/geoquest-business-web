import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useBackendCapabilities } from '@/shared/lib/backend-capabilities'
import { useMyBusiness } from '@/features/business/queries'
import { RegisterPage } from '@/features/onboarding/register-page'

/**
 * `/registro` (real-backend-readiness PR10, issue #212) — hermana de
 * `BusinessGateway` dentro de `ProtectedRoute`, NO hija: un explorador
 * autenticado sin `MyBusiness` todavía debe poder llegar acá aunque
 * `BusinessGateway` lo mande a `NoBusinessGate` en `/`.
 *
 * Se cierra en dos casos, ambos redirigiendo a `/`: la capacidad
 * `registration` está apagada (backend real, la capability seam de PR1), o
 * el explorador ya resuelve un `MyBusiness` propio (nada que registrar).
 */
export function RegistrationRoute() {
  const { t } = useTranslation('business')
  const capabilities = useBackendCapabilities()
  const { data, isPending } = useMyBusiness()

  if (!capabilities.registration) return <Navigate to="/" replace />

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-cream p-4">
        <p role="status" className="font-sans text-sm text-ink">
          {t('profile.loading')}
        </p>
      </div>
    )
  }

  if (data !== null) return <Navigate to="/" replace />

  return <RegisterPage />
}
