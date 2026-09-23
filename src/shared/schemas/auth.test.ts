import { describe, expect, it } from 'vitest'
import { authTokensSchema, loginInputSchema } from './auth'

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

describe('loginInputSchema', () => {
  const validInput = { email: 'maria@cafe70.co', password: 'geoquest-demo' }

  it('parses a valid email/password pair', () => {
    expect(loginInputSchema.parse(validInput)).toEqual(validInput)
  })

  it('rejects an empty email with too_small', () => {
    const result = loginInputSchema.safeParse({ ...validInput, email: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe('too_small')
    }
  })

  it('rejects a malformed email with invalid_string', () => {
    const result = loginInputSchema.safeParse({ ...validInput, email: 'not-an-email' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe('invalid_string')
    }
  })

  it('rejects an empty password', () => {
    const result = loginInputSchema.safeParse({ ...validInput, password: '' })
    expect(result.success).toBe(false)
  })
})
