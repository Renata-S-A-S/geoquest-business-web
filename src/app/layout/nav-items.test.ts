import { describe, expect, it } from 'vitest'
import { NAV_ITEMS } from './nav-items'

describe('NAV_ITEMS', () => {
  it('has exactly 5 sections, one per flujo B-01..B-05', () => {
    expect(NAV_ITEMS).toHaveLength(5)
  })

  it('every item has a unique id and a unique route', () => {
    const ids = NAV_ITEMS.map((i) => i.id)
    const paths = NAV_ITEMS.map((i) => i.to)
    expect(new Set(ids).size).toBe(NAV_ITEMS.length)
    expect(new Set(paths).size).toBe(NAV_ITEMS.length)
  })
})
