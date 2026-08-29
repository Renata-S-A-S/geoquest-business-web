import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { IconContext } from '@phosphor-icons/react'
import { queryClient } from '@/shared/lib/query-client'

/** Peso de ícono global: fill — misma identidad visual que geoquest-web. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <IconContext.Provider value={{ weight: 'fill' }}>{children}</IconContext.Provider>
    </QueryClientProvider>
  )
}
