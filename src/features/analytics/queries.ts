import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getAnalyticsSummary } from './api/get-analytics-summary'
import { getAnalyticsCheckIns } from './api/get-analytics-check-ins'
import type { AnalyticsRange } from '@/shared/lib/analytics-range'

/**
 * Query keys de la slice `analytics` (B-05) — mismo criterio que `placeKeys` y
 * `businessKeys`: las keys viven en un solo lugar para que invalidar no se
 * desincronice de leer.
 *
 * Prefijo `['analytics']` propio, sin compartir raíz con `businessKeys` aunque
 * la pantalla dependa de `useMyBusiness()` para resolver el `businessId`:
 * refrescar el perfil del negocio no debería tirar a la basura métricas que no
 * cambiaron.
 *
 * `businessId`, `from` y `to` son parte de la key porque son parte de la
 * pregunta. Dejarlos afuera haría que cambiar el período devolviera la cache
 * del período anterior — el bug clásico de un dashboard con filtros.
 */
export const analyticsKeys = {
  summary: (businessId: string, range: AnalyticsRange) =>
    ['analytics', 'summary', businessId, range.from, range.to] as const,
  checkIns: (businessId: string, range: AnalyticsRange) =>
    ['analytics', 'check-ins', businessId, range.from, range.to] as const,
}

/**
 * `staleTime: 60_000`, el doble que el resto de las slices (30 s). Las métricas
 * agregadas de un período de 7 a 90 días no se mueven de forma perceptible en
 * un minuto, así que un refetch por foco de pestaña solo gastaría una
 * agregación cara en el backend para redibujar los mismos números.
 *
 * `placeholderData: keepPreviousData` es lo que hace usable el selector de
 * período: sin él, cambiar de 30 a 90 días cambia la queryKey, la query vuelve
 * a `isPending`, el contenedor desmonta la vista entera y el `Select` con el
 * que el usuario acababa de interactuar desaparece bajo el cursor (y pierde el
 * foco de teclado). Con él, los datos previos quedan en pantalla marcados como
 * «actualizando» hasta que llegan los nuevos.
 *
 * `enabled` espera al `businessId`: el path lo exige (ver
 * `get-analytics-summary.ts`), así que sin él el request sería un 404
 * garantizado. Preferimos no disparar un pedido condenado antes que mostrar un
 * error que no explica nada.
 */
export function useAnalyticsSummary(businessId: string | undefined, range: AnalyticsRange) {
  return useQuery({
    queryKey: analyticsKeys.summary(businessId ?? '', range),
    queryFn: () => getAnalyticsSummary(businessId as string, range),
    enabled: Boolean(businessId),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
}

/** Serie temporal de check-ins. Mismo `staleTime`, mismo `enabled`, misma razón. */
export function useAnalyticsCheckIns(businessId: string | undefined, range: AnalyticsRange) {
  return useQuery({
    queryKey: analyticsKeys.checkIns(businessId ?? '', range),
    queryFn: () => getAnalyticsCheckIns(businessId as string, range),
    enabled: Boolean(businessId),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
}
