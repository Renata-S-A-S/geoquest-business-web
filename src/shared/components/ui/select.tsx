import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'
import { cn } from '@/shared/lib/cn'

export interface SelectOption {
  label: string
  value: string
}

export interface SelectProps {
  options: SelectOption[]
  value: string | null
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /**
   * Label visible, renderizado y asociado vía `htmlFor`/`id` — usar esto
   * cuando el select no tiene ya un `<label>` externo. Si el caller ya
   * arma su propio label (ej. dentro de un `FormField` que también
   * necesita conectar mensajes de error), pasar `aria-labelledby` en su
   * lugar y omitir esta prop — mismo criterio del issue: "label accesible
   * asociado (aria-labelledby o label explícito)".
   */
  label?: string
  'aria-labelledby'?: string
  /**
   * Marca el trigger como inválido para tecnologías asistivas. El caller lo
   * pasa cuando su `FormField` está mostrando un error: sin esto el mensaje
   * rojo es visible pero el control mismo no se anuncia como inválido.
   */
  'aria-invalid'?: boolean
  /** Id del nodo de error, para que el trigger lo referencie. */
  'aria-describedby'?: string
  id?: string
  className?: string
}

/**
 * Select/dropdown accesible — issue #18 del slice 004c-business-portal-flows.
 *
 * No es un `<select>` nativo: el sistema de diseño necesita controlar el
 * popup (radio, sombra, tokens de marca) igual que `data-table.tsx`/
 * `status-badge.tsx`, y un `<select>` nativo no permite estilizar sus
 * opciones de forma consistente entre navegadores. Es un combobox
 * "collapsible dropdown listbox" (patrón WAI-ARIA APG), no un combobox
 * editable — no hay texto libre, solo elegir entre `options`.
 *
 * Accesibilidad (criterio de aceptación):
 * - Trigger `role="combobox"` + `aria-expanded`/`aria-controls` +
 *   `aria-activedescendant` apuntando a la opción resaltada — el foco del
 *   teclado se queda en el trigger, el listbox solo se anuncia vía ARIA
 *   (mismo patrón que un `<select>` nativo de escritorio).
 * - Teclado: ↓/↑ abren el listbox y mueven el resaltado, Enter/Espacio
 *   confirman la opción resaltada, Escape cierra sin cambiar `value`.
 * - Label: `label` (renderiza `<label htmlFor>` propio) o
 *   `aria-labelledby` (el caller ya tiene un label externo) — nunca los
 *   dos a la vez, ver JSDoc de la prop.
 */
/**
 * `forwardRef` al trigger, no al contenedor.
 *
 * React Hook Form usa esa ref para mover el foco al primer campo inválido
 * cuando falla el submit (`shouldFocusError`). Sin ella, un `Controller` que
 * envuelva este `Select` muestra el mensaje de error pero **el foco no se
 * mueve**: un usuario de teclado o lector de pantalla queda en el botón de
 * enviar, con un error que no sabe dónde está.
 *
 * Se expone el `<button>` y no el `<div>` raíz porque es el elemento
 * enfocable — enfocar el contenedor no haría nada.
 */
const SelectImpl = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { options, value, onChange, placeholder, disabled, label, id, className, ...ariaProps },
  forwardedRef
) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const generatedId = useId()
  const selectId = id ?? generatedId
  const listboxId = `${selectId}-listbox`
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // El trigger es el nodo enfocable, así que es el que se expone hacia afuera.
  useImperativeHandle(forwardedRef, () => triggerRef.current as HTMLButtonElement)

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined
  const ariaLabelledBy = ariaProps['aria-labelledby']

  const close = useCallback(() => {
    setOpen(false)
    setHighlightedIndex(-1)
  }, [])

  const commit = useCallback(
    (index: number) => {
      const option = options[index]
      if (!option) return
      onChange(option.value)
      close()
    },
    [options, onChange, close]
  )

  // Cierra al hacer click fuera — el trigger sigue enfocado, así que no
  // alcanza con onBlur (dispararía también al clickear una opción interna).
  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open, close])

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (!open) {
          setOpen(true)
          setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0)
        } else {
          setHighlightedIndex((current) => Math.min(current + 1, options.length - 1))
        }
        break
      case 'ArrowUp':
        event.preventDefault()
        if (!open) {
          setOpen(true)
          setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : options.length - 1)
        } else {
          setHighlightedIndex((current) => Math.max(current - 1, 0))
        }
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (!open) {
          setOpen(true)
          setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0)
        } else if (highlightedIndex >= 0) {
          commit(highlightedIndex)
        }
        break
      case 'Escape':
        if (open) {
          event.preventDefault()
          close()
        }
        break
      default:
        break
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {label && (
        <label htmlFor={selectId} className="mb-1 block font-sans text-xs font-semibold text-ink">
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        role="combobox"
        aria-invalid={ariaProps['aria-invalid']}
        aria-describedby={ariaProps['aria-describedby']}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
        }
        aria-labelledby={ariaLabelledBy}
        disabled={disabled}
        onClick={() => {
          if (open) {
            close()
          } else {
            setOpen(true)
            setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0)
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded-xs border border-border bg-surface-raised px-3 py-2 font-sans text-sm text-ink focus:border-teal focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn('truncate', !selectedOption && 'text-muted')}>
          {selectedOption?.label ?? placeholder ?? ''}
        </span>
        <CaretDown
          aria-hidden="true"
          size={14}
          weight="bold"
          className={cn('shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={ariaLabelledBy ?? (label ? selectId : undefined)}
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xs border border-border bg-surface-raised py-1 shadow-md"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value
            const isHighlighted = index === highlightedIndex
            return (
              <li
                key={option.value}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => commit(index)}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 font-sans text-sm text-ink',
                  isHighlighted && 'bg-paper'
                )}
              >
                {option.label}
                {isSelected && (
                  <Check aria-hidden="true" size={14} weight="bold" className="text-teal" />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
})

SelectImpl.displayName = 'Select'

export const Select = SelectImpl
