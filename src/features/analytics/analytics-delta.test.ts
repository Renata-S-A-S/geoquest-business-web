import { describe, expect, it } from 'vitest'
import { resolveAnalyticsDelta } from './analytics-delta'

describe('resolveAnalyticsDelta', () => {
  it('calcula una subida como porcentaje entero', () => {
    expect(resolveAnalyticsDelta(150, 100)).toEqual({ direction: 'up', percent: 50 })
  })

  it('calcula una bajada con el porcentaje en valor absoluto (el signo lo lleva `direction`)', () => {
    expect(resolveAnalyticsDelta(75, 100)).toEqual({ direction: 'down', percent: 25 })
  })

  it('devuelve `flat` cuando el valor no se movió', () => {
    expect(resolveAnalyticsDelta(100, 100)).toEqual({ direction: 'flat', percent: 0 })
  })

  it('devuelve `flat` y no una flecha cuando el redondeo deja la variación en 0', () => {
    // 100 → 100.4 es +0,4 %, que redondea a 0. Una flecha "arriba" al lado de un
    // 0 se lee como un bug de la interfaz, no como "prácticamente igual".
    expect(resolveAnalyticsDelta(100.4, 100)).toEqual({ direction: 'flat', percent: 0 })
  })

  it('devuelve null cuando el período previo fue 0: la variación es INDEFINIDA, no +100 %', () => {
    expect(resolveAnalyticsDelta(42, 0)).toBeNull()
  })

  it('devuelve null cuando los dos períodos fueron 0 (no hay nada que comparar)', () => {
    expect(resolveAnalyticsDelta(0, 0)).toBeNull()
  })

  it('caer a 0 desde un valor previo sí es comparable: -100 %', () => {
    expect(resolveAnalyticsDelta(0, 80)).toEqual({ direction: 'down', percent: 100 })
  })

  it('redondea a entero en vez de arrastrar decimales de punto flotante', () => {
    expect(resolveAnalyticsDelta(7, 3)).toEqual({ direction: 'up', percent: 133 })
  })
})
