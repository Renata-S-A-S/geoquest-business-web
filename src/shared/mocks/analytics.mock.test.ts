import { describe, expect, it } from 'vitest'
import {
  buildMockAnalyticsSummary,
  buildMockCheckInSeries,
  buildMockCheckIns,
  buildMockRedemptions,
} from './analytics.mock'
import { SEED_PLACES, SEED_REWARDS } from './seed'
import { analyticsCheckInSeriesSchema, analyticsSummarySchema } from '@/shared/schemas/analytics'
import { eachAnalyticsDate, resolvePreviousRange } from '@/shared/lib/analytics-range'

const RANGE = { from: '2026-08-26', to: '2026-09-24' }

describe('buildMockCheckIns', () => {
  it('es determinista: el mismo rango devuelve exactamente las mismas filas', () => {
    expect(buildMockCheckIns(RANGE, SEED_PLACES)).toEqual(buildMockCheckIns(RANGE, SEED_PLACES))
  })

  it('solo los lugares Active generan check-ins: un Draft no es visible para los exploradores', () => {
    const draftPlace = SEED_PLACES.find((place) => place.status === 'Draft')
    const checkIns = buildMockCheckIns(RANGE, SEED_PLACES)

    expect(draftPlace).toBeDefined()
    expect(checkIns.some((checkIn) => checkIn.placeId === draftPlace?.placeId)).toBe(false)
    expect(checkIns.length).toBeGreaterThan(0)
  })

  it('siembra check-ins rechazados, para que el filtro por ValidationStatus tenga algo que filtrar', () => {
    const checkIns = buildMockCheckIns(RANGE, SEED_PLACES)

    expect(checkIns.some((checkIn) => checkIn.validationStatus === 'Rejected')).toBe(true)
    expect(checkIns.some((checkIn) => checkIn.validationStatus === 'Valid')).toBe(true)
  })

  it('cada fila cae dentro del rango pedido', () => {
    const dates = new Set(eachAnalyticsDate(RANGE))

    for (const checkIn of buildMockCheckIns(RANGE, SEED_PLACES)) {
      expect(dates.has(checkIn.createdAt.slice(0, 10))).toBe(true)
    }
  })
})

describe('buildMockRedemptions', () => {
  it('solo las recompensas Published se canjean: una en Draft no está disponible para nadie', () => {
    const draftReward = SEED_REWARDS.find((reward) => reward.status === 'Draft')
    const redemptions = buildMockRedemptions(RANGE, SEED_REWARDS)

    expect(draftReward).toBeDefined()
    expect(redemptions.some((redemption) => redemption.rewardId === draftReward?.rewardId)).toBe(
      false
    )
    expect(redemptions.length).toBeGreaterThan(0)
  })

  it('siembra canjes sin calificación: RN-REW-07 la hace opcional', () => {
    const redemptions = buildMockRedemptions({ from: '2026-06-27', to: '2026-09-24' }, SEED_REWARDS)

    expect(redemptions.some((redemption) => redemption.experienceRating === null)).toBe(true)
    expect(redemptions.some((redemption) => redemption.experienceRating !== null)).toBe(true)
  })

  it('las calificaciones sembradas caen dentro de la escala 1–5', () => {
    for (const redemption of buildMockRedemptions(RANGE, SEED_REWARDS)) {
      if (redemption.experienceRating === null) continue
      expect(redemption.experienceRating).toBeGreaterThanOrEqual(1)
      expect(redemption.experienceRating).toBeLessThanOrEqual(5)
    }
  })
})

