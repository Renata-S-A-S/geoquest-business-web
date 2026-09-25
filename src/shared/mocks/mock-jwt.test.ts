import { describe, expect, it } from 'vitest'
import { createMockJwt } from './mock-jwt'
import { decodeJwtClaims } from '@/shared/lib/jwt-claims'

describe('createMockJwt', () => {
  it('produce un token con forma de JWT (3 partes separadas por punto)', () => {
    const token = createMockJwt({
      sub: '00000000-0000-0000-0000-000000000002',
      email: 'maria@cafe70.co',
      username: 'maria_cafe70',
    })

    expect(token.split('.')).toHaveLength(3)
  })

  it('el payload decodifica con jwt-claims.ts y expone las mismas claims que recibió', () => {
    const token = createMockJwt({
      sub: '00000000-0000-0000-0000-000000000002',
      email: 'maria@cafe70.co',
      username: 'maria_cafe70',
    })

    expect(decodeJwtClaims(token)).toEqual({ username: 'maria_cafe70', email: 'maria@cafe70.co' })
  })

  it('claims distintas producen un token distinto — triangulación contra el Fake It', () => {
    const token = createMockJwt({
      sub: '11111111-1111-1111-1111-111111111111',
      email: 'owner@otronegocio.com',
      username: 'owner_otro',
    })

    expect(decodeJwtClaims(token)).toEqual({
      username: 'owner_otro',
      email: 'owner@otronegocio.com',
    })
  })
})
