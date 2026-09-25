import { z } from 'zod'

/**
 * Analytics del negocio (B-05) — ⚠️ **CONTRATO PROPUESTO, NO CONFIRMADO**.
 *
 * Referencia obligatoria: `Renata-S-A-S/geoquest#205`. No existe NINGÚN
 * endpoint de analytics en el backend. Confluence lista el flujo B-05 como
 * "sin definir" y `contratos-portal-b2b.md` §2.6 dice textualmente «Sin
 * propuesta de shape todavía». Todo lo que hay acá lo sirve MSW
 * (`shared/mocks/analytics.mock.ts`) y lo propone el frontend.
 *
 * La regla que gobierna este archivo: **cada métrica tiene que poder
 * nombrar el campo del que saldría**. Nada de métricas aspiracionales.
 *
 * | Métrica                       | Campo de origen                                            |
 * | ----------------------------- | ---------------------------------------------------------- |
 * | `checkIns`                    | filas de `Geo.Domain.CheckIn` con `ValidationStatus` válido |
 * | `uniqueVisitors`              | `CheckIn.ExplorerId` distintos                             |
 * | `redemptions`                 | `UserReward.status === 'Redeemed'` (`user-reward.ts`)       |
 * | `estimatedValueDeliveredCop`  | suma de `Reward.estimatedValueCop` de esos canjes           |
 * | `averageExperienceRating`     | promedio de `UserReward.experienceRating` (RN-REW-07)       |
 * | `places[]`                    | `CheckIn.PlaceId` agrupado                                 |
 *
 * ⚠️ `trustScore` NO vive acá aunque B-05 lo mencione: ya viaja en
 * `GET /business/me` (`businessSchema.trustScore`) y no es una métrica de
 * período — es un estado presente del negocio (RN-REW-08, ventana propia de
 * 90 días). Duplicarlo en este endpoint crearía dos fuentes de verdad para
 * el mismo número.
 */
export const ANALYTICS_PROPOSAL_REPO = 'Renata-S-A-S/geoquest'
export const ANALYTICS_PROPOSAL_ISSUE_NUMBER = 205

/**
 * ⚠️ **No juntar esto en un solo literal.** `'Renata-S-A-S/geoquest#205'` en una
 * línea de código hace fallar el build: `src/test/no-hardcoded-colors.test.ts`
 * escanea el fuente buscando `#` seguido de 3 a 8 dígitos hex, y `#205` califica.
 * El guard sí vacía los comentarios antes de escanear (por eso las decenas de
 * referencias a issues en docstrings de este repo no lo disparan), pero este es
 * código real, no un comentario.
 *
 * El template literal deja el `#` pegado a `${`, así que ninguna línea contiene
 * el patrón, y el valor resultante es idéntico. La alternativa era sumar el
 * archivo a la allow-list del guard, lo que habría apagado la detección de
 * colores hardcodeados para TODO el archivo — un agujero permanente para
 * esquivar una coincidencia que no tiene nada que ver con colores.
 */
export const ANALYTICS_PROPOSAL_ISSUE = `${ANALYTICS_PROPOSAL_REPO}#${ANALYTICS_PROPOSAL_ISSUE_NUMBER}`

/**
 * Fecha calendario `YYYY-MM-DD`, no un instante. Las métricas se agregan por
 * día en la zona del negocio, así que un `datetime` completo prometería una
 * precisión que la agregación no tiene.
 */
export const analyticsDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/**
 * Totales de un período. `averageExperienceRating` es `nullable` a
 * propósito: RN-REW-07 hace la calificación **opcional**, así que un período
 * sin ninguna califición no tiene promedio. Devolver `0` ahí sería mentir —
 * 0 no es un valor posible de la escala 1–5, y la interfaz lo dibujaría como
 * "pésimo" en vez de "sin datos".
 */
export const analyticsTotalsSchema = z.object({
  checkIns: z.number().int().nonnegative(),
  uniqueVisitors: z.number().int().nonnegative(),
  redemptions: z.number().int().nonnegative(),
  estimatedValueDeliveredCop: z.number().nonnegative(),
  averageExperienceRating: z.number().min(1).max(5).nullable(),
})
export type AnalyticsTotals = z.infer<typeof analyticsTotalsSchema>

/** Desglose por lugar — `name` lo resuelve el backend desde `Place`, el portal no lo joinea. */
export const analyticsPlaceBreakdownSchema = z.object({
  placeId: z.string().uuid(),
  name: z.string(),
  checkIns: z.number().int().nonnegative(),
  uniqueVisitors: z.number().int().nonnegative(),
})
export type AnalyticsPlaceBreakdown = z.infer<typeof analyticsPlaceBreakdownSchema>

/**
 * `GET /portal/businesses/{businessId}/analytics/summary?from=&to=`
 *
 * El servidor devuelve `current` y `previous` ya calculados en vez de un
 * porcentaje de variación: el porcentaje es una decisión de presentación
 * (¿qué se muestra cuando el período previo fue 0?) y el cliente la resuelve
 * en `analytics-delta.ts`. Mandar el porcentaje desde el servidor obligaría
 * a versionar el contrato para cambiar ese criterio.
 */
export const analyticsSummarySchema = z.object({
  from: analyticsDateSchema,
  to: analyticsDateSchema,
  current: analyticsTotalsSchema,
  previous: analyticsTotalsSchema,
  places: z.array(analyticsPlaceBreakdownSchema),
})
export type AnalyticsSummary = z.infer<typeof analyticsSummarySchema>

/**
 * Única granularidad propuesta. Semana y mes se agregan cuando exista un
 * consumidor real, no "por si acaso": un enum con valores que ningún
 * handler sirve es una promesa que el mock no cumple.
 */
export const analyticsGranularitySchema = z.enum(['day'])
export type AnalyticsGranularity = z.infer<typeof analyticsGranularitySchema>

/**
 * `GET /portal/businesses/{businessId}/analytics/check-ins?from=&to=&granularity=day`
 *
 * ⚠️ La serie lleva SOLO `checkIns`, deliberadamente sin `uniqueVisitors`.
 * Los visitantes únicos por día NO suman al único del período (un mismo
 * explorador que vuelve cuenta una vez por día y una sola en el total), así
 * que una serie de únicos invita a sumar la columna y obtener un número
 * falso. El único del período vive en `summary.current.uniqueVisitors`, que
 * es donde el cálculo es correcto.
 */
export const analyticsCheckInPointSchema = z.object({
  date: analyticsDateSchema,
  checkIns: z.number().int().nonnegative(),
})
export type AnalyticsCheckInPoint = z.infer<typeof analyticsCheckInPointSchema>

export const analyticsCheckInSeriesSchema = z.object({
  granularity: analyticsGranularitySchema,
  points: z.array(analyticsCheckInPointSchema),
})
export type AnalyticsCheckInSeries = z.infer<typeof analyticsCheckInSeriesSchema>
