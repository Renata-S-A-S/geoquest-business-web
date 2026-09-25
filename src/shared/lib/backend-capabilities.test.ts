import { describe, expect, it } from 'vitest'
import { BACKEND_MODE, resolveBackendCapabilities } from './backend-capabilities'

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

/**
 * Entorno de test determinístico (real-backend-readiness, tarea previa a
 * PR6a): el repo tiene un `.env.local` git-ignorado con `VITE_USE_MOCKS=false`
 * para probar contra el backend real manualmente (`npm run dev`). Vitest
 * carga ese archivo igual que Vite, así que sin una configuración explícita
 * `BACKEND_MODE` resolvería a `'real'` en corridas locales y a `'mock'` en
 * CI — un comportamiento no determinístico. `vitest.config.ts` fuerza
 * `VITE_USE_MOCKS='true'` vía `test.env` para que esta constante sea siempre
 * `'mock'` bajo Vitest, sin importar `.env.local`. Los tests que necesiten
 * modo real deben pedirlo explícitamente con `resolveBackendCapabilities('real')`
 * o un provider — nunca depender del ambiente.
 */
describe('BACKEND_MODE under Vitest', () => {
  it('always resolves to mock, regardless of a local VITE_USE_MOCKS=false override', () => {
    expect(BACKEND_MODE).toBe('mock')
  })
})
