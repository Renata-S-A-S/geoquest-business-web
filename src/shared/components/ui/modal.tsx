import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/cn'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Acciones al pie (ej. "Cancelar" / "Confirmar") — el modal no las arma, solo les da un slot. */
  footer?: ReactNode
  /**
   * Cierra al clickear el backdrop. Default `true`. Poner en `false` para
   * confirmaciones destructivas donde un click accidental afuera no debe
   * descartar la acción (criterio de aceptación: "configurable por prop si
   * algún caso no lo quiere") — Esc, en cambio, siempre cierra, sin
   * excepción configurable en el issue.
   */
  closeOnBackdropClick?: boolean
  className?: string
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal/dialog — issue #15 del slice 004c-business-portal-flows.
 *
 * Renderizado vía `createPortal` a `document.body`: `AppShell` tiene
 * `overflow-hidden`/`overflow-y-auto` en varios contenedores (ver
 * `app-shell.tsx`), un modal posicionado dentro de ese árbol quedaría
 * recortado o mal apilado.
 *
 * Focus trap (criterio de aceptación): al abrir, el foco se mueve al
 * primer elemento enfocable del diálogo; Tab/Shift+Tab quedan atrapados
 * dentro mientras está abierto; al cerrar, el foco vuelve al elemento que
 * lo abrió — sin esto, un usuario de teclado o lector de pantalla queda
 * "perdido" en el resto de la página con el modal todavía visible.
 *
 * `onClose` se guarda en un ref (no como dependencia del efecto que arma
 * el trap) para que un re-render del caller con un `onClose` nuevo (ej. no
 * memoizado con `useCallback`) no reinicie el foco al primer elemento en
 * cada tecla — el trap se configura una sola vez por apertura.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  closeOnBackdropClick = true,
  className,
}: ModalProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null

    const dialog = dialogRef.current
    const initialFocusable = dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ;(initialFocusable?.[0] ?? dialog)?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const nodes = dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (!nodes || nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    // Sin esto, la página detrás del backdrop se puede scrollear con
    // rueda/flechas mientras el modal está abierto — no forma parte del
    // criterio de aceptación, pero es higiene estándar de un diálogo modal.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocusedRef.current?.focus()
    }
  }, [open])

  if (!open) return null

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && closeOnBackdropClick) onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'w-full max-w-md rounded-lg border border-border bg-surface-raised p-4 shadow-md focus:outline-none',
          className
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-base font-bold text-ink">
            {title}
          </h2>
          <button
            type="button"
            aria-label={t('aria.dismiss')}
            onClick={onClose}
            className="shrink-0 text-muted"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        <div className="font-sans text-sm text-ink">{children}</div>
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