describe('buildMockAnalyticsSummary', () => {
  const summary = buildMockAnalyticsSummary(RANGE, SEED_PLACES, SEED_REWARDS)

  it('cumple el contrato propuesto (analyticsSummarySchema)', () => {
    expect(analyticsSummarySchema.parse(summary)).toEqual(summary)
  })

  it('cuenta SOLO los check-ins válidos, no las filas rechazadas', () => {
    const rows = buildMockCheckIns(RANGE, SEED_PLACES)
    const valid = rows.filter((checkIn) => checkIn.validationStatus === 'Valid')

    expect(summary.current.checkIns).toBe(valid.length)
    expect(summary.current.checkIns).toBeLessThan(rows.length)
  })

  it('los visitantes únicos son un conteo real de explorerId distintos, no un porcentaje de los check-ins', () => {
    const valid = buildMockCheckIns(RANGE, SEED_PLACES).filter(
      (checkIn) => checkIn.validationStatus === 'Valid'
    )
    const distinct = new Set(valid.map((checkIn) => checkIn.explorerId)).size

    expect(summary.current.uniqueVisitors).toBe(distinct)
    // Con repetición real de exploradores entre días, únicos < check-ins. Si
    // fueran iguales, la semilla habría degenerado en un explorador por fila y
    // la métrica dejaría de medir algo.
    expect(summary.current.uniqueVisitors).toBeLessThan(summary.current.checkIns)
  })

  it('el valor entregado sale del join contra Reward.estimatedValueCop, no de un número suelto', () => {
    const publishedReward = SEED_REWARDS.find((reward) => reward.status === 'Published')
    const redemptions = buildMockRedemptions(RANGE, SEED_REWARDS)

    expect(summary.current.redemptions).toBe(redemptions.length)
    expect(summary.current.estimatedValueDeliveredCop).toBe(
      redemptions.length * (publishedReward?.estimatedValueCop ?? 0)
    )
  })

  /**
   * La afirmación acá NO es «previous difiere de current»: que dos ventanas de
   * 30 días den el mismo total es una coincidencia perfectamente posible, y un
   * test que la prohíba falla por azar en vez de por un defecto. Lo que sí es
   * una propiedad del contrato es que `previous` se calcule sobre el período
   * previo resuelto por `resolvePreviousRange`, y eso es lo que se verifica.
   */
  it('calcula `previous` sobre el período previo resuelto, no sobre el actual', () => {
    const previousRange = resolvePreviousRange(RANGE)
    const previousValid = buildMockCheckIns(previousRange, SEED_PLACES).filter(
      (checkIn) => checkIn.validationStatus === 'Valid'
    )

    expect(summary.previous.checkIns).toBe(previousValid.length)
    expect(summary.previous.checkIns).toBeGreaterThan(0)
  })

  it('el desglose por lugar incluye TODOS los lugares, también el Draft en cero', () => {
    const draftPlace = SEED_PLACES.find((place) => place.status === 'Draft')
    const draftRow = summary.places.find((place) => place.placeId === draftPlace?.placeId)

    expect(summary.places).toHaveLength(SEED_PLACES.length)
    expect(draftRow).toMatchObject({ checkIns: 0, uniqueVisitors: 0 })
  })

  it('la suma del desglose por lugar coincide con el total de check-ins del período', () => {
    const sum = summary.places.reduce((total, place) => total + place.checkIns, 0)

    expect(sum).toBe(summary.current.checkIns)
  })

  it('un negocio sin lugares no rompe: totales en cero y promedio null, no NaN', () => {
    const empty = buildMockAnalyticsSummary(RANGE, [], [])

    expect(empty.current).toMatchObject({
      checkIns: 0,
      uniqueVisitors: 0,
      redemptions: 0,
      estimatedValueDeliveredCop: 0,
      averageExperienceRating: null,
    })
    expect(empty.places).toEqual([])
  })
})

describe('buildMockCheckInSeries', () => {
  it('cumple el contrato propuesto y devuelve un punto por día del rango', () => {
    const series = buildMockCheckInSeries(RANGE, SEED_PLACES)

    expect(analyticsCheckInSeriesSchema.parse(series)).toEqual(series)
    expect(series.points).toHaveLength(eachAnalyticsDate(RANGE).length)
    expect(series.granularity).toBe('day')
  })

  it('la suma de la serie coincide con el total de check-ins del resumen del mismo rango', () => {
    const series = buildMockCheckInSeries(RANGE, SEED_PLACES)
    const summary = buildMockAnalyticsSummary(RANGE, SEED_PLACES, SEED_REWARDS)
    const sum = series.points.reduce((total, point) => total + point.checkIns, 0)

    expect(sum).toBe(summary.current.checkIns)
  })

  it('un negocio sin lugares devuelve la serie completa en ceros, no una serie vacía', () => {
    const series = buildMockCheckInSeries({ from: '2026-09-18', to: '2026-09-24' }, [])

    expect(series.points).toHaveLength(7)
    expect(series.points.every((point) => point.checkIns === 0)).toBe(true)
  })
})
