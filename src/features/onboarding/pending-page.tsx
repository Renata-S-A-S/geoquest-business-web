import { useTranslation } from 'react-i18next'
import { Card } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { StatusBadge, type StatusBadgeVariant } from '@/shared/components/ui/status-badge'
import { useMyBusiness } from '@/features/business/queries'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import type { MyBusinessStatus } from '@/shared/schemas/business'

/** Variant visual por status — mismo criterio que `business-settings-section.tsx`. */
const BUSINESS_STATUS_VARIANT: Record<MyBusinessStatus, StatusBadgeVariant> = {
  Active: 'success',
  Paused: 'warning',
  PendingVerification: 'warning',
  Suspended: 'error',
  Rejected: 'error',
}

/**
 * `/registro/pendiente` — issue #27. Migrada a `useMyBusiness()`
 * (PR6c-part2b): 5 estados reales, sin rama rápida/reforzada (#25).
 * `data === null` sin manejar a propósito: PR7a reemplaza esta pantalla.
 */
export function PendingStatusPage() {
  const { t } = useTranslation('onboarding')
  const { data, isPending, isError, error, isFetching, refetch } = useMyBusiness()

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

            {data.status === 'PendingVerification' ? (
              <p className="mb-4">{t('pending.sla')}</p>
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
