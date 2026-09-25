import { apiClient } from '@/shared/lib/api-client'
import { analyticsSummarySchema, type AnalyticsSummary } from '@/shared/schemas/analytics'
import type { AnalyticsRange } from '@/shared/lib/analytics-range'

/**
 * `GET /portal/businesses/{businessId}/analytics/summary?from=&to=`
 *
 * ⚠️ **ENDPOINT PROPUESTO, NO EXISTE.** Ver `Renata-S-A-S/geoquest#205`. Lo
 * sirve MSW (`shared/mocks/handlers.ts`); contra un backend real esto es un
 * 404 hoy.
 *
 * ⚠️ **El `businessId` en el path diverge del resto del portal.** Todos los
 * endpoints ya implementados (`GET /business/places`, `GET /portal/rewards`)
 * resuelven el negocio desde la sesión vía `BusinessMembershipRef` y el
 * cliente NUNCA manda un id — ver el docstring de `get-places.ts`. Estos dos
 * endpoints de analytics llevan el id explícito porque así están propuestos en
 * `#205`; si la propuesta se alinea con la convención existente, este
 * parámetro desaparece y `useAnalyticsSummary` deja de depender de
 * `useBusinessMe()`.
 */
export async function getAnalyticsSummary(
  businessId: string,
  { from, to }: AnalyticsRange
): Promise<AnalyticsSummary> {
  const { data } = await apiClient.get(`/portal/businesses/${businessId}/analytics/summary`, {
    params: { from, to },
  })
  return analyticsSummarySchema.parse(data)
}
