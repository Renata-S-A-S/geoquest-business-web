import { apiClient } from '@/shared/lib/api-client'
import { authTokensSchema, type AuthTokens, type LoginInput } from '@/shared/schemas/auth'

/**
 * `POST /auth/login` — issue #28. Función simple, no un Port: igual que
 * `registerBusiness`, es una mutación de un solo disparo desde un único
 * lugar (`login-page.tsx`), a diferencia de `SessionPort` (dependencia de
 * sesión con estado, inyectada en el interceptor y en `ProtectedRoute`).
 *
 * `skipSessionAuth: true` porque quien inicia sesión todavía no tiene una —
 * sin esto, `session-interceptor.ts` intentaría adjuntar/refrescar un token
 * inexistente (mismo motivo documentado en `register-business.ts` y en el
 * JSDoc de `skipSessionAuth` de `session-interceptor.ts`, que ya anticipaba
 * este caso de uso).
 */
export async function login(input: LoginInput): Promise<AuthTokens> {
  const { data } = await apiClient.post('/auth/login', input, { skipSessionAuth: true })
  return authTokensSchema.parse(data)
}
