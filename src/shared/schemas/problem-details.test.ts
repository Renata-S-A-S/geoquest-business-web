import { describe, expect, it } from 'vitest'
import { problemDetailsSchema } from './problem-details'

describe('problemDetailsSchema', () => {
  it('parses a full problem+json payload', () => {
    expect(
      problemDetailsSchema.parse({ title: 'Bad Request', detail: 'Falta un campo', status: 400 })
    ).toEqual({ title: 'Bad Request', detail: 'Falta un campo', status: 400 })
  })

  it('parses an empty object — all fields are optional', () => {
    expect(problemDetailsSchema.parse({})).toEqual({})
  })
})
