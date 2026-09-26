import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { setMockBusiness } from '@/test/mock-business'
import { BUSINESS_WRITE_BLOCK_ID } from './use-business-access'
import { useWriteGuard } from './use-write-guard'

/** Mismo patrón que `use-business-access.dom.test.tsx`. */
function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return { Wrapper }
}

describe('useWriteGuard', () => {
  it('no bloquea y no da id de motivo cuando el negocio está Active', async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useWriteGuard(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.disabled).toBe(false))
    expect(result.current.describedBy).toBeUndefined()
  })

  it('bloquea y apunta al banner cuando el negocio está Paused', async () => {
    setMockBusiness('Paused')
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useWriteGuard(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.disabled).toBe(true))
    expect(result.current.describedBy).toBe(BUSINESS_WRITE_BLOCK_ID)
  })

  it('bloquea y apunta al banner cuando el negocio está Suspended', async () => {
    setMockBusiness('Suspended')
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useWriteGuard(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.disabled).toBe(true))
    expect(result.current.describedBy).toBe(BUSINESS_WRITE_BLOCK_ID)
  })
})
