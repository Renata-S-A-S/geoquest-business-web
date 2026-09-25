import { describe, expect, it } from 'vitest'
import {
  ANALYTICS_PROPOSAL_ISSUE,
  analyticsCheckInSeriesSchema,
  analyticsDateSchema,
  analyticsSummarySchema,
  analyticsTotalsSchema,
} from './analytics'

const VALID_TOTALS = {
  checkIns: 120,
  uniqueVisitors: 44,
  redemptions: 9,
  estimatedValueDeliveredCop: 135000,
  averageExperienceRating: 4.4,
}

describe('ANALYTICS_PROPOSAL_ISSUE', () => {
  it('apunta al issue de la propuesta de contrato (la ficción de esta slice tiene que quedar etiquetada)', () => {
    expect(ANALYTICS_PROPOSAL_ISSUE).toBe('Renata-S-A-S/geoquest#205')
  })
})

describe('analyticsDateSchema', () => {
  it('acepta una fecha calendario YYYY-MM-DD', () => {
    expect(analyticsDateSchema.safeParse('2026-09-24').success).toBe(true)
  })

  it('rechaza un datetime ISO completo: las métricas se agregan por día, no por instante', () => {
    expect(analyticsDateSchema.safeParse('2026-09-24T15:00:00.000Z').success).toBe(false)
  })

  it('rechaza una fecha sin ceros a la izquierda', () => {
    expect(analyticsDateSchema.safeParse('2026-9-4').success).toBe(false)
  })
})

describe('analyticsTotalsSchema', () => {
  it('acepta un período con calificación', () => {
    expect(analyticsTotalsSchema.parse(VALID_TOTALS)).toEqual(VALID_TOTALS)
  })

  it('acepta averageExperienceRating null: RN-REW-07 hace la calificación opcional', () => {
    const totals = { ...VALID_TOTALS, averageExperienceRating: null }

    expect(analyticsTotalsSchema.parse(totals).averageExperienceRating).toBeNull()
  })

  it('rechaza una calificación 0: no existe en la escala 1–5, así que "sin datos" tiene que ser null', () => {
    expect(
      analyticsTotalsSchema.safeParse({ ...VALID_TOTALS, averageExperienceRating: 0 }).success
    ).toBe(false)
  })

  it('rechaza conteos negativos', () => {
    expect(analyticsTotalsSchema.safeParse({ ...VALID_TOTALS, checkIns: -1 }).success).toBe(false)
  })

  it('rechaza un conteo fraccionario de check-ins', () => {
    expect(analyticsTotalsSchema.safeParse({ ...VALID_TOTALS, checkIns: 1.5 }).success).toBe(false)
  })
})

describe('analyticsSummarySchema', () => {
  const VALID_SUMMARY = {
    from: '2026-08-26',
    to: '2026-09-24',
    current: VALID_TOTALS,
    previous: { ...VALID_TOTALS, checkIns: 90 },
    places: [
      {
        placeId: '00000000-0000-0000-0000-000000000010',
        name: 'Café de la 70 — Sede Laureles',
        checkIns: 120,
        uniqueVisitors: 44,
      },
    ],
  }

  it('acepta el resumen completo con su comparativa', () => {
    expect(analyticsSummarySchema.parse(VALID_SUMMARY)).toEqual(VALID_SUMMARY)
  })

  it('exige `previous`: sin él no hay comparativa y la vista no podría calcular la variación', () => {
    const { previous: _previous, ...withoutPrevious } = VALID_SUMMARY

    expect(analyticsSummarySchema.safeParse(withoutPrevious).success).toBe(false)
  })

  it('acepta un desglose por lugar vacío (un negocio sin lugares es legítimo, no un error)', () => {
    expect(analyticsSummarySchema.safeParse({ ...VALID_SUMMARY, places: [] }).success).toBe(true)
  })

  it('rechaza un placeId que no es uuid', () => {
    const summary = {
      ...VALID_SUMMARY,
      places: [{ ...VALID_SUMMARY.places[0], placeId: 'sede-laureles' }],
    }

    expect(analyticsSummarySchema.safeParse(summary).success).toBe(false)
  })
})

describe('analyticsCheckInSeriesSchema', () => {
  it('acepta una serie diaria', () => {
    const series = {
      granularity: 'day',
      points: [{ date: '2026-09-24', checkIns: 5 }],
    }

    expect(analyticsCheckInSeriesSchema.parse(series)).toEqual(series)
  })

  it('rechaza una granularidad que ningún handler sirve todavía', () => {
    expect(
      analyticsCheckInSeriesSchema.safeParse({ granularity: 'week', points: [] }).success
    ).toBe(false)
  })

  it('los puntos NO llevan uniqueVisitors: sumar únicos por día daría un total falso', () => {
    const parsed = analyticsCheckInSeriesSchema.parse({
      granularity: 'day',
      points: [{ date: '2026-09-24', checkIns: 5, uniqueVisitors: 3 }],
    })

    expect(parsed.points[0]).not.toHaveProperty('uniqueVisitors')
  })
})
