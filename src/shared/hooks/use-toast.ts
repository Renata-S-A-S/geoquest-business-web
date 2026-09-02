import { useCallback } from 'react'
import { useToastStore, type ToastVariant } from '@/shared/stores/toast-store'

/**
 * API de conveniencia sobre `toast-store.ts` — issue #16. Cualquier
 * formulario o acción del portal (#21, #30, #37-42, #46, "publicar",
 * "confirmar canje", ...) llama `useToast().success(...)` /`.error(...)`
 * en vez de hablar con el store directamente, igual que `useSession()`
 * envuelve `sessionPort`.
 *
 * Las funciones se memoizan con `useCallback` sobre `show` (la acción del
 * store de Zustand, referencia estable entre renders) para que puedan
 * usarse como dependencia de un `useEffect` sin re-disparar en cada render.
 */
export function useToast() {
  const show = useToastStore((state) => state.show)
  const dismiss = useToastStore((state) => state.dismiss)

  const toast = useCallback(
    (variant: ToastVariant, message: string, duration?: number) =>
      show({ variant, message, duration }),
    [show]
  )

  const success = useCallback(
    (message: string, duration?: number) => show({ variant: 'success', message, duration }),
    [show]
  )

  const error = useCallback(
    (message: string, duration?: number) => show({ variant: 'error', message, duration }),
    [show]
  )

  const info = useCallback(
    (message: string, duration?: number) => show({ variant: 'info', message, duration }),
    [show]
  )

  return { toast, success, error, info, dismiss }
}
