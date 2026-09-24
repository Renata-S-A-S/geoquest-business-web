import { z } from 'zod'
import { apiClient } from '@/shared/lib/api-client'
import {
  businessPlaceSummarySchema,
  type BusinessPlaceSummary,
} from '@/shared/schemas/business-place'

/**
 * `GET /business/places` — issue #29 (B-02). Contrato real verificado
 * contra `BusinessPlacesEndpoints.cs`; ver `Renata-S-A-S/geoquest#191`.
 *
 * Devuelve el **resumen**, no el detalle: 7 campos, sin descripción,
 * coordenadas, radio ni fotos. Para cualquiera de esos hay que pedir
 * `GET /business/places/{id}`. La asimetría es del backend, no una
 * simplificación nuestra.
 *
 * Trae los lugares en todos los estados, incluido `Deleted`: ni el
 * repositorio de lista ni el de detalle filtran por estado. Esconder el
 * borrador sería esconderle al negocio el trabajo pendiente.
 *
 * Sin `skipSessionAuth`: el backend resuelve el negocio desde la sesión vía
 * `BusinessMembershipRef`, el cliente nunca manda un `businessId`.
 *
 * `z.array(...)` falla la lista ENTERA si una fila viola el contrato, y es
 * deliberado: solo tumba filas que el backend no debería haber emitido.
 * Ante datos corruptos preferimos un error visible antes que una lista a
 * medias que el negocio lea como completa.
 */
export async function getPlaces(): Promise<BusinessPlaceSummary[]> {
  const { data } = await apiClient.get('/business/places')
  return z.array(businessPlaceSummarySchema).parse(data)
}
