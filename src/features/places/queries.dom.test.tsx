import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_PLACES } from '@/shared/mocks/seed'
import { placeKeys, usePlaces } from './queries'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return { Wrapper, queryClient }
}

describe('placeKeys', () => {
  it('expone "list" como una key propia de la slice places', () => {
    expect(placeKeys.list).toEqual(['places', 'list'])
  })

  it('NO colisiona con la key de la slice business (cada slice invalida lo suyo)', () => {
    expect(placeKeys.list[0]).not.toBe('business')
  })
})

describe('usePlaces', () => {
  it('resuelve los lugares semilla contra el handler MSW real', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => usePlaces(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(SEED_PLACES)
  })

  it('usa la queryKey de placeKeys.list', async () => {
    const { Wrapper, queryClient } = createWrapper()

    const { result } = renderHook(() => usePlaces(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(placeKeys.list)).toEqual(SEED_PLACES)
  })

  it('expone el error cuando el backend falla, sin reintentar en silencio hacia un estado vacío', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/me/places`, () =>
        HttpResponse.json({ title: 'InternalError' }, { status: 500 })
      )
    )
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => usePlaces(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it('aplica staleTime: un segundo mount dentro de la ventana no dispara un nuevo request', async () => {
    let requestCount = 0
    server.use(
      http.get(`${API_BASE_URL}/business/me/places`, () => {
        requestCount += 1
        return HttpResponse.json(SEED_PLACES)
      })
    )
    const { Wrapper, queryClient } = createWrapper()

    const first = renderHook(() => usePlaces(), { wrapper: Wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    expect(requestCount).toBe(1)

    function SecondWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    const second = renderHook(() => usePlaces(), { wrapper: SecondWrapper })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    expect(requestCount).toBe(1)
  })
})
