import { describe, expect, it } from 'vitest'
import { authTokensSchema } from './auth'

const baseTokens = {
  accessToken: 'access-token-value',
  accessTokenExpiresAtUtc: '2026-09-02T00:00:00Z',
  refreshToken: 'refresh-token-value',
  refreshTokenExpiresAtUtc: '2026-09-09T00:00:00Z',
}

describe('authTokensSchema', () => {
  it('parses a valid AuthTokens payload', () => {
    expect(authTokensSchema.parse(baseTokens)).toEqual(baseTokens)
  })

  it('rejects a payload missing accessToken', () => {
    const { accessToken: _accessToken, ...rest } = baseTokens
    expect(() => authTokensSchema.parse(rest)).toThrow()
  })

  it('rejects a payload missing refreshToken', () => {
    const { refreshToken: _refreshToken, ...rest } = baseTokens
    expect(() => authTokensSchema.parse(rest)).toThrow()
  })

  it('rejects non-ISO8601 expiry timestamps', () => {
    expect(() =>
      authTokensSchema.parse({ ...baseTokens, accessTokenExpiresAtUtc: 'not-a-date' })
    ).toThrow()
  })
})
