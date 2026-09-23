import { apiClient } from '@/shared/lib/api-client'
import { businessSchema, type Business } from '@/shared/schemas/business'

/**
 * `GET /business/me` — issue #27. Mirror de `register-business.ts` en
 * cuanto a forma (llamada simple, sin Port, `businessSchema.parse` sobre
 * la respuesta), pero a diferencia de aquella, esta NO pasa
 * `skipSessionAuth: true`: el mock hoy ignora la autenticación (devuelve
 * siempre `db.business`, ver `handlers.ts`), pero un backend real
 * necesitaría identificar a qué negocio pertenece la sesión activa — dejar
 * que el interceptor intente adjuntar el bearer token es lo correcto de
 * cara a esa migración futura.
 */
export async function getBusinessMe(): Promise<Business> {
  const { data } = await apiClient.get('/business/me')
  return businessSchema.parse(data)
}
