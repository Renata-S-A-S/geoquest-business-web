import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  variant: ToastVariant
  message: string
  duration: number
}

interface ToastState {
  toasts: Toast[]
  show: (toast: { variant: ToastVariant; message: string; duration?: number }) => string
  dismiss: (id: string) => void
}

/** Default pedido por el issue #16: "~4000ms". */
const DEFAULT_DURATION_MS = 4000

/**
 * Store del sistema de toasts — issue #16 del slice 004c-business-portal-flows.
 *
 * No persistido (a diferencia de `session-store.ts`): un toast no debe
 * sobrevivir a un reload, y F5 durante un formulario ya interrumpe el flujo
 * de todas formas. `show` genera su propio id (así el caller no coordina
 * unicidad) y lo devuelve, por si quiere descartarlo antes de que expire
 * (ej. reemplazar un toast de "guardando…" por el de éxito).
 *
 * Vive en `stores/`, no en `hooks/`, porque el estado es realmente global y
 * compartido entre `ToastViewport` (única instancia, montada en
 * `AppProviders`) y cualquier feature que llame `useToast()` — mismo
 * criterio que `session-store.ts`/`use-session.ts`.
 */
export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  show: ({ variant, message, duration = DEFAULT_DURATION_MS }) => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { id, variant, message, duration }] }))
    return id
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))
