import { describe, expect, it } from 'vitest'
import {
  ANALYTICS_PERIOD_DAYS,
  DEFAULT_ANALYTICS_PERIOD_DAYS,
  eachAnalyticsDate,
  resolveAnalyticsRange,
  resolvePreviousRange,
  toAnalyticsDate,
} from './analytics-range'

describe('resolveAnalyticsRange', () => {
  it('arma una ventana INCLUSIVA: 7 días termina hoy y arranca hoy menos 6, no menos 7', () => {
    const range = resolveAnalyticsRange(7, new Date('2026-09-24T10:30:00.000Z'))

    expect(range).toEqual({ from: '2026-09-18', to: '2026-09-24' })
    expect(eachAnalyticsDate(range)).toHaveLength(7)
  })

  it('la cantidad de días del rango coincide con el período pedido para las tres opciones', () => {
    for (const days of ANALYTICS_PERIOD_DAYS) {
      const range = resolveAnalyticsRange(days, new Date('2026-09-24T00:00:00.000Z'))
      expect(eachAnalyticsDate(range)).toHaveLength(days)
    }
  })

  it('cruza el límite de mes y de año sin romperse', () => {
    expect(resolveAnalyticsRange(30, new Date('2026-01-05T00:00:00.000Z'))).toEqual({
      from: '2025-12-07',
      to: '2026-01-05',
    })
  })

  it('ignora la hora: dos instantes del mismo día UTC dan el mismo rango', () => {
    const early = resolveAnalyticsRange(30, new Date('2026-09-24T00:00:01.000Z'))
    const late = resolveAnalyticsRange(30, new Date('2026-09-24T23:59:59.000Z'))

    expect(early).toEqual(late)
  })

  it('el default es uno de los períodos ofrecidos (anti-drift: cambiar la lista no deja un default huérfano)', () => {
    expect(ANALYTICS_PERIOD_DAYS).toContain(DEFAULT_ANALYTICS_PERIOD_DAYS)
  })
})

describe('resolvePreviousRange', () => {
  it('devuelve un período de la MISMA longitud, terminando el día anterior a `from`', () => {
    const current = { from: '2026-09-18', to: '2026-09-24' }

    expect(resolvePreviousRange(current)).toEqual({ from: '2026-09-11', to: '2026-09-17' })
  })

  it('el previo y el actual no se solapan ni dejan un hueco de días', () => {
    const current = resolveAnalyticsRange(30, new Date('2026-09-24T00:00:00.000Z'))
    const previous = resolvePreviousRange(current)

    expect(eachAnalyticsDate(previous)).toHaveLength(30)
    expect(previous.to < current.from).toBe(true)
    // Pegados: el día siguiente al cierre del previo es el que abre el actual.
    const dayAfterPrevious = new Date(`${previous.to}T00:00:00.000Z`)
    dayAfterPrevious.setUTCDate(dayAfterPrevious.getUTCDate() + 1)
    expect(toAnalyticsDate(dayAfterPrevious)).toBe(current.from)
  })
})

describe('eachAnalyticsDate', () => {
  it('incluye los dos extremos y devuelve los días en orden', () => {
    expect(eachAnalyticsDate({ from: '2026-02-27', to: '2026-03-02' })).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ])
  })

  it('un rango de un solo día devuelve ese día, no un arreglo vacío', () => {
    expect(eachAnalyticsDate({ from: '2026-09-24', to: '2026-09-24' })).toEqual(['2026-09-24'])
  })
})
