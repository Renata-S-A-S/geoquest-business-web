import { z } from 'zod'
import { apiClient } from '@/shared/lib/api-client'
import {
  businessRewardSummarySchema,
  type BusinessRewardSummary,
} from '@/shared/schemas/business-reward'

/**
 * `GET /portal/businesses/{businessId}/rewards` — issue #36 (B-03).
 *
 * ✅ **Ruta REAL, verificada** en `Api/PortalRewardsEndpoints.cs:26-27`
 * contra backend `main` @ `ea471f4`. Antes este archivo llamaba a
 * `GET /portal/rewards`, que **fue ELIMINADA** por los PRs #195–#201 sin
 * alias de compatibilidad (`grep '"/portal/rewards'` en el backend da cero
 * resultados). O sea que el listado del portal estaba roto contra el
 * backend real, no solo incompleto.
 *
 * El `businessId` viaja en el path. Ver el aviso de las DOS convenciones en
 * `@/shared/schemas/business-reward`: las rutas viejas resuelven el negocio
 * desde la sesión, estas lo llevan explícito. Es transitorio
 * (`geoquest#191`, `geoquest#203`).
 *
 * Deliberadamente NO hay fallback a `GET /rewards`: ese listado es anónimo y
 * **global**, así que mostraría el catálogo de la competencia sin que nada
 * falle. Mejor que la pantalla falle a la vista.
 *
 * Trae todos los estados, incluidos `Draft` y `Archived`: un borrador es
 * justamente el que tiene trabajo pendiente.
 *
 * `z.array(...)` falla la lista entera si una fila viola el contrato —
 * mismo criterio que `getPlaces`: ante datos corruptos, error visible antes
 * que lista a medias.
 */
export async function getRewards(businessId: string): Promise<BusinessRewardSummary[]> {
  const { data } = await apiClient.get(`/portal/businesses/${businessId}/rewards`)
  return z.array(businessRewardSummarySchema).parse(data)
}
