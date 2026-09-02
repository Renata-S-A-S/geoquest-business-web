import { apiClient } from '@/shared/lib/api-client'
import {
  businessSchema,
  type Business,
  type RegisterBusinessInput,
} from '@/shared/schemas/business'

/**
 * `POST /business/register` — B-01, issue #21. Función simple, no un Port:
 * a diferencia de `SessionPort` (dependencia de sesión con estado,
 * inyectada en el interceptor y en `ProtectedRoute`), esto es una mutación
 * de un solo disparo desde un único lugar (`register-form.tsx`) — mismo
 * criterio que `POST /places`, que tampoco tiene port.
 *
 * `skipSessionAuth: true` porque quien registra un negocio no tiene sesión
 * todavía — sin esto, `session-interceptor.ts` intentaría adjuntar/refrescar
 * un token inexistente (ver JSDoc de `skipSessionAuth` en
 * `session-interceptor.ts`, que ya anticipa este caso de uso).
 */
export async function registerBusiness(input: RegisterBusinessInput): Promise<Business> {
  const { data } = await apiClient.post('/business/register', input, { skipSessionAuth: true })
  return businessSchema.parse(data)
}
