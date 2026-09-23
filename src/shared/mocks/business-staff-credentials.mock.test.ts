import { describe, expect, it } from 'vitest'
import {
  isValidMockCredential,
  MOCK_BUSINESS_STAFF_PASSWORD,
} from './business-staff-credentials.mock'
import { SEED_BUSINESS_STAFF } from './seed'

describe('isValidMockCredential', () => {
  it('accepts the seeded email (any case) with the exact mock password', () => {
    expect(isValidMockCredential(SEED_BUSINESS_STAFF.email, MOCK_BUSINESS_STAFF_PASSWORD)).toBe(
      true
    )
    expect(
      isValidMockCredential(SEED_BUSINESS_STAFF.email.toUpperCase(), MOCK_BUSINESS_STAFF_PASSWORD)
    ).toBe(true)
  })

  it('rejects the right email with a wrong password', () => {
    expect(isValidMockCredential(SEED_BUSINESS_STAFF.email, 'wrong-password')).toBe(false)
  })

  it('rejects an unknown email even with the right password', () => {
    expect(isValidMockCredential('nobody@cafe70.co', MOCK_BUSINESS_STAFF_PASSWORD)).toBe(false)
  })

  it('rejects empty email and empty password', () => {
    expect(isValidMockCredential('', MOCK_BUSINESS_STAFF_PASSWORD)).toBe(false)
    expect(isValidMockCredential(SEED_BUSINESS_STAFF.email, '')).toBe(false)
  })

  it('is case-sensitive on the password', () => {
    expect(
      isValidMockCredential(SEED_BUSINESS_STAFF.email, MOCK_BUSINESS_STAFF_PASSWORD.toUpperCase())
    ).toBe(false)
  })
})
