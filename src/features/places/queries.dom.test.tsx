import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_PLACES } from '@/shared/mocks/seed'
import { resetDb, readDb, writeDb } from '@/shared/mocks/db'
import { placeKeys, usePlace, usePlaces, usePublishPlace } from './queries'

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
    // Resumen, no detalle: la lista del backend trae 7 campos.
    expect(result.current.data?.map((p) => p.name)).toEqual(SEED_PLACES.map((p) => p.name))
  })

  it('usa la queryKey de placeKeys.list', async () => {
    const { Wrapper, queryClient } = createWrapper()

    const { result } = renderHook(() => usePlaces(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(placeKeys.list)).toEqual(result.current.data)
  })

  it('expone el error cuando el backend falla, sin reintentar en silencio hacia un estado vacío', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/places`, () =>
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
      http.get(`${API_BASE_URL}/business/places`, () => {
        requestCount += 1
        return HttpResponse.json([])
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

/**
 * `usePublishPlace` invalida **todo el prefijo `['places']`**, no solo el
 * detalle. Esa conducta estaba documentada como importante y no tenía ni un
 * test: si solo invalidara el detalle, el listado seguiría mostrando
 * «Borrador» sobre un lugar ya activo, y el negocio no tendría ningún motivo
 * para dudar de lo que ve.
 *
 * El test usa UN solo `QueryClient` con las dos consultas montadas, porque es
 * la única forma de probar que la invalidación cruza de una a la otra — cada
 * test de componente usa su cliente aislado, así que ninguno lo demostraba.
 */
describe('usePublishPlace — invalidación cruzada', () => {
  it('refresca el listado Y el detalle tras publicar', async () => {
    resetDb()
    // La semilla deja el borrador sin fotos; publicar exige al menos una.
    const db = readDb()
    const draft = db.places.find((place) => place.status === 'Draft')!
    draft.photos = ['https://cdn.example/a.jpg']
    writeDb(db)

    const { Wrapper } = createWrapper()
    const rendered = renderHook(
      () => ({
        list: usePlaces(),
        detail: usePlace(draft.placeId),
        publish: usePublishPlace(),
      }),
      { wrapper: Wrapper }
    )

    await waitFor(() => {
      expect(rendered.result.current.list.isSuccess).toBe(true)
      expect(rendered.result.current.detail.isSuccess).toBe(true)
    })

    const statusInListBefore = rendered.result.current.list.data?.find(
      (place) => place.placeId === draft.placeId
    )?.status
    expect(statusInListBefore).toBe('Draft')
    expect(rendered.result.current.detail.data?.status).toBe('Draft')

    rendered.result.current.publish.mutate(draft.placeId)

    await waitFor(() => expect(rendered.result.current.publish.isSuccess).toBe(true))

    // Las DOS consultas tienen que reflejar el estado nuevo.
    await waitFor(() => {
      const statusInList = rendered.result.current.list.data?.find(
        (place) => place.placeId === draft.placeId
      )?.status
      expect(statusInList).toBe('Active')
      expect(rendered.result.current.detail.data?.status).toBe('Active')
    })
  })
})
