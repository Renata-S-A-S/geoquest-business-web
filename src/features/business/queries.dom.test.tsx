import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { setMockBusiness } from '@/test/mock-business'
import { SEED_BUSINESS_SCENARIOS } from '@/shared/mocks/seed'
import { businessKeys, useMyBusiness } from './queries'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return { Wrapper, queryClient }
}

describe('useMyBusiness', () => {
  it('resuelve el primer elemento y cachea el array completo bajo businessKeys.mine', async () => {
    const { Wrapper, queryClient } = createWrapper()

    const { result } = renderHook(() => useMyBusiness(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(SEED_BUSINESS_SCENARIOS.Active)
    expect(queryClient.getQueryData(businessKeys.mine)).toEqual([SEED_BUSINESS_SCENARIOS.Active])
  })

  it('resuelve null cuando /business/mine devuelve [] (escenario none)', async () => {
    setMockBusiness('none')
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useMyBusiness(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })
})
