import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/**
 * Native `<input type="checkbox">` primitive — mirrors `Input`'s
 * `forwardRef` + `cn()` pattern (issue #23). No `label` prop: like `Input`,
 * labelling is left to `FormField`'s `<label htmlFor>` since a native
 * checkbox gets its accessible name for free. `type` is omitted from the
 * props to keep this a checkbox-only primitive.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'h-4 w-4 shrink-0 cursor-pointer accent-teal disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
)
Checkbox.displayName = 'Checkbox'
