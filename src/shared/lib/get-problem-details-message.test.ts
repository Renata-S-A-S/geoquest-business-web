import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { getProblemDetailsMessage } from './get-problem-details-message'

function axiosErrorWithData(data: unknown, status = 400): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    data,
    status,
    statusText: 'Bad Request',
    headers: {},
    config: { headers: new AxiosHeaders() },
  })
}

describe('getProblemDetailsMessage', () => {
  it('devuelve detail cuando el problem+json trae title y detail', () => {
    const error = axiosErrorWithData({ title: 'ValidationFailed', detail: 'El email es inválido' })
    expect(getProblemDetailsMessage(error, 'fallback')).toBe('El email es inválido')
  })

  it('devuelve title cuando no hay detail', () => {
    const error = axiosErrorWithData({ title: 'ValidationFailed' })
    expect(getProblemDetailsMessage(error, 'fallback')).toBe('ValidationFailed')
  })

  it('devuelve el fallback cuando el body no es un problem+json válido', () => {
    const error = axiosErrorWithData('<html>502 Bad Gateway</html>')
    expect(getProblemDetailsMessage(error, 'fallback')).toBe('fallback')
  })

  it('devuelve el fallback cuando no hay response (error de red)', () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK')
    expect(getProblemDetailsMessage(error, 'fallback')).toBe('fallback')
  })

  it('devuelve el fallback cuando el error no viene de axios', () => {
    expect(getProblemDetailsMessage(new Error('boom'), 'fallback')).toBe('fallback')
  })
})
