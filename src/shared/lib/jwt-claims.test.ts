import { describe, expect, it } from 'vitest'
import { decodeJwtClaims } from './jwt-claims'

/**
 * Arma un JWT con FORMA válida (header.payload.firma, base64url) sin firmar
 * de verdad — este archivo prueba el DECODER, no la emisión de tokens (esa
 * vive en `shared/mocks/mock-jwt.ts`, mock-only). Encoder local a propósito:
 * mantiene la prueba independiente de cómo el resto de la app arma tokens.
 */
function encodeBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildJwt(payload: unknown): string {
  const header = encodeBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const body = encodeBase64Url(JSON.stringify(payload))
  return `${header}.${body}.fake-signature`
}

describe('decodeJwtClaims', () => {
  it('decodifica sub/email/username del payload real de Identity (JwtTokenService.cs)', () => {
    const token = buildJwt({
      sub: '00000000-0000-0000-0000-000000000002',
      email: 'maria@cafe70.co',
      username: 'maria_cafe70',
      auth_provider: 'Local',
      jti: 'a-jti',
    })

    expect(decodeJwtClaims(token)).toEqual({
      username: 'maria_cafe70',
      email: 'maria@cafe70.co',
    })
  })

  it('decodifica un payload distinto con otro username/email — triangulación contra el Fake It', () => {
    const token = buildJwt({
      sub: '11111111-1111-1111-1111-111111111111',
      email: 'owner@otronegocio.com',
      username: 'owner_otro',
    })

    expect(decodeJwtClaims(token)).toEqual({
      username: 'owner_otro',
      email: 'owner@otronegocio.com',
    })
  })

  it('devuelve null si el token no tiene 3 partes separadas por punto', () => {
    expect(decodeJwtClaims('no-es-un-jwt')).toBeNull()
    expect(decodeJwtClaims('solo.dos')).toBeNull()
  })

  it('devuelve null si el payload no decodifica a JSON válido', () => {
    const token = `header.${'%%%no-base64%%%'}.sig`
    expect(decodeJwtClaims(token)).toBeNull()
  })

  it('devuelve null si el payload es JSON válido pero le faltan las claims esperadas', () => {
    const token = buildJwt({ sub: 'solo-sub-sin-email-ni-username' })
    expect(decodeJwtClaims(token)).toBeNull()
  })

  it('nunca lanza — un token vacío devuelve null en vez de una excepción', () => {
    expect(() => decodeJwtClaims('')).not.toThrow()
    expect(decodeJwtClaims('')).toBeNull()
  })
})
