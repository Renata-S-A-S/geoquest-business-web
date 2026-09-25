import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { setMockBusiness } from '@/test/mock-business'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS, SEED_BUSINESS_SCENARIOS } from '@/shared/mocks/seed'
import { businessKeys, useBusinessMe, useMyBusiness } from './queries'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return { Wrapper, queryClient }
}

describe('businessKeys', () => {
  it('mantiene la key de "me" idéntica al literal que usaba pending-page.tsx (anti-drift: la migración no cambia la cache)', () => {
    expect(businessKeys.me).toEqual(['business', 'me'])
  })
})

describe('useBusinessMe', () => {
  it('resuelve el Business semilla contra el handler MSW real', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useBusinessMe(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(SEED_BUSINESS)
  })

  it('usa la queryKey de businessKeys.me', async () => {
    const { Wrapper, queryClient } = createWrapper()

    const { result } = renderHook(() => useBusinessMe(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(businessKeys.me)).toEqual(SEED_BUSINESS)
  })

  it('aplica staleTime: un segundo mount dentro de la ventana no dispara un nuevo request', async () => {
    let requestCount = 0
    server.use(
      http.get(`${API_BASE_URL}/business/me`, () => {
        requestCount += 1
        return HttpResponse.json(SEED_BUSINESS)
      })
    )
    const { Wrapper, queryClient } = createWrapper()

    const first = renderHook(() => useBusinessMe(), { wrapper: Wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    expect(requestCount).toBe(1)

    function SecondWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    const second = renderHook(() => useBusinessMe(), { wrapper: SecondWrapper })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    expect(requestCount).toBe(1)
  })
})

describe('useMyBusiness', () => {
  it('resuelve el primer elemento del array (escenario Active por defecto)', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useMyBusiness(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(SEED_BUSINESS_SCENARIOS.Active)
  })

  it('resuelve null cuando /business/mine devuelve [] (escenario none)', async () => {
    setMockBusiness('none')
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useMyBusiness(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('cachea el array completo bajo businessKeys.mine, no solo el primer elemento', async () => {
    const { Wrapper, queryClient } = createWrapper()

    const { result } = renderHook(() => useMyBusiness(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(businessKeys.mine)).toEqual([SEED_BUSINESS_SCENARIOS.Active])
  })
})
