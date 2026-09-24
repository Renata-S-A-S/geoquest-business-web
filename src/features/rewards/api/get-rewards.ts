import { z } from 'zod'
import { apiClient } from '@/shared/lib/api-client'
import {
  businessRewardSummarySchema,
  type BusinessRewardSummary,
} from '@/shared/schemas/business-reward'

/**
 * `GET /portal/rewards` — issue #36 (B-03). Recompensas DEL NEGOCIO de la
 * sesión.
 *
 * ⚠️ **El path es una propuesta; la forma no.** Hoy el único listado que
 * existe en el backend es `GET /rewards`, y es **anónimo y global**: usarlo
 * acá mostraría el catálogo de la competencia sin que nada falle. La
 * propuesta registrada en `Renata-S-A-S/geoquest#191` es este endpoint,
 * autenticado y filtrado por el negocio del llamador.
 *
 * Deliberadamente NO hay un fallback a `/rewards` si este devuelve 404: es
 * mejor que la pantalla falle a la vista que muestre datos ajenos como
 * propios.
 *
 * Trae las recompensas en todos los estados, incluidos `Draft` y
 * `Archived`: un borrador es justamente el que tiene trabajo pendiente.
 *
 * `z.array(...)` falla la lista entera si una fila viola el contrato —
 * mismo criterio que `getPlaces`: ante datos corruptos, error visible antes
 * que lista a medias.
 */
export async function getRewards(): Promise<BusinessRewardSummary[]> {
  const { data } = await apiClient.get('/portal/rewards')
  return z.array(businessRewardSummarySchema).parse(data)
}
