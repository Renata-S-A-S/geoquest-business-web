import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'

/**
 * Wrapper de `Link` que sabe bloquearse — pensado para acciones de
 * navegación gateadas por `useBusinessAccess()` (ej. "Editar" en
 * `reward-detail-view.tsx`, PR8a). Deshabilitado, NO renderiza un `<Link>`
 * con `aria-disabled` (React Router seguiría navegando al click y muchos
 * lectores de pantalla ignoran `aria-disabled` en elementos nativamente
 * interactivos) — se degrada a un `<span>`, que no es focoteable por
 * defecto ni navegable, con `aria-describedby` apuntando a la razón (el
 * banner de estado u otra leyenda), nunca un disabled mudo (addendum de
 * a11y #1548).
 */
export interface ActionLinkProps extends LinkProps {
  disabled?: boolean
  /** id del elemento que explica por qué la acción está bloqueada (ej. `BUSINESS_WRITE_BLOCK_ID`). */
  describedById?: string
}

const baseClassName = 'font-sans text-xs font-bold'

export function ActionLink({
  disabled,
  describedById,
  className,
  children,
  to,
  ...props
}: ActionLinkProps) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        aria-describedby={describedById}
        className={cn(baseClassName, 'cursor-not-allowed text-muted', className)}
      >
        {children}
      </span>
    )
  }

  return (
    <Link to={to} className={cn(baseClassName, 'text-teal hover:underline', className)} {...props}>
      {children}
    </Link>
  )
}
