import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type ColumnDef } from '@/shared/components/ui/data-table'
import { StatusBadge, type StatusBadgeVariant } from '@/shared/components/ui/status-badge'
import {
  isRewardOutOfStock,
  type BusinessRewardStatus,
  type BusinessRewardSummary,
} from '@/shared/schemas/business-reward'

/**
 * Mapa de estado a variante visual. Tiparlo como
 * `Record<BusinessRewardStatus, ...>` hace que agregar un estado al schema
 * sin decidir su color rompa la compilación, en vez de caer al 'neutral'
 * por defecto de `StatusBadge` sin que nadie se entere.
 */
const REWARD_STATUS_VARIANT: Record<BusinessRewardStatus, StatusBadgeVariant> = {
  Draft: 'neutral',
  Published: 'success',
  Paused: 'warning',
  Archived: 'error',
}

export interface RewardsViewProps {
  rewards: BusinessRewardSummary[]
}

/**
 * Listado de recompensas del negocio (#36, B-03). Hermano de `PlacesView`
 * (#29) y segundo consumidor de `DataTable` (#17).
 *
 * ⚠️ **«Agotada» NO es un estado**, y por eso no está en el badge. El
 * backend no tiene `RewardStatus.Exhausted`: el agotamiento se lee de
 * `stockRemaining`, así que es un hecho del stock y vive en la columna de
 * stock. El schema anterior del portal lo modelaba como estado, lo que
 * habría hecho fallar el parseo de cualquier respuesta real.
 *
 * Una recompensa agotada sigue estando `Published` — eso es correcto y es
 * justamente la distinción que el negocio necesita ver: está publicada,
 * pero nadie más la puede canjear.
 */
export function RewardsView({ rewards }: RewardsViewProps) {
  const { t } = useTranslation('rewards')

  /**
   * `stockTotal === null` significa ilimitado, no cero. Tratarlos igual
   * mostraría «Agotada» en la recompensa que nunca se agota.
   */
  function stockLabel(reward: BusinessRewardSummary): string {
    if (isRewardOutOfStock(reward)) return t('list.stock.outOfStock')
    if (reward.stockTotal === null) return t('list.stock.unlimited')

    return t('list.stock.remaining', {
      remaining: reward.stockRemaining ?? 0,
      total: reward.stockTotal,
    })
  }

  const columns: ColumnDef<BusinessRewardSummary>[] = [
    { key: 'title', header: t('list.columns.title') },
    {
      key: 'status',
      header: t('list.columns.status'),
      // `DataTable` auto-renderiza la columna de `statusField` como
      // `StatusBadge` SIN `label`, o sea que mostraría el literal del enum
      // en una interfaz en español. Este `render` es lo que lo traduce.
      render: (reward) => (
        <StatusBadge
          status={reward.status}
          variantMap={REWARD_STATUS_VARIANT}
          label={t(`list.status.${reward.status}`)}
        />
      ),
    },
    {
      key: 'geoPointsCost',
      header: t('list.columns.geoPointsCost'),
      render: (reward) => t('list.geoPointsCostValue', { points: reward.geoPointsCost }),
    },
    {
      key: 'stockRemaining',
      header: t('list.columns.stock'),
      render: stockLabel,
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-lg font-bold text-ink">{t('list.title')}</h1>
        <Link
          to="/recompensas/nueva"
          className="font-sans text-xs font-bold text-teal hover:underline"
        >
          {t('list.createCta')}
        </Link>
      </div>

      <DataTable
        columns={columns}
        data={rewards}
        statusField="status"
        statusVariantMap={REWARD_STATUS_VARIANT}
        getRowId={(reward) => reward.rewardId}
        emptyState={
          <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-center">
            <span className="font-sans text-sm font-bold text-ink">{t('list.empty.title')}</span>
            <p className="font-sans text-xs text-muted">{t('list.empty.description')}</p>
            <Link
              to="/recompensas/nueva"
              className="font-sans text-xs font-bold text-teal hover:underline"
            >
              {t('list.createCta')}
            </Link>
          </div>
        }
      />
    </div>
  )
}
