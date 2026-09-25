import { Coins, Gift } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/cn'
import type { RedemptionOrigin } from '@/shared/schemas/business-redemption'

/**
 * Indicador Purchased vs Prize (#47).
 *
 * El criterio de aceptación pide un indicador «claramente distinto, no solo
 * texto chico», así que esto **no** es un `StatusBadge`: es un bloque de
 * ancho completo con borde de acento, ícono propio y una frase que explica la
 * consecuencia. Tres señales redundantes (color, ícono, texto) en vez de una,
 * que además es lo que hace que funcione para alguien que no distingue los
 * colores.
 *
 * Reusa el patrón de acento de `toast.tsx` (`border-l-4` + `border-l-<token>`)
 * en vez de inventar uno nuevo.
 *
 * ⚠️ El valor real del backend es **`Prize`**, no `Granted`. RN-REW-10,
 * ADR-045 y el propio issue #47 dicen `Granted`; el enum no lo tiene. Ver
 * `business-redemption.ts`.
 *
 * Por qué la frase del premio importa tanto como el color: en un `Prize` el
 * costo es 0 porque el explorador no pagó saldo, y un 0 sin explicación se lee
 * como un dato roto. El staff tiene que poder entregar la recompensa sin
 * pensar que el sistema se equivocó.
 */

const ORIGIN_STYLES: Record<RedemptionOrigin, { container: string; icon: string }> = {
  Purchased: { container: 'border-l-teal bg-surface-teal', icon: 'text-teal' },
  Prize: { container: 'border-l-green bg-surface-mint', icon: 'text-green' },
}

const ORIGIN_ICONS: Record<RedemptionOrigin, typeof Coins> = {
  Purchased: Coins,
  Prize: Gift,
}

export interface RedemptionOriginCalloutProps {
  origin: RedemptionOrigin
}

export function RedemptionOriginCallout({ origin }: RedemptionOriginCalloutProps) {
  const { t } = useTranslation('redemptions')
  const styles = ORIGIN_STYLES[origin]
  const Icon = ORIGIN_ICONS[origin]

  return (
    <div
      data-testid="redemption-origin"
      className={cn(
        'flex w-full items-start gap-2.5 rounded-md border-y border-r border-border border-l-4 px-3 py-2.5',
        styles.container
      )}
    >
      <Icon aria-hidden="true" size={20} weight="fill" className={cn('shrink-0', styles.icon)} />

      <div className="flex flex-col gap-0.5">
        <span className="font-display text-sm font-bold text-ink">
          {t(`origin.${origin}.label`)}
        </span>
        <p className="font-sans text-xs text-muted">{t(`origin.${origin}.note`)}</p>
      </div>
    </div>
  )
}
