import { apiClient } from '@/shared/lib/api-client'
import {
  analyticsCheckInSeriesSchema,
  type AnalyticsCheckInSeries,
  type AnalyticsGranularity,
} from '@/shared/schemas/analytics'
import type { AnalyticsRange } from '@/shared/lib/analytics-range'

/**
 * `GET /portal/businesses/{businessId}/analytics/check-ins?from=&to=&granularity=day`
 *
 * ⚠️ **ENDPOINT PROPUESTO, NO EXISTE.** Ver `Renata-S-A-S/geoquest#205`, y la
 * nota sobre el `businessId` en el path en `get-analytics-summary.ts`.
 *
 * `granularity` viaja explícito aunque hoy solo exista `'day'`: es el
 * parámetro que el contrato propone, y omitirlo dejaría al cliente dependiendo
 * de un default del servidor que nadie escribió.
 */
export async function getAnalyticsCheckIns(
  businessId: string,
  { from, to }: AnalyticsRange,
  granularity: AnalyticsGranularity = 'day'
): Promise<AnalyticsCheckInSeries> {
  const { data } = await apiClient.get(`/portal/businesses/${businessId}/analytics/check-ins`, {
    params: { from, to, granularity },
  })
  return analyticsCheckInSeriesSchema.parse(data)
}
