import { describe, expect, it } from 'vitest'
import { resolveMockBusinessScenario } from './mock-business-param'

describe('resolveMockBusinessScenario', () => {
  it.each(['Active', 'Paused', 'Suspended', 'PendingVerification', 'Rejected', 'none'] as const)(
    'acepta ?mockBusiness=%s como escenario válido',
    (scenario) => {
      expect(resolveMockBusinessScenario(`?mockBusiness=${scenario}`)).toBe(scenario)
    }
  )

  it('devuelve undefined cuando falta el parámetro', () => {
    expect(resolveMockBusinessScenario('')).toBeUndefined()
  })

  it('devuelve undefined para un valor que no es ningún escenario conocido', () => {
    expect(resolveMockBusinessScenario('?mockBusiness=Deleted')).toBeUndefined()
  })

  it('ignora otros parámetros de la URL y solo lee mockBusiness', () => {
    expect(resolveMockBusinessScenario('?foo=bar&mockBusiness=Suspended&baz=1')).toBe('Suspended')
  })
})
