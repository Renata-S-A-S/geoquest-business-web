import { useEffect } from 'react'
import { cva } from 'class-variance-authority'
import { CheckCircle, Info, WarningCircle, X, type Icon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/cn'
import { useToastStore, type Toast, type ToastVariant } from '@/shared/stores/toast-store'

/**
 * Componente toast/notificación — issue #16 del slice 004c-business-portal-flows.
 *
 * Contraste (mismo criterio que `status-badge.tsx`, #19): fondo blanco +
 * texto `ink` (>12:1, cumple WCAG AA de sobra) en vez del patrón
 * "texto de color sobre tinte" que ya dio problemas de contraste en el
 * badge. El color semántico va en el borde izquierdo y el ícono — nunca es
 * el único portador del significado, porque el mensaje en sí (leído por el
 * lector de pantalla vía `aria-live`) ya dice "éxito"/"error" en texto
 * plano. No se usa `coral` (ADR-047-BF: nunca para status/feedback).
 *
 * `role="status"` + `aria-live` (criterio de aceptación del issue):
 * "polite" para success/info, "assertive" solo para error — un error no
 * debe esperar a que el lector de pantalla termine de anunciar otra cosa.
 */
const toastVariants = cva(
  'pointer-events-auto flex w-full items-start gap-2.5 rounded-md border-y border-r border-border border-l-4 bg-white px-3 py-2.5 shadow-md',
  {
    variants: {
      variant: {
        success: 'border-l-green',
        error: 'border-l-alert',
        info: 'border-l-teal',
      },
    },
  }
)

const iconVariants = cva('mt-0.5 h-4 w-4 shrink-0', {
  variants: {
    variant: {
      success: 'text-green',
      error: 'text-alert',
      info: 'text-teal',
    },
  },
})

const ICONS: Record<ToastVariant, Icon> = {
  success: CheckCircle,
  error: WarningCircle,
  info: Info,
}

function ToastItem({ toast }: { toast: Toast }) {
  const { t } = useTranslation()
  const dismiss = useToastStore((state) => state.dismiss)
  const ToastIcon = ICONS[toast.variant]

  // Auto-dismiss tras `duration`. Depende de `toast.id`/`toast.duration`
  // (no de `dismiss`, referencia estable de Zustand, pero se lista igual
  // por regla de exhaustive-deps) — un toast nuevo con el mismo variant no
  // reinicia el timer de uno existente porque cada uno tiene su propio id.
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), toast.duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, dismiss])

  return (
    <div
      role="status"
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      className={cn(toastVariants({ variant: toast.variant }))}
    >
      <ToastIcon aria-hidden="true" className={cn(iconVariants({ variant: toast.variant }))} />
      <p className="flex-1 font-sans text-xs text-ink">{toast.message}</p>
      <button
        type="button"
        aria-label={t('aria.dismiss')}
        onClick={() => dismiss(toast.id)}
        className="mt-0.5 shrink-0 text-muted"
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  )
}

/**
 * Viewport global — una sola instancia, montada en `AppProviders` (no en
 * `AppShell`): `/login` y el registro de B-01 viven fuera del shell
 * protegido y también necesitan toasts.
 *
 * Múltiples toasts se apilan en columna sin superponerse (criterio del
 * issue) gracias al `flex flex-col gap-2` — cada uno mantiene su alto
 * natural. Posición: `bottom-16` en mobile para no tapar `BottomNav`
 * (visible por debajo de `lg`, ver `app-shell.tsx`), `lg:bottom-4` en
 * desktop donde la navegación es lateral, no inferior.
 */
export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-16 z-50 flex flex-col gap-2 lg:inset-x-auto lg:bottom-4 lg:right-4 lg:w-full lg:max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
