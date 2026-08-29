import { describe, expect, it } from 'vitest'
import { resources, ns } from './resources'

/** Aplana un objeto de traducción a una lista de paths ("nav.business", ...). */
function flattenKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'object' && value !== null ? flattenKeys(value, path) : [path]
  })
}

describe('locale resources', () => {
  it('every namespace declared in `ns` exists in both es and en', () => {
    for (const namespace of ns) {
      expect(resources.es).toHaveProperty(namespace)
      expect(resources.en).toHaveProperty(namespace)
    }
  })

  it.each(ns)('es and en have the exact same key set for namespace "%s"', (namespace) => {
    const esKeys = flattenKeys(resources.es[namespace]).sort()
    const enKeys = flattenKeys(resources.en[namespace]).sort()
    expect(enKeys).toEqual(esKeys)
  })
})
