import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { IconContext } from '@phosphor-icons/react'
import { queryClient } from '@/shared/lib/query-client'
import { ToastViewport } from '@/shared/components/ui/toast'

/**
 * Peso de ícono global: fill — misma identidad visual que geoquest-web.
 *
 * `ToastViewport` (#16) vive acá y no en `AppShell`: `/login` y el registro
 * de B-01 (`routes.tsx`) están fuera del shell protegido y también
 * necesitan mostrar toasts.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <IconContext.Provider value={{ weight: 'fill' }}>
        {children}
        <ToastViewport />
      </IconContext.Provider>
    </QueryClientProvider>
  )
}
