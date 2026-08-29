import { afterEach, describe, expect, it } from 'vitest'
import { createMockStorage } from '@/shared/mocks/storage'

/**
 * Corre en el proyecto Vitest 'jsdom' (localStorage SÍ existe como global)
 * — prueba específicamente la rama de `localStorage` real, y que persiste
 * entre instancias (a diferencia del adapter en memoria).
 */
describe('createMockStorage — entorno con localStorage (jsdom)', () => {
  afterEach(() => localStorage.clear())

  it('persists across independent createMockStorage() calls, via real localStorage', () => {
    const a = createMockStorage()
    a.set('key', { survives: true })

    const b = createMockStorage()
    expect(b.get('key')).toEqual({ survives: true })
  })

  it('writes JSON to the real localStorage under the given key', () => {
    const storage = createMockStorage()
    storage.set('key', { a: 1 })
    expect(localStorage.getItem('key')).toBe('{"a":1}')
  })
})
