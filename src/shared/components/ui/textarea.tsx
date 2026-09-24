import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * Gemelo multilínea de `Input` — mismas clases y misma forma (sin slot de
 * error propio, el caller lo conecta con `FormField`).
 *
 * Se agrega en #30: `Place.description` es obligatoria en el backend y es
 * prosa, no una etiqueta. Un `Input` de una sola línea para describir un
 * local obliga a escribir a ciegas sobre texto que se sale del campo.
 *
 * `rows` por default en 4 — suficiente para ver el párrafo completo sin
 * empujar el botón de guardar fuera de la pantalla en mobile.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 4, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full resize-y rounded-xs border border-border bg-surface-raised px-3 py-2 font-sans text-sm text-ink placeholder:text-muted focus:border-teal focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'
