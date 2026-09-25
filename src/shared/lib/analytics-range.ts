/**
 * Resolución del rango de fechas que el portal manda como `from`/`to` a los
 * endpoints propuestos de analytics (`Renata-S-A-S/geoquest#205`).
 *
 * Vive fuera de los componentes y sin dependencias de React a propósito: es
 * aritmética de calendario pura, y el lugar donde se prueba es un test de
 * node (`analytics-range.test.ts`), no un render.
 *
 * Está en `shared/lib` y no en `features/analytics` porque tiene DOS
 * consumidores en capas distintas: la pantalla y el handler MSW
 * (`shared/mocks/analytics.mock.ts`), que necesita la misma definición de
 * «período previo» y de «días del rango» para servir `previous`. Si viviera
 * en la feature, el mock tendría que importar hacia arriba desde `shared`.
 */

/**
 * Períodos ofrecidos en el selector. Tres opciones, no un rango libre: un
 * date-picker abierto contra un endpoint que todavía no existe agregaría
 * superficie de UI sobre un contrato sin confirmar.
 */
export const ANALYTICS_PERIOD_DAYS = [7, 30, 90] as const
export type AnalyticsPeriodDays = (typeof ANALYTICS_PERIOD_DAYS)[number]

/**
 * 30 días por defecto. 7 es demasiado ruidoso para un negocio con pocos
 * check-ins diarios y 90 diluye cualquier cambio reciente.
 */
export const DEFAULT_ANALYTICS_PERIOD_DAYS: AnalyticsPeriodDays = 30

export interface AnalyticsRange {
  from: string
  to: string
}

/** `Date` → `YYYY-MM-DD` en UTC, el mismo formato que `analyticsDateSchema`. */
export function toAnalyticsDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Ventana **inclusiva** de `days` días que termina hoy: para `days = 7`,
 * `from` es hoy menos 6 días, no menos 7. Restar los 7 completos daría una
 * ventana de 8 días y el rótulo «últimos 7 días» pasaría a ser falso.
 *
 * `now` es un parámetro con default para que el test fije el día y no
 * dependa de cuándo corre la suite.
 */
export function resolveAnalyticsRange(days: AnalyticsPeriodDays, now = new Date()): AnalyticsRange {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - (days - 1))

  return { from: toAnalyticsDate(from), to: toAnalyticsDate(to) }
}

/**
 * Período previo de la MISMA longitud, pegado al rango actual: termina el día
 * anterior a `from`. Es lo que hace comparable la variación — un período
 * previo de otra duración volvería el porcentaje sin sentido.
 *
 * Lo necesita el mock para servir `previous`; el backend real haría este
 * mismo cálculo server-side.
 */
export function resolvePreviousRange({ from, to }: AnalyticsRange): AnalyticsRange {
  const fromDate = new Date(`${from}T00:00:00.000Z`)
  const toDate = new Date(`${to}T00:00:00.000Z`)
  const lengthInDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1

  const previousTo = new Date(fromDate)
  previousTo.setUTCDate(previousTo.getUTCDate() - 1)
  const previousFrom = new Date(previousTo)
  previousFrom.setUTCDate(previousFrom.getUTCDate() - (lengthInDays - 1))

  return { from: toAnalyticsDate(previousFrom), to: toAnalyticsDate(previousTo) }
}

/** Todos los días del rango, inclusive, en orden — un punto por día de la serie. */
export function eachAnalyticsDate({ from, to }: AnalyticsRange): string[] {
  const dates: string[] = []
  const cursor = new Date(`${from}T00:00:00.000Z`)
  const last = new Date(`${to}T00:00:00.000Z`)

  while (cursor.getTime() <= last.getTime()) {
    dates.push(toAnalyticsDate(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}
