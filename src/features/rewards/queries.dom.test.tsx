import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS, SEED_REWARDS } from '@/shared/mocks/seed'
import { placeKeys } from '@/features/places/queries'
import { businessKeys } from '@/features/business/queries'
import { rewardKeys, usePauseReward, useRewards } from './queries'

const businessId = SEED_BUSINESS.id
const REWARDS_URL = `${API_BASE_URL}/portal/businesses/${businessId}/rewards`

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return { Wrapper, queryClient }
}

describe('rewardKeys', () => {
  it('expone "list" scopeada por negocio', () => {
    expect(rewardKeys.list(businessId)).toEqual(['rewards', businessId, 'list'])
  })

  /**
   * Sin el `businessId` en la key, un dueño con dos negocios vería la cache
   * del primero al abrir el segundo. `GET /business/mine` del backend
   * devuelve un array justamente porque ese caso existe.
   */
  it('separa la cache de dos negocios distintos', () => {
    expect(rewardKeys.list('negocio-a')).not.toEqual(rewardKeys.list('negocio-b'))
  })

  /**
   * `all` tiene que ser prefijo de `list` para que invalidar el prefijo
   * después de una escritura alcance al listado y al detalle a la vez.
   */
  it('deja "all" como prefijo real de "list"', () => {
    const list = rewardKeys.list(businessId)

    expect(list.slice(0, rewardKeys.all.length)).toEqual([...rewardKeys.all])
  })

  /**
   * Cada slice invalida lo suyo. Si compartieran raíz, invalidar el perfil
   * del negocio arrastraría las recompensas y los lugares sin que nadie lo
   * haya pedido.
   */
  it('no comparte prefijo con las keys de business ni de places', () => {
    expect(rewardKeys.list(businessId)[0]).not.toBe(businessKeys.mine[0])
    expect(rewardKeys.list(businessId)[0]).not.toBe(placeKeys.list[0])
  })
})

describe('useRewards', () => {
  it('resuelve las recompensas semilla contra el handler MSW real', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useRewards(businessId), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((r) => r.title)).toEqual(SEED_REWARDS.map((r) => r.title))
  })

  it('usa la queryKey de rewardKeys.list', async () => {
    const { Wrapper, queryClient } = createWrapper()

    const { result } = renderHook(() => useRewards(businessId), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(rewardKeys.list(businessId))).toEqual(result.current.data)
  })

  it('expone el error cuando el backend falla, sin reintentar hacia un estado vacío', async () => {
    server.use(
      http.get(REWARDS_URL, () => HttpResponse.json({ title: 'InternalError' }, { status: 500 }))
    )
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useRewards(businessId), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  /**
   * El contrato del `enabled`: sin `businessId` no hay path que llamar, así
   * que la query no debe dispararse. Queda `isPending` con `fetchStatus`
   * 'idle', y es POR ESO que el contenedor tiene que forkear también sobre la
   * query del negocio — si no, un `/business/me` caído se vería como un
   * spinner eterno en vez de un error.
   */
  it('no dispara ningún request mientras el businessId no está resuelto', async () => {
    let requestCount = 0
    server.use(
      http.get(REWARDS_URL, () => {
        requestCount += 1
        return HttpResponse.json([])
      })
    )
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useRewards(undefined), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(result.current.isPending).toBe(true)
    expect(requestCount).toBe(0)
  })

  it('aplica staleTime: un segundo mount dentro de la ventana no dispara un nuevo request', async () => {
    let requestCount = 0
    server.use(
      http.get(REWARDS_URL, () => {
        requestCount += 1
        return HttpResponse.json([])
      })
    )
    const { Wrapper, queryClient } = createWrapper()

    const first = renderHook(() => useRewards(businessId), { wrapper: Wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    expect(requestCount).toBe(1)

    function SecondWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    const second = renderHook(() => useRewards(businessId), { wrapper: SecondWrapper })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    expect(requestCount).toBe(1)
  })
})

/**
 * Lo que se verifica acá no es que la mutación funcione (eso lo cubre el test
 * de transporte) sino que invalide el PREFIJO y no solo el detalle. Es la
 * diferencia entre que el listado refleje el estado nuevo o se quede con el
 * anterior hasta el próximo refetch — justo cuando el negocio vuelve al
 * listado para confirmar que su acción surtió efecto.
 */
describe('usePauseReward', () => {
  it('invalida el prefijo completo, alcanzando al listado y al detalle', async () => {
    const { Wrapper, queryClient } = createWrapper()
    queryClient.setQueryData(rewardKeys.list(businessId), [])
    queryClient.setQueryData(rewardKeys.detail(businessId, SEED_REWARDS[0].rewardId), {})

    const { result } = renderHook(() => usePauseReward(businessId, SEED_REWARDS[0].rewardId), {
      wrapper: Wrapper,
    })
    result.current.mutate(undefined)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await waitFor(() => {
      expect(queryClient.getQueryState(rewardKeys.list(businessId))?.isInvalidated).toBe(true)
      expect(
        queryClient.getQueryState(rewardKeys.detail(businessId, SEED_REWARDS[0].rewardId))
          ?.isInvalidated
      ).toBe(true)
    })
  })
})
