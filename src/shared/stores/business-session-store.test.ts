import { beforeEach, describe, expect, it } from 'vitest'
import { useBusinessSessionStore } from './business-session-store'
import type { AuthTokens } from '@/shared/schemas/auth'

const tokens: AuthTokens = {
  accessToken: 'access-1',
  accessTokenExpiresAtUtc: '2026-09-02T00:00:00Z',
  refreshToken: 'refresh-1',
  refreshTokenExpiresAtUtc: '2026-09-09T00:00:00Z',
}

describe('business-session-store', () => {
  beforeEach(() => {
    useBusinessSessionStore.setState({
      isAuthenticated: false,
      accessToken: null,
      accessTokenExpiresAtUtc: null,
      refreshToken: null,
      refreshTokenExpiresAtUtc: null,
    })
  })

  it('starts logged out', () => {
    const state = useBusinessSessionStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.accessToken).toBeNull()
    expect(state.refreshToken).toBeNull()
  })

  it('login() stores the full AuthTokens payload and flips isAuthenticated', () => {
    useBusinessSessionStore.getState().login(tokens)

    expect(useBusinessSessionStore.getState()).toMatchObject({
      isAuthenticated: true,
      accessToken: 'access-1',
      accessTokenExpiresAtUtc: '2026-09-02T00:00:00Z',
      refreshToken: 'refresh-1',
      refreshTokenExpiresAtUtc: '2026-09-09T00:00:00Z',
    })
  })

  it('logout() clears every token field and isAuthenticated', () => {
    useBusinessSessionStore.getState().login(tokens)

    useBusinessSessionStore.getState().logout()

    expect(useBusinessSessionStore.getState()).toMatchObject({
      isAuthenticated: false,
      accessToken: null,
      accessTokenExpiresAtUtc: null,
      refreshToken: null,
      refreshTokenExpiresAtUtc: null,
    })
  })
})
