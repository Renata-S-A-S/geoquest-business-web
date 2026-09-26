import { apiClient } from '@/shared/lib/api-client'
import {
  myBusinessSchema,
  type MyBusiness,
  type RegisterBusinessInput,
} from '@/shared/schemas/business'

/**
 * `POST /business/register` — B-01, issue #21. Función simple, no un Port:
 * a diferencia de `SessionPort` (dependencia de sesión con estado,
 * inyectada en el interceptor y en `ProtectedRoute`), esto es una mutación
 * de un solo disparo desde un único lugar (`register-form.tsx`) — mismo
 * criterio que `POST /places`, que tampoco tiene port.
 *
 * Autenticado (real-backend-readiness PR10, decisión #1543 D, backend
 * geoquest#212): el dueño sale del claim `sub` del JWT, así que YA NO se
 * pasa `skipSessionAuth` — `session-interceptor.ts` adjunta el bearer token
 * como en cualquier otro request. La respuesta se parsea como `MyBusiness`
 * (spec #1547 dominio `business-registration`), el mismo contrato real de
 * `GET /business/mine`: un negocio recién registrado nace `PendingVerification`.
 */
export async function registerBusiness(input: RegisterBusinessInput): Promise<MyBusiness> {
  const { data } = await apiClient.post('/business/register', input)
  return myBusinessSchema.parse(data)
}
