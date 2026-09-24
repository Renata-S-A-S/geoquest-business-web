import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_REWARDS } from '@/shared/mocks/seed'
import { placeKeys } from '@/features/places/queries'
import { businessKeys } from '@/features/business/queries'
import { rewardKeys, useRewards } from './queries'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return { Wrapper, queryClient }
}

describe('rewardKeys', () => {
  it('expone "list" como una key propia de la slice rewards', () => {
    expect(rewardKeys.list).toEqual(['rewards', 'list'])
  })

  /**
   * Cada slice invalida lo suyo. Si compartieran raíz, invalidar el perfil
   * del negocio arrastraría las recompensas y los lugares sin que nadie lo
   * haya pedido.
   */
  it('no comparte prefijo con las keys de business ni de places', () => {
    expect(rewardKeys.list[0]).not.toBe(businessKeys.me[0])
    expect(rewardKeys.list[0]).not.toBe(placeKeys.list[0])
  })
})

describe('useRewards', () => {
  it('resuelve las recompensas semilla contra el handler MSW real', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useRewards(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((r) => r.title)).toEqual(SEED_REWARDS.map((r) => r.title))
  })

  it('usa la queryKey de rewardKeys.list', async () => {
    const { Wrapper, queryClient } = createWrapper()

    const { result } = renderHook(() => useRewards(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(rewardKeys.list)).toEqual(result.current.data)
  })

  it('expone el error cuando el backend falla, sin reintentar hacia un estado vacío', async () => {
    server.use(
      http.get(`${API_BASE_URL}/portal/rewards`, () =>
        HttpResponse.json({ title: 'InternalError' }, { status: 500 })
      )
    )
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useRewards(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it('aplica staleTime: un segundo mount dentro de la ventana no dispara un nuevo request', async () => {
    let requestCount = 0
    server.use(
      http.get(`${API_BASE_URL}/portal/rewards`, () => {
        requestCount += 1
        return HttpResponse.json([])
      })
    )
    const { Wrapper, queryClient } = createWrapper()

    const first = renderHook(() => useRewards(), { wrapper: Wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    expect(requestCount).toBe(1)

    function SecondWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    const second = renderHook(() => useRewards(), { wrapper: SecondWrapper })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    expect(requestCount).toBe(1)
  })
})
