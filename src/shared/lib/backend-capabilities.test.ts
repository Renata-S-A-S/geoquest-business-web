import { describe, expect, it } from 'vitest'
import { resolveBackendCapabilities } from './backend-capabilities'

/**
 * Regla de #1550 (enmienda de diseño, override del design original):
 * "true en modo mock SOLO donde existe una implementación mock". `analytics`
 * y `registration` siguen el modo; `profileEdit`/`staffIdentity` son `false`
 * en ambos modos porque no queda ninguna implementación mock para ellos
 * (perfil se borra en PR4, identidad de staff se resuelve vía claims JWT).
 */
describe('resolveBackendCapabilities', () => {
  it('returns every capability enabled in mock mode, except profileEdit and staffIdentity', () => {
    expect(resolveBackendCapabilities('mock')).toEqual({
      analytics: true,
      profileEdit: false,
      staffIdentity: false,
      registration: true,
    })
  })

  it('disables analytics, registration, profileEdit and staffIdentity in real mode', () => {
    expect(resolveBackendCapabilities('real')).toEqual({
      analytics: false,
      profileEdit: false,
      staffIdentity: false,
      registration: false,
    })
  })
})
