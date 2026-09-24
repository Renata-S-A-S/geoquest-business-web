import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS, SEED_BUSINESS_STAFF_ME } from '@/shared/mocks/seed'
import { businessKeys, useBusinessMe, useBusinessStaffMe, useUpdateBusinessMe } from './queries'

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

  it('define "staffMe" como una key propia, distinta de "me" (#72, PR4)', () => {
    expect(businessKeys.staffMe).toEqual(['business-staff', 'me'])
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

describe('useBusinessStaffMe', () => {
  it('resuelve el BusinessStaffMe semilla contra el handler MSW real', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useBusinessStaffMe(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(SEED_BUSINESS_STAFF_ME)
  })

  it('usa la queryKey de businessKeys.staffMe', async () => {
    const { Wrapper, queryClient } = createWrapper()

    const { result } = renderHook(() => useBusinessStaffMe(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(businessKeys.staffMe)).toEqual(SEED_BUSINESS_STAFF_ME)
  })
})

/**
 * `useUpdateBusinessMe` (#72, PR5) — el hook diferido desde PR3/PR4, ahora
 * con su primer consumidor (`BusinessProfileForm`). Regla verificada del
 * Explorer (`edit-profile-page.tsx`, "save = setQueryData con la respuesta
 * del servidor, nunca optimista"): estos tres tests cubren exactamente esa
 * regla — éxito reemplaza la cache con el agregado completo, NADA la toca
 * antes de que el servidor responda, y un error la deja intacta.
 */
describe('useUpdateBusinessMe', () => {
  it('reemplaza businessKeys.me con el Business completo que devuelve el servidor tras un PATCH exitoso', async () => {
    const { Wrapper, queryClient } = createWrapper()
    queryClient.setQueryData(businessKeys.me, SEED_BUSINESS)

    const { result } = renderHook(() => useUpdateBusinessMe(), { wrapper: Wrapper })
    result.current.mutate({ displayName: 'Nuevo nombre' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(businessKeys.me)).toEqual({
      ...SEED_BUSINESS,
      displayName: 'Nuevo nombre',
    })
  })

  it('NO actualiza la cache de forma optimista: mientras el PATCH está pendiente, la cache sigue con el valor previo', async () => {
    let resolveRequest: (() => void) | undefined
    server.use(
      http.patch(`${API_BASE_URL}/business/me`, async () => {
        await new Promise<void>((resolve) => {
          resolveRequest = resolve
        })
        return HttpResponse.json({ ...SEED_BUSINESS, displayName: 'Nuevo nombre' })
      })
    )
    const { Wrapper, queryClient } = createWrapper()
    queryClient.setQueryData(businessKeys.me, SEED_BUSINESS)

    const { result } = renderHook(() => useUpdateBusinessMe(), { wrapper: Wrapper })
    result.current.mutate({ displayName: 'Nuevo nombre' })

    await waitFor(() => expect(result.current.isPending).toBe(true))
    expect(queryClient.getQueryData(businessKeys.me)).toEqual(SEED_BUSINESS)

    resolveRequest?.()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(businessKeys.me)).toEqual({
      ...SEED_BUSINESS,
      displayName: 'Nuevo nombre',
    })
  })

  it('propaga el error de un PATCH rechazado sin tocar la cache', async () => {
    server.use(
      http.patch(`${API_BASE_URL}/business/me`, () =>
        HttpResponse.json({ title: 'ValidationFailed', detail: 'Inválido' }, { status: 400 })
      )
    )
    const { Wrapper, queryClient } = createWrapper()
    queryClient.setQueryData(businessKeys.me, SEED_BUSINESS)

    const { result } = renderHook(() => useUpdateBusinessMe(), { wrapper: Wrapper })
    result.current.mutate({ displayName: 'Nuevo nombre' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(queryClient.getQueryData(businessKeys.me)).toEqual(SEED_BUSINESS)
  })
})
