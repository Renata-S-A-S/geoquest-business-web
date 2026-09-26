import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { useMyBusiness } from '@/features/business/queries'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { AppShell } from './layout/app-shell'
import { NoBusinessGate, PendingVerificationGate, RejectedGate } from './gates'

const WAKING_UP_DELAY_MS = 5000

/**
 * Entre `ProtectedRoute` y el contenido routeado (spec #1547 dominio
 * `business-gateway` "Gateway placement and read"): lee `useMyBusiness()`
 * una vez por montaje y decide qué chrome recibe el staff autenticado.
 *
 * Ocupa el mismo slot de ruta que antes ocupaba `AppShell` en `routes.tsx`
 * (`element: <BusinessGateway />` en vez de `element: <AppShell />`) — NO
 * agrega un nivel de anidamiento nuevo al árbol de rutas. Con el negocio
 * pasable (`Active`/`Paused`/`Suspended`) este componente devuelve
 * `<AppShell />`, que sigue renderizando `<Outlet />` para las rutas hijas
 * sin cambios. Evita así reindentar los ~150 líneas de rutas hijas dentro
 * del presupuesto HARD de 400 líneas de esta tarea — una capa de ruta
 * adicional habría reformateado cada línea hija sin cambiar su contenido.
 *
 * Cold start de Render (design "Cold start"): el primer request a un
 * backend dormido puede tardar. La query reintenta con la config default
 * de `queryClient` (retry:3) sin timeout propio; tras
 * `WAKING_UP_DELAY_MS` sin resolver se agrega el aviso de "puede estar
 * despertando" al indicador de carga en vez de dejar un spinner mudo.
 */
export function BusinessGateway() {
  const { t } = useTranslation('business')
  const { data, isPending, isError, error, refetch } = useMyBusiness()
  const [showWakingUp, setShowWakingUp] = useState(false)

  useEffect(() => {
    if (!isPending) {
      setShowWakingUp(false)
      return
    }
    const timer = setTimeout(() => setShowWakingUp(true), WAKING_UP_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isPending])

  if (isPending) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-cream p-4 text-center">
        <p role="status" className="font-sans text-sm text-ink">
          {t('profile.loading')}
        </p>
        {showWakingUp && <p className="font-sans text-xs text-muted">{t('gate.wakingUp')}</p>}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-cream p-4 text-center">
        <p role="alert" className="font-sans text-xs text-alert">
          {getProblemDetailsMessage(error, t('profile.errors.generic'))}
        </p>
        <Button variant="primary" onClick={() => void refetch()}>
          {t('profile.retry')}
        </Button>
      </div>
    )
  }

  if (data === null) return <NoBusinessGate />
  if (data.status === 'PendingVerification') return <PendingVerificationGate />
  if (data.status === 'Rejected') return <RejectedGate business={data} />

  return <AppShell />
}
