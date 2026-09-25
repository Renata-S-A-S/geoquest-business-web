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
 * ⚠️ **El portal convive hoy con DOS convenciones de resolución de negocio, y
 * esto es transitorio.** Registrado en `Renata-S-A-S/geoquest#191`.
 *
 * - **Convención vieja, la que va a migrar:** los endpoints ya implementados
 *   (`GET /business/places`, `GET /portal/rewards`) resuelven el negocio desde
 *   la sesión vía `BusinessMembershipRef` y el cliente NUNCA manda un id — ver
 *   el docstring de `get-places.ts`, que lo dice textualmente.
 * - **Convención nueva, la del backend real y hacia donde va el portal:** el
 *   `businessId` viaja explícito en el path, como acá.
 *
 * O sea que la divergencia NO es un descuido de estos dos endpoints: son los
 * primeros consumidores de la convención destino. Lo que se va a alinear es la
 * convención vieja, no esta. Mientras dure la mezcla, cualquier pantalla que
 * use la convención nueva tiene que resolver el `businessId` antes de pedir sus
 * datos, y eso tiene un costo real y medible: la cascada de tres etapas que
 * documenta `analytics-page.tsx` (negocio → resumen + serie). Ese costo es el
 * precio de la transición y desaparece cuando el portal termine de migrar.
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
