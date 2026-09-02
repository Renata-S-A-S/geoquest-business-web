import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export interface FormFieldProps {
  /** Debe coincidir con el `id`/`htmlFor` del control real (Input/Select) — FormField no clona props. */
  htmlFor: string
  label: string
  /** Id del nodo de error, para que el caller lo pase como `aria-describedby` al control real. */
  errorId: string
  error?: string
  children: ReactNode
  className?: string
}

/**
 * Label + mensaje de error para un `Input`/`Select` — ninguno de los dos
 * primitivos trae su propio slot de error (#21 es el primer formulario real
 * del repo). No clona/inyecta props en `children`: el caller conecta
 * `id`/`aria-describedby` a mano en su control, lo que mantiene esto
 * compatible tanto con `Input` (label externo, sin prop `label` propia)
 * como con `Select` (que exige *o* su propio `label` *o* `aria-labelledby`,
 * nunca los dos — acá siempre se usa `aria-labelledby` apuntando a este
 * label, ver `select.tsx`).
 */
export function FormField({ htmlFor, label, errorId, error, children, className }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label
        htmlFor={htmlFor}
        id={`${htmlFor}-label`}
        className="font-sans text-xs font-semibold text-ink"
      >
        {label}
      </label>
      {children}
      {error && (
        <p id={errorId} role="alert" className="font-sans text-xs text-alert">
          {error}
        </p>
      )}
    </div>
  )
}
