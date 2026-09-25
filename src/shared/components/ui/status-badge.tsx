import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/cn'

/**
 * Badge de estado genérico — issue #14/#19 del slice 004c-business-portal-flows.
 *
 * Restricción de diseño (ADR-047-BF, aceptado 1 sep 2026): "Sunset coral" es
 * solo para acentos puntuales, NUNCA para indicar estado — por eso ningún
 * variant usa `coral`.
 *
 * Token `warning` (ámbar) agregado en `real-backend-readiness` PR1
 * (`src/index.css`): hasta acá no existía en la paleta heredada de 6
 * colores de ADR-047-BF y 'warning' se resolvía con el mismo tratamiento
 * neutral que 'neutral' (fondo/punto grises). El estado Paused del negocio
 * (#1547 dominio `business-gateway`) es el primer consumidor real.
 *
 * Contraste: todas las variantes usan texto `ink` sobre un fondo `surface.*`
 * tenue (relación de contraste medida >12:1, ver verificación de la tarea),
 * en vez de texto de color sobre fondo tenue — un texto de color como
 * `alert` sobre `surface.alert` mide ~3.43:1, por debajo del mínimo AA
 * (4.5:1) para texto de este tamaño. El color semántico de cada variant se
 * expresa en el punto indicador, no en el texto.
 */
const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-0.5 font-sans text-[11px] font-bold text-ink',
  {
    variants: {
      variant: {
        neutral: 'bg-paper border-border',
        success: 'bg-surface-mint',
        warning: 'bg-surface-warning',
        error: 'bg-surface-alert',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
)

const dotVariants = cva('h-1.5 w-1.5 shrink-0 rounded-full', {
  variants: {
    variant: {
      neutral: 'bg-muted',
      success: 'bg-green',
      warning: 'bg-warning',
      error: 'bg-alert',
    },
  },
  defaultVariants: {
    variant: 'neutral',
  },
})

export type StatusBadgeVariant = NonNullable<VariantProps<typeof statusBadgeVariants>['variant']>

export interface StatusBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Valor de status crudo (ej. `Business.status`, `Place.status`, `Reward.status`, `UserReward.status`). */
  status: string
  /** Mapea cada valor de `status` a una de las 4 variantes visuales. Sin entrada → 'neutral'. */
  variantMap: Record<string, StatusBadgeVariant>
  /** Texto a mostrar en vez de `status` crudo (ej. ya traducido por el caller). Default: `status`. */
  label?: string
}

export function StatusBadge({ status, variantMap, label, className, ...props }: StatusBadgeProps) {
  const variant = variantMap[status] ?? 'neutral'
  return (
    <span role="status" className={cn(statusBadgeVariants({ variant }), className)} {...props}>
      <span aria-hidden="true" className={cn(dotVariants({ variant }))} />
      {label ?? status}
    </span>
  )
}
