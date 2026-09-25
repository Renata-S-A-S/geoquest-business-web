import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/cn'

/**
 * Banner persistente y no descartable — distinto de `Toast` (`toast.tsx`),
 * que se auto-descarta. Pensado para el aviso de estado Paused/Suspended
 * (#1547 dominio `business-gateway`) y para avisos informativos de vida
 * más larga que un toast (ej. el nudge de imagen tras publicar una
 * recompensa, PR9).
 *
 * `role="status"` + `aria-live="polite"` en TODAS las variantes (addendum
 * de a11y #1548): ninguna de estas notificaciones la dispara una acción
 * directa del usuario en el momento (a diferencia de un error de submit),
 * así que ninguna necesita `role="alert"` / `assertive`.
 */
const bannerVariants = cva(
  'w-full rounded-md border-y border-r border-border border-l-4 px-3 py-2.5 font-sans text-xs text-ink',
  {
    variants: {
      variant: {
        warning: 'border-l-warning bg-surface-warning',
        error: 'border-l-alert bg-surface-alert',
        info: 'border-l-teal bg-surface-teal',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
)

export type BannerVariant = NonNullable<VariantProps<typeof bannerVariants>['variant']>

export interface BannerProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof bannerVariants> {}

export function Banner({ variant, className, children, ...props }: BannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(bannerVariants({ variant }), className)}
      {...props}
    >
      {children}
    </div>
  )
}
