import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

/** Card genérica: fondo blanco, borde 1px, radio md. Sin borde rasgado (ADR-047-BF). */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-md border border-border bg-white px-4 py-3', className)}
      {...props}
    />
  )
)
Card.displayName = 'Card'
