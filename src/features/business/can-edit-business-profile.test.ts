import { describe, expect, it } from 'vitest'
import { canEditBusinessProfile } from './can-edit-business-profile'

describe('canEditBusinessProfile', () => {
  it('permite editar cuando el role es Owner', () => {
    expect(canEditBusinessProfile('Owner')).toBe(true)
  })

  it('no permite editar cuando el role es Manager', () => {
    expect(canEditBusinessProfile('Manager')).toBe(false)
  })

  it('no permite editar cuando el role es Staff', () => {
    expect(canEditBusinessProfile('Staff')).toBe(false)
  })
})
