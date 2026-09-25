import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { realSessionPort } from './session-port.real'
import { API_BASE_URL } from '@/shared/lib/env'
import { useBusinessSessionStore } from '@/shared/stores/business-session-store'
import { createMockJwt } from '@/shared/mocks/mock-jwt'

const freshTokens = {
  accessToken: 'fresh-access',
  accessTokenExpiresAtUtc: '2026-09-02T01:00:00Z',
  refreshToken: 'fresh-refresh',
  refreshTokenExpiresAtUtc: '2026-09-09T00:00:00Z',
}

function seedSession(refreshToken: string | null) {
  useBusinessSessionStore.setState({
    isAuthenticated: refreshToken !== null,
    accessToken: refreshToken ? 'stale-access' : null,
    accessTokenExpiresAtUtc: null,
    refreshToken,
    refreshTokenExpiresAtUtc: null,
  })
}

describe('realSessionPort', () => {
  beforeEach(() => {
    seedSession(null)
  })

  it('getAccessToken() lee del store real, no del store del mock', () => {
    seedSession('some-refresh')
    expect(realSessionPort.getAccessToken()).toBe('stale-access')
  })

  it('isAuthenticated() refleja el store real', () => {
    expect(realSessionPort.isAuthenticated()).toBe(false)
    seedSession('some-refresh')
    expect(realSessionPort.isAuthenticated()).toBe(true)
  })

  it('refresh() rechaza si no hay refresh token', async () => {
    await expect(realSessionPort.refresh()).rejects.toThrow('no hay refresh token')
  })

  it('refresh() llama a POST /auth/refresh con { refreshToken } y guarda los tokens nuevos', async () => {
    seedSession('old-refresh')
    let receivedBody: unknown
    server.use(
      http.post(`${API_BASE_URL}/auth/refresh`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json(freshTokens)
      })
    )

    const accessToken = await realSessionPort.refresh()

    expect(receivedBody).toEqual({ refreshToken: 'old-refresh' })
    expect(accessToken).toBe(freshTokens.accessToken)
    expect(useBusinessSessionStore.getState()).toMatchObject({
      isAuthenticated: true,
      accessToken: freshTokens.accessToken,
      refreshToken: freshTokens.refreshToken,
    })
  })

  it('refresh() propaga el error si el backend responde 401 y no toca el store', async () => {
    seedSession('expired-refresh')
    server.use(
      http.post(`${API_BASE_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 }))
    )

    await expect(realSessionPort.refresh()).rejects.toBeTruthy()
    // El store conserva el refresh token viejo — signOut() es responsabilidad
    // del caller (session-interceptor.ts), no de refresh() en sí.
    expect(useBusinessSessionStore.getState().refreshToken).toBe('expired-refresh')
  })

  it('refresh() rechaza si el backend responde una forma inválida (zod)', async () => {
    seedSession('old-refresh')
    server.use(http.post(`${API_BASE_URL}/auth/refresh`, () => HttpResponse.json({ nope: true })))

    await expect(realSessionPort.refresh()).rejects.toBeTruthy()
  })

  it('signOut() limpia el store real', () => {
    seedSession('some-refresh')

    realSessionPort.signOut()

    expect(useBusinessSessionStore.getState()).toMatchObject({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
    })
  })

  /**
   * `getIdentityClaims()` (spec "session-identity") decodifica el
   * `accessToken` del store real — issue #1547. Solo lo hace `realSessionPort`
   * porque es el puerto activo en AMBOS modos (`session-port.instance.ts`).
   */
  it('getIdentityClaims() decodifica el JWT del access token real', () => {
    const token = createMockJwt({
      sub: '00000000-0000-0000-0000-000000000002',
      email: 'maria@cafe70.co',
      username: 'maria_cafe70',
    })
    useBusinessSessionStore.setState({
      isAuthenticated: true,
      accessToken: token,
      accessTokenExpiresAtUtc: null,
      refreshToken: 'some-refresh',
      refreshTokenExpiresAtUtc: null,
    })

    expect(realSessionPort.getIdentityClaims()).toEqual({
      username: 'maria_cafe70',
      email: 'maria@cafe70.co',
    })
  })

  it('getIdentityClaims() devuelve null si no hay sesión (sin access token)', () => {
    expect(realSessionPort.getIdentityClaims()).toBeNull()
  })

  it('getIdentityClaims() devuelve null si el access token no es un JWT válido', () => {
    useBusinessSessionStore.setState({
      isAuthenticated: true,
      accessToken: 'opaque-token-sin-forma-de-jwt',
      accessTokenExpiresAtUtc: null,
      refreshToken: 'some-refresh',
      refreshTokenExpiresAtUtc: null,
    })

    expect(realSessionPort.getIdentityClaims()).toBeNull()
  })

  it('subscribe() se suscribe al store real y el unsubscribe funciona', () => {
    let calls = 0
    const unsubscribe = realSessionPort.subscribe(() => {
      calls += 1
    })

    seedSession('a-refresh')
    expect(calls).toBeGreaterThan(0)

    const callsAfterFirstChange = calls
    unsubscribe()
    seedSession(null)
    expect(calls).toBe(callsAfterFirstChange)
  })
})
