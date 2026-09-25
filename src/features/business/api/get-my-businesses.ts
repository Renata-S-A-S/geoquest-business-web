import { z } from 'zod'
import { apiClient } from '@/shared/lib/api-client'
import { myBusinessSchema, type MyBusiness } from '@/shared/schemas/business'

/**
 * `GET /business/mine` — real-backend-readiness PR6a, spec #1547 dominio
 * `business-identity-status`: "el sistema DEBE llamar `GET /business/mine`
 * (nunca `/business/me`), tratar la respuesta como un array, y usar su
 * primer elemento como 'mi negocio'". La respuesta es SIEMPRE un array
 * (`[]` cuando el explorador autenticado no es dueño de ningún negocio),
 * nunca un objeto único como el `/business/me` legacy — por eso este
 * transport parsea con `z.array(myBusinessSchema)`, no con `.parse` sobre
 * un objeto suelto.
 *
 * Sin `skipSessionAuth`: a diferencia del `/business/register` legacy, este
 * endpoint SIEMPRE requiere una sesión autenticada (el backend resuelve
 * "mis negocios" a partir del explorador de la sesión).
 */
export async function getMyBusinesses(): Promise<MyBusiness[]> {
  const { data } = await apiClient.get('/business/mine')
  return z.array(myBusinessSchema).parse(data)
}
