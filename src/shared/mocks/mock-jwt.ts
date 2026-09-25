/**
 * ⚠️ SOLO MOCK — CÓDIGO DESECHABLE. Borrar cuando exista el backend real.
 *
 * Arma un token con FORMA de JWT (header.payload.firma, base64url) sin
 * firmar de verdad: MSW nunca valida una firma y el frontend tampoco —
 * `jwt-claims.ts` solo decodifica el payload para mostrar username/email,
 * jamás para autorizar (spec "session-identity"). La "firma" es un string
 * de relleno fijo, nunca un HMAC calculado.
 *
 * Existe porque antes de esta tarea `POST /auth/login` (`handlers.ts`)
 * emitía un token opaco (`mock-access-${uuid}`) que no decodifica a nada —
 * `realSessionPort.getIdentityClaims()` necesita la MISMA forma que emite
 * el backend real (`sub`, `email`, `username`, ver `JwtTokenService.cs`),
 * porque `realSessionPort` es el puerto activo en AMBOS modos
 * (`session-port.instance.ts`).
 */
function encodeBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export interface MockJwtClaims {
  sub: string
  email: string
  username: string
}

export function createMockJwt(claims: MockJwtClaims): string {
  const header = encodeBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = encodeBase64Url(JSON.stringify(claims))
  return `${header}.${payload}.mock-signature`
}
