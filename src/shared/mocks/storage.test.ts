import { afterEach, describe, expect, it } from 'vitest'
import { __resetMemoryStorage, createMockStorage } from '@/shared/mocks/storage'

/**
 * Corre en el proyecto Vitest 'node' (sin DOM, sin `localStorage` global) —
 * prueba específicamente la rama en memoria de `createMockStorage()`.
 */
describe('createMockStorage — entorno sin localStorage (node)', () => {
  afterEach(() => __resetMemoryStorage())

  it('returns null for a key that was never set', () => {
    const storage = createMockStorage()
    expect(storage.get('missing')).toBeNull()
  })

  it('round-trips a value through set/get', () => {
    const storage = createMockStorage()
    storage.set('key', { a: 1 })
    expect(storage.get('key')).toEqual({ a: 1 })
  })

  it('clear removes the value', () => {
    const storage = createMockStorage()
    storage.set('key', 'value')
    storage.clear('key')
    expect(storage.get('key')).toBeNull()
  })

  it('two createMockStorage() calls share the same underlying store — same contract as real localStorage', () => {
    const a = createMockStorage()
    const b = createMockStorage()
    a.set('key', 'from-a')
    expect(b.get('key')).toBe('from-a')
  })

  it('__resetMemoryStorage() clears the shared store for the next test', () => {
    createMockStorage().set('key', 'value')
    __resetMemoryStorage()
    expect(createMockStorage().get('key')).toBeNull()
  })
})
