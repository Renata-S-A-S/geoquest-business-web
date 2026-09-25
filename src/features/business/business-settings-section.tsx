import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Avatar } from '@/shared/components/ui/avatar'
import { StatusBadge, type StatusBadgeVariant } from '@/shared/components/ui/status-badge'
import { useMyBusiness } from '@/features/business/queries'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import type { MyBusinessStatus } from '@/shared/schemas/business'

const BUSINESS_STATUS_VARIANT: Record<MyBusinessStatus, StatusBadgeVariant> = {
  Active: 'success',
  Paused: 'warning',
  PendingVerification: 'warning',
  Suspended: 'error',
  Rejected: 'error',
}

/**
 * Bloque «Mi negocio» dentro de `/configuracion` (fusión de `/negocio`, decisión de Derek, 24 sep 2026).
 *
 * Superficie reducida (real-backend-readiness PR6c, spec #1547 dominio
 * `business-settings`): `GET /business/mine` (`useMyBusiness()`) no manda
 * `email`/`category`/valores legales — propuesta sin confirmar de
 * `businessSchema` (issue #21) que nunca existió en el backend real. Se
 * muestra solo lo que el DTO trae: nombre, logo, estado y — en `Rejected`
 * — motivo y fecha de rechazo. `ReadOnlyField` y `businessSchema` se
 * retiran junto con esta reducción.
 */
export function BusinessSettingsSection() {
  const { t } = useTranslation('business')
  const businessQuery = useMyBusiness()

  if (businessQuery.isPending) {
    return (
      <div className="flex min-h-[80px] items-center justify-center">
        <p role="status">{t('profile.loading')}</p>
      </div>
    )
  }

  // `data === null` (`/business/mine` → `[]`, sin negocio propio) se agrupa con el error
  // de red pero sin botón de reintento — mismo criterio que `rewards-page.tsx` (PR6b).
  if (businessQuery.isError || businessQuery.data === null) {
    return (
      <div className="flex min-h-[80px] flex-col items-center justify-center gap-3 text-center">
        <p role="alert" className="font-sans text-xs text-alert">
          {businessQuery.isError
            ? getProblemDetailsMessage(businessQuery.error, t('profile.errors.generic'))
            : t('profile.errors.noBusiness')}
        </p>
        {businessQuery.isError && (
          <Button variant="primary" onClick={() => businessQuery.refetch()}>
            {t('profile.retry')}
          </Button>
        )}
      </div>
    )
  }

  const business = businessQuery.data

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar
          initial={business.name.charAt(0).toUpperCase()}
          src={business.logoUrl}
          alt={business.name}
        />
        <div className="flex flex-col gap-1">
          <span className="font-sans text-sm font-semibold text-ink">{business.name}</span>
          <StatusBadge
            status={business.status}
            variantMap={BUSINESS_STATUS_VARIANT}
            label={t(`profile.status.${business.status}`)}
          />
        </div>
      </div>

      {/* `rejectionReason` es texto libre del backend: `break-words`, nunca truncado (a11y #1548). */}
      {business.status === 'Rejected' && business.rejectionReason && (
        <div className="flex flex-col gap-0.5 border-t border-border pt-3">
          <p className="break-words font-sans text-xs text-ink">{business.rejectionReason}</p>
          {business.rejectedAtUtc && (
            <p className="font-sans text-[11px] text-muted">
              {t('profile.rejectedAt', {
                date: new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(
                  new Date(business.rejectedAtUtc)
                ),
              })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
