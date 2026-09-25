import { z } from 'zod'

/**
 * Claims de identidad para MOSTRAR, nunca para autorizar — spec
 * "session-identity": `SessionPort.getIdentityClaims()` expone esto en
 * ambos modos (real decodifica el JWT, mock devuelve la identidad
 * semilla). Forma verificada contra el emisor real
 * (`GeoQuest.Modules.Identity.Infrastructure.Auth.JwtTokenService.cs`,
 * `origin/main`): el payload trae más claims (`sub`, `jti`,
 * `auth_provider`, rol) pero acá solo se valida lo que la UI necesita.
 */
export interface IdentityClaims {
  username: string
  email: string
}

const identityClaimsPayloadSchema = z.object({
  email: z.string(),
  username: z.string(),
})

function base64UrlToBase64(base64Url: string): string {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const paddingLength = (4 - (base64.length % 4)) % 4
  return base64 + '='.repeat(paddingLength)
}

/**
 * Decodifica el payload de un JWT SIN verificar la firma — este frontend
 * nunca valida un JWT, solo lo decodifica para mostrar username/email
 * (autorización real la hace el backend en cada request). `atob` produce un
 * binary string; `TextDecoder` sobre esos bytes evita mojibake si el
 * payload trae caracteres fuera de ASCII (nombres, emails con acentos).
 *
 * Un token con forma inválida, payload no-JSON, o sin las claims esperadas
 * devuelve `null` — nunca lanza, porque `useIdentityClaims()` lo llama en
 * cada render y un token corrupto no debe tumbar la pantalla.
 */
export function decodeJwtClaims(token: string): IdentityClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }

  try {
    const binaryString = atob(base64UrlToBase64(parts[1]))
    const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0))
    const json = new TextDecoder().decode(bytes)
    const payload: unknown = JSON.parse(json)
    const parsed = identityClaimsPayloadSchema.safeParse(payload)
    return parsed.success ? { username: parsed.data.username, email: parsed.data.email } : null
  } catch {
    return null
  }
}
