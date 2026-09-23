import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Card } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { StatusBadge, type StatusBadgeVariant } from '@/shared/components/ui/status-badge'
import { getBusinessMe } from '@/features/onboarding/api/get-business-me'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import type { Business } from '@/shared/schemas/business'

/** Variant visual por status — RN-BIZ-01/02 no definen colores, se sigue el criterio de `StatusBadge` (#19). */
const BUSINESS_STATUS_VARIANT: Record<Business['status'], StatusBadgeVariant> = {
  Pending: 'warning',
  Active: 'success',
  Suspended: 'error',
}

/**
 * `/registro/pendiente` — issue #27. Primera pantalla del repo que consulta
 * y renderiza estado de servidor: un único `useQuery`, sin abstracción
 * nueva (ver design decision 4). RN-BIZ-01 fija el SLA de 48 horas hábiles
 * mientras `status === 'Pending'`; RN-BIZ-02 (rama rápida/reforzada según
 * el cruce con Google Maps, #25) decide qué copy mostrar dentro de esa
 * ventana.
 *
 * `staleTime: 30_000` amortigua refetches automáticos (foco de pestaña) sin
 * afectar el refresh manual, que ignora `staleTime`. Ver design decision 3
 * sobre por qué esto vive acá y no en `query-client.ts`.
 *
 * Rama rápida/reforzada (#25, RN-BIZ-02): puramente informativa. BL-014
 * bloquea las acciones de subida de #26 — esta sección nunca debe ofrecer
 * un control interactivo propio, solo texto.
 */
export function PendingStatusPage() {
  const { t } = useTranslation('onboarding')
  const { data, isPending, isError, error, isFetching, refetch } = useQuery({
    queryKey: ['business', 'me'],
    queryFn: getBusinessMe,
    staleTime: 30_000,
  })
  // Rama fast/reinforced (#25) — solo se usa mientras `Pending`, pero se
  // computa una vez acá para no repetir el ternario en título y cuerpo.
  const verificationBranch = data?.isGoogleMapsVerified ? 'fast' : 'reinforced'

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream p-4">
      <Card className="w-full max-w-md">
        <h1 className="mb-4 font-display text-lg font-bold text-ink">{t('pending.title')}</h1>

        {isPending && <p role="status">{t('pending.loading')}</p>}

        {isError && (
          <p role="alert" className="mb-4 text-alert">
            {getProblemDetailsMessage(error, t('pending.errors.generic'))}
          </p>
        )}

        {data && (
          <>
            <StatusBadge
              status={data.status}
              variantMap={BUSINESS_STATUS_VARIANT}
              label={t(`pending.status.${data.status}`)}
              className="mb-3"
            />

            {data.status === 'Pending' ? (
              <>
                <p className="mb-4">{t('pending.sla')}</p>
                <section>
                  <h2 className="mb-1 font-display text-base font-bold text-ink">
                    {t(`pending.branch.${verificationBranch}.title`)}
                  </h2>
                  <p className="mb-4">{t(`pending.branch.${verificationBranch}.body`)}</p>
                </section>
              </>
            ) : (
              <>
                <h2 className="mb-1 font-display text-base font-bold text-ink">
                  {t(`pending.resolved.${data.status}.title`)}
                </h2>
                <p className="mb-4">{t(`pending.resolved.${data.status}.body`)}</p>
              </>
            )}
          </>
        )}

        {(data || isError) && (
          <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? t('pending.refreshing') : t('pending.refresh')}
          </Button>
        )}
      </Card>
    </div>
  )
}
