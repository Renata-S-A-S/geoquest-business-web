import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { setMockBusiness } from '@/test/mock-business'
import { BUSINESS_WRITE_BLOCK_ID, useBusinessAccess } from './use-business-access'

/** Mismo patrón que `queries.dom.test.tsx` — un `QueryClient` fresco por test, sin `retry`. */
function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return { Wrapper }
}

describe('useBusinessAccess', () => {
  it('permite escribir y no da motivo cuando el negocio está Active', async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useBusinessAccess(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.canWrite).toBe(true))
    expect(result.current.reason).toBeUndefined()
    expect(result.current.bannerId).toBe(BUSINESS_WRITE_BLOCK_ID)
  })

  it('bloquea la escritura con motivo "paused" cuando el negocio está Paused', async () => {
    setMockBusiness('Paused')
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useBusinessAccess(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.reason).toBe('paused'))
    expect(result.current.canWrite).toBe(false)
  })

  it('bloquea la escritura con motivo "suspended" cuando el negocio está Suspended', async () => {
    setMockBusiness('Suspended')
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useBusinessAccess(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.reason).toBe('suspended'))
    expect(result.current.canWrite).toBe(false)
  })
})
