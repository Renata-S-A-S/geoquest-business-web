import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { apiClient } from '@/shared/lib/api-client'
import { API_BASE_URL } from '@/shared/lib/env'
import { useBusinessSessionStore } from '@/shared/stores/business-session-store'
import { useToastStore } from '@/shared/stores/toast-store'

/**
 * Prueba la costura REAL entre `session-interceptor.ts` y `toast-store.ts`
 * que `session-interceptor.test.ts` deja fuera a propósito (usa un
 * `SessionPort` falso y nunca importa el store de toasts, ver su propio
 * comentario) — spec "session-expiry" (#1547): el toast tiene que verse
 * ANTES del redirect forzado a `/login`.
 */
function seedActiveSession() {
  useBusinessSessionStore.setState({
    isAuthenticated: true,
    accessToken: 'stale-access',
    accessTokenExpiresAtUtc: null,
    refreshToken: 'stale-refresh',
    refreshTokenExpiresAtUtc: null,
  })
}

describe('apiClient — toast de sesión expirada', () => {
  beforeEach(() => {
    seedActiveSession()
    useToastStore.setState({ toasts: [] })
  })

  afterEach(() => {
    useBusinessSessionStore.getState().logout()
  })

  it('muestra un toast info y cierra la sesión cuando el refresh falla tras un 401', async () => {
    server.use(
      http.get(
        `${API_BASE_URL}/some-protected-resource`,
        () => new HttpResponse(null, { status: 401 })
      ),
      http.post(`${API_BASE_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 }))
    )

    await expect(apiClient.get('/some-protected-resource')).rejects.toMatchObject({
      response: { status: 401 },
    })

    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatchObject({
      variant: 'info',
      message: 'Tu sesión expiró. Iniciá sesión de nuevo.',
    })
    expect(useBusinessSessionStore.getState().isAuthenticated).toBe(false)
  })

  it('NO muestra el toast si el refresh tiene éxito — la sesión sigue viva', async () => {
    server.use(
      http.get(`${API_BASE_URL}/some-protected-resource`, ({ request }) =>
        request.headers.get('Authorization') === 'Bearer fresh-access'
          ? HttpResponse.json({ ok: true })
          : new HttpResponse(null, { status: 401 })
      ),
      http.post(`${API_BASE_URL}/auth/refresh`, () =>
        HttpResponse.json({
          accessToken: 'fresh-access',
          accessTokenExpiresAtUtc: '2026-09-02T01:00:00Z',
          refreshToken: 'fresh-refresh',
          refreshTokenExpiresAtUtc: '2026-09-09T00:00:00Z',
        })
      )
    )

    await apiClient.get('/some-protected-resource')

    expect(useToastStore.getState().toasts).toHaveLength(0)
    expect(useBusinessSessionStore.getState().isAuthenticated).toBe(true)
  })
})
