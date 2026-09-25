import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '@/shared/components/ui/card'
import { StatusBadge, type StatusBadgeVariant } from '@/shared/components/ui/status-badge'
import {
  canEditReward,
  isRewardOutOfStock,
  type BusinessRewardStatus,
  type BusinessRewardSummary,
} from '@/shared/schemas/business-reward'

/**
 * Mapa de estado a variante visual. Duplicado respecto de `RewardsView` a
 * propósito, igual que `PLACE_STATUS_VARIANT` vive en `places-view.tsx` y en
 * `place-detail-view.tsx`: es la convención del repo, y tiparlo como
 * `Record<BusinessRewardStatus, …>` hace que agregar un estado al schema sin
 * decidir su color rompa la compilación en los dos lugares.
 */
const REWARD_STATUS_VARIANT: Record<BusinessRewardStatus, StatusBadgeVariant> = {
  Draft: 'neutral',
  Published: 'success',
  Paused: 'warning',
  Archived: 'error',
  Exhausted: 'warning',
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-base font-bold text-ink">{children}</h2>
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-sans text-xs font-semibold text-muted">{label}</span>
      <span className="font-sans text-sm text-ink">{value}</span>
    </div>
  )
}

export interface RewardDetailViewProps {
  reward: BusinessRewardSummary
  /**
   * Nombre del lugar al que está atada, ya resuelto por el contenedor.
   * `undefined` cuando la recompensa no tiene lugar o cuando el listado de
   * lugares todavía no resolvió — la vista no distingue los dos casos porque
   * no debe: `reward.placeId` ya le dice cuál es cuál.
   */
  placeName?: string
  /**
   * Acciones de estado (#110 editar, #111 pausar/republicar, #112 imagen). Se
   * inyectan para no acoplar la vista a las mutaciones, mismo reparto que
   * `PlaceDetailView`.
   */
  actions?: ReactNode
}

/**
 * Detalle de una recompensa (#109, B-03). Hermano de `PlaceDetailView` (#35).
 *
 * ⚠️ **No muestra fechas, y no es un olvido.** `Reward` no tiene
 * `CreatedAtUtc` ni `UpdatedAtUtc` — confirmado leyendo la entidad completa
 * contra backend `main` @ `ea471f4`, y el propio `Reward.cs:346-348` lo dice.
 * Un "creada el…" acá sería un dato inventado.
 */
export function RewardDetailView({ reward, placeName, actions }: RewardDetailViewProps) {
  const { t } = useTranslation('rewards')

  /**
   * Los tres casos de stock que pide #109, en el orden en que importan:
   * agotada primero (es el que bloquea canjes), después sin tope, después con
   * tope. `stockTotal === null` es ilimitado, NO cero: tratarlos igual
   * mostraría «Agotada» en la recompensa que nunca se agota.
   */
  function stockLabel(): string {
    if (isRewardOutOfStock(reward)) return t('detail.stock.outOfStock')
    if (reward.stockTotal === null) return t('detail.stock.unlimited')

    return t('detail.stock.remaining', {
      remaining: reward.stockRemaining ?? 0,
      total: reward.stockTotal,
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-lg font-bold text-ink">{reward.title}</h1>
          <StatusBadge
            status={reward.status}
            variantMap={REWARD_STATUS_VARIANT}
            label={t(`list.status.${reward.status}`)}
          />
        </div>
        <div className="flex flex-col items-end gap-1">
          {/*
            El enlace a editar solo aparece cuando el servidor aceptaría la
            edición (`Reward.cs:205`: Published, Exhausted o Paused). No se
            muestra deshabilitado: un control mudo no explica nada, y el
            contenedor de edición ya explica el motivo si alguien llega por
            URL directa. Mismo criterio que `PublishPlaceAction`, que no
            renderiza nada cuando la acción es imposible por estado.
          */}
          {canEditReward(reward) && (
            <Link
              to={`/recompensas/${reward.rewardId}/editar`}
              className="font-sans text-xs font-bold text-teal hover:underline"
            >
              {t('detail.editCta')}
            </Link>
          )}
          <Link to="/recompensas" className="font-sans text-xs font-bold text-teal hover:underline">
            {t('detail.backToList')}
          </Link>
        </div>
      </div>

      {actions}

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t('detail.sections.offer.title')}</SectionTitle>
        <DetailField label={t('detail.fields.description.label')} value={reward.description} />
        <DetailField
          label={t('detail.fields.geoPointsCost.label')}
          value={t('list.geoPointsCostValue', { points: reward.geoPointsCost })}
        />
        <DetailField
          label={t('detail.fields.estimatedValueCop.label')}
          value={t('detail.fields.estimatedValueCop.value', {
            amount: reward.estimatedValueCop,
          })}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t('detail.sections.availability.title')}</SectionTitle>
        <DetailField label={t('detail.fields.stock.label')} value={stockLabel()} />
        <DetailField
          label={t('detail.fields.place.label')}
          value={
            reward.placeId === null
              ? t('detail.place.allPlaces')
              : (placeName ?? t('detail.place.specific'))
          }
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t('detail.sections.image.title')}</SectionTitle>
        {reward.imageUrl === null ? (
          <>
            <p className="font-sans text-sm text-ink">{t('detail.image.empty')}</p>
            <p className="font-sans text-xs text-muted">{t('detail.image.emptyHint')}</p>
          </>
        ) : (
          <img
            src={reward.imageUrl}
            alt={t('detail.image.alt', { title: reward.title })}
            className="max-h-64 w-full rounded-sm border border-border object-cover"
          />
        )}
      </Card>
    </div>
  )
}
