import { AxiosError, AxiosHeaders } from 'axios'
import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import { redemptionErrorMessage } from './redemption-error-message'

const t = ((key: string) => key) as unknown as TFunction<'redemptions'>

function problemError(status: number, data: unknown): AxiosError {
  return new AxiosError('request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data,
  })
}

describe('redemptionErrorMessage', () => {
  it.each([
    ['RedemptionToken.NotFound', 404, 'errors.notFound'],
    ['RewardPortal.NotBusinessOwner', 403, 'errors.notOwner'],
    ['RewardPortal.BusinessNotActive', 403, 'errors.businessNotActive'],
    ['RedemptionToken.OtherBusiness', 403, 'errors.otherBusiness'],
    ['RedemptionToken.AlreadyRedeemed', 409, 'errors.alreadyRedeemed'],
    ['RedemptionToken.NotRedeemable', 409, 'errors.notRedeemable'],
    ['RedemptionToken.Expired', 410, 'errors.expired'],
    ['UserReward.InvalidStatusTransition', 409, 'errors.invalidTransition'],
    ['UserReward.ConcurrencyConflict', 409, 'errors.concurrencyConflict'],
  ])('traduce %s a %s', (title, status, expected) => {
    expect(redemptionErrorMessage(problemError(status, { title }), t)).toBe(expected)
  })

  /**
   * El test que protege la decisión: si alguien cambia esto por
   * `getProblemDetailsMessage`, el `detail` del backend gana y este test se
   * pone rojo.
   */
  it('ignora el `detail` del backend y usa la copia traducida', () => {
    const error = problemError(409, {
      title: 'RedemptionToken.AlreadyRedeemed',
      detail: 'The redemption token was already redeemed.',
    })

    expect(redemptionErrorMessage(error, t)).toBe('errors.alreadyRedeemed')
  })

  it('cae al genérico con un title que no conoce', () => {
    expect(redemptionErrorMessage(problemError(500, { title: 'Algo.Raro' }), t)).toBe(
      'errors.generic'
    )
  })

  it('cae al genérico cuando el cuerpo no es problem+json', () => {
    expect(redemptionErrorMessage(problemError(500, 'boom'), t)).toBe('errors.generic')
  })

  it('cae al genérico cuando el error no vino de axios', () => {
    expect(redemptionErrorMessage(new Error('red caída'), t)).toBe('errors.generic')
  })

  it('cae al genérico cuando no hay respuesta (error de red)', () => {
    expect(redemptionErrorMessage(new AxiosError('Network Error'), t)).toBe('errors.generic')
  })

  /**
   * El límite de 30 req/min es compartido por lookup y escaneo (design D8).
   * El cuerpo de un 429 no es confiable, así que la detección es por status,
   * nunca por `title`.
   */
  it('detecta un 429 por status, sin mirar el title', () => {
    expect(redemptionErrorMessage(problemError(429, { title: 'Too Many Requests' }), t)).toBe(
      'errors.rateLimited'
    )
  })

  it('detecta un 429 aunque el cuerpo no traiga ningún title conocido', () => {
    expect(redemptionErrorMessage(problemError(429, {}), t)).toBe('errors.rateLimited')
  })

  it('un title de dominio conocido no gana contra un 429', () => {
    expect(
      redemptionErrorMessage(problemError(429, { title: 'RedemptionToken.AlreadyRedeemed' }), t)
    ).toBe('errors.rateLimited')
  })
})
