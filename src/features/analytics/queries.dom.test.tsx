import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS, SEED_PLACES, SEED_REWARDS } from '@/shared/mocks/seed'
import { buildMockAnalyticsSummary } from '@/shared/mocks/analytics.mock'
import { analyticsKeys, useAnalyticsCheckIns, useAnalyticsSummary } from './queries'

const RANGE = { from: '2026-08-26', to: '2026-09-24' }
const ANALYTICS_BASE = `${API_BASE_URL}/portal/businesses/${SEED_BUSINESS.id}/analytics`

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return { Wrapper, queryClient }
}

describe('analyticsKeys', () => {
  it('usa un prefijo propio y no comparte raíz con businessKeys', () => {
    const key = analyticsKeys.summary(SEED_BUSINESS.id, RANGE)

    expect(key[0]).toBe('analytics')
    expect(key[0]).not.toBe('business')
  })

  /**
   * El bug clásico de un dashboard con filtros: si el rango no forma parte de
   * la key, cambiar el período devuelve la cache del período anterior y el
   * negocio lee números que no corresponden al rótulo que tiene delante.
   */
  it('incluye businessId, from y to: dos períodos distintos son dos entradas de cache distintas', () => {
    const thirtyDays = analyticsKeys.summary(SEED_BUSINESS.id, RANGE)
    const sevenDays = analyticsKeys.summary(SEED_BUSINESS.id, {
      from: '2026-09-18',
      to: '2026-09-24',
    })

    expect(thirtyDays).toEqual([
      'analytics',
      'summary',
      SEED_BUSINESS.id,
      '2026-08-26',
      '2026-09-24',
    ])
    expect(sevenDays).not.toEqual(thirtyDays)
  })

  it('summary y check-ins no comparten key: son dos recursos distintos', () => {
    expect(analyticsKeys.summary(SEED_BUSINESS.id, RANGE)).not.toEqual(
      analyticsKeys.checkIns(SEED_BUSINESS.id, RANGE)
    )
  })
})

describe('useAnalyticsSummary', () => {
  it('resuelve el resumen del mock y lo guarda bajo su propia key', async () => {
    const { Wrapper, queryClient } = createWrapper()

    const { result } = renderHook(() => useAnalyticsSummary(SEED_BUSINESS.id, RANGE), {
      wrapper: Wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(buildMockAnalyticsSummary(RANGE, SEED_PLACES, SEED_REWARDS))
    expect(queryClient.getQueryData(analyticsKeys.summary(SEED_BUSINESS.id, RANGE))).toBeDefined()
  })

  /**
   * El path de los endpoints propuestos exige `{businessId}` y el portal tiene
   * que resolverlo antes vía `GET /business/me`. Sin este `enabled`, el primer
   * render dispararía un request contra `/portal/businesses/undefined/...`, un
   * 404 garantizado que además dejaría un error en pantalla.
   */
  it('no dispara ningún request mientras el businessId no está resuelto', async () => {
    let requestCount = 0
    server.use(
      http.get(`${ANALYTICS_BASE}/summary`, () => {
        requestCount += 1
        return HttpResponse.json(buildMockAnalyticsSummary(RANGE, SEED_PLACES, SEED_REWARDS))
      })
    )
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useAnalyticsSummary(undefined, RANGE), {
      wrapper: Wrapper,
    })

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(result.current.isPending).toBe(true)
    expect(requestCount).toBe(0)
  })

  it('aplica staleTime: un segundo mount dentro de la ventana no dispara otro request', async () => {
    let requestCount = 0
    server.use(
      http.get(`${ANALYTICS_BASE}/summary`, () => {
        requestCount += 1
        return HttpResponse.json(buildMockAnalyticsSummary(RANGE, SEED_PLACES, SEED_REWARDS))
      })
    )
    const { Wrapper, queryClient } = createWrapper()

    const first = renderHook(() => useAnalyticsSummary(SEED_BUSINESS.id, RANGE), {
      wrapper: Wrapper,
    })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    expect(requestCount).toBe(1)

    function SecondWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    const second = renderHook(() => useAnalyticsSummary(SEED_BUSINESS.id, RANGE), {
      wrapper: SecondWrapper,
    })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    expect(requestCount).toBe(1)
  })

  it('propaga el error cuando el endpoint propuesto rechaza el rango', async () => {
    server.use(
      http.get(`${ANALYTICS_BASE}/summary`, () =>
        HttpResponse.json({ title: 'Analytics.InvalidRange', status: 400 }, { status: 400 })
      )
    )
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useAnalyticsSummary(SEED_BUSINESS.id, RANGE), {
      wrapper: Wrapper,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useAnalyticsCheckIns', () => {
  it('resuelve una serie con un punto por día del rango', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useAnalyticsCheckIns(SEED_BUSINESS.id, RANGE), {
      wrapper: Wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.granularity).toBe('day')
    expect(result.current.data?.points).toHaveLength(30)
  })

  /**
   * `keepPreviousData` es lo que mantiene la vista montada al cambiar de
   * período: sin él el contenedor cae a su rama de carga, desmonta el `Select`
   * que el usuario acaba de usar y le roba el foco de teclado.
   */
  it('mantiene los datos del período anterior en pantalla mientras llega el nuevo', async () => {
    const { Wrapper } = createWrapper()

    const { result, rerender } = renderHook(
      ({ range }: { range: { from: string; to: string } }) =>
        useAnalyticsCheckIns(SEED_BUSINESS.id, range),
      { wrapper: Wrapper, initialProps: { range: RANGE } }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    rerender({ range: { from: '2026-09-18', to: '2026-09-24' } })

    // Nunca queda sin datos: los 30 puntos previos siguen ahí y la consulta se
    // marca como placeholder hasta que llegan los 7 nuevos.
    expect(result.current.data).toBeDefined()
    await waitFor(() => expect(result.current.data?.points).toHaveLength(7))
    expect(result.current.isPlaceholderData).toBe(false)
  })

  it('no dispara ningún request mientras el businessId no está resuelto', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useAnalyticsCheckIns(undefined, RANGE), {
      wrapper: Wrapper,
    })

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(result.current.data).toBeUndefined()
  })
})
