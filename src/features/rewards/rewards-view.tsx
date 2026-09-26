import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ActionLink } from '@/shared/components/ui/action-link'
import { DataTable, type ColumnDef } from '@/shared/components/ui/data-table'
import { StatusBadge, type StatusBadgeVariant } from '@/shared/components/ui/status-badge'
import { useWriteGuard } from '@/features/business/use-write-guard'
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
  // `Exhausted` comparte variante con `Paused` porque la paleta solo tiene
  // cuatro y ninguna es «agotado»: no es un error (la recompensa está bien
  // configurada) ni un éxito (nadie más puede canjearla). Lo que las
  // distingue es la etiqueta, que `StatusBadge` sí muestra — «Agotada» vs
  // «Pausada». Compartir color es aceptable; compartir texto no lo sería.
  Exhausted: 'warning',
}

export interface RewardsViewProps {
  rewards: BusinessRewardSummary[]
}

/**
 * Listado de recompensas del negocio (#36, B-03). Hermano de `PlacesView`
 * (#29) y segundo consumidor de `DataTable` (#17).
 *
 * **«Agotada» es HOY un estado del servidor Y un cálculo del cliente**, y la
 * pantalla necesita las dos lecturas. Corrige lo que este archivo decía
 * antes: `RewardStatus.Exhausted` SÍ existe en el backend (llegó con los PRs
 * #195–#201; verificado en `Domain/RewardStatus.cs` @ `ea471f4`).
 *
 * - En el **badge** aparece cuando el servidor ya sincronizó el estado.
 * - En la **columna de stock** se sigue calculando con `isRewardOutOfStock`,
 *   porque una recompensa `Published` puede tener `stockRemaining === 0`
 *   antes de que `SyncStockStatus()` la mueva.
 *
 * Las dos dicen «agotada» por caminos distintos, y borrar cualquiera de las
 * dos deja un hueco: sin el estado, se pierde lo que el servidor decidió;
 * sin el cálculo, se pierde la ventana en la que el stock ya está en cero
 * pero el estado todavía dice `Published`.
 */
export function RewardsView({ rewards }: RewardsViewProps) {
  const { t } = useTranslation('rewards')
  const writeGuard = useWriteGuard()

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
    {
      key: 'title',
      header: t('list.columns.title'),
      // El título es la entrada al detalle (#109). Sin esto el listado es un
      // cul-de-sac: se ve el estado pero no hay cómo actuar sobre él. Mismo
      // criterio que la columna `name` de `PlacesView`.
      render: (reward) => (
        <Link
          to={`/recompensas/${reward.rewardId}`}
          className="font-sans font-bold text-teal hover:underline"
        >
          {reward.title}
        </Link>
      ),
    },
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
        <ActionLink
          to="/recompensas/nueva"
          disabled={writeGuard.disabled}
          describedById={writeGuard.describedBy}
        >
          {t('list.createCta')}
        </ActionLink>
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
            <ActionLink
              to="/recompensas/nueva"
              disabled={writeGuard.disabled}
              describedById={writeGuard.describedBy}
            >
              {t('list.createCta')}
            </ActionLink>
          </div>
        }
      />
    </div>
  )
}
