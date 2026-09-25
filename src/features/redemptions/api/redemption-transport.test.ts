import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import {
  SEED_BUSINESS,
  SEED_EXPIRED_QR_TOKEN,
  SEED_PRIZE_QR_TOKEN,
  SEED_PURCHASED_QR_TOKEN,
  SEED_REDEEMED_QR_TOKEN,
  SEED_USER_REWARDS,
} from '@/shared/mocks/seed'
import { getRedemptionByQrToken } from './get-redemption-by-qr-token'
import { scanRedemption } from './scan-redemption'

const BUSINESS_ID = SEED_BUSINESS.id
const OTHER_BUSINESS_ID = '00000000-0000-0000-0000-0000000000ff'

describe('getRedemptionByQrToken', () => {
  it('devuelve el userRewardId, que es la única razón por la que este lookup existe', async () => {
    const preview = await getRedemptionByQrToken(BUSINESS_ID, SEED_PURCHASED_QR_TOKEN)

    expect(preview.userRewardId).toBe(SEED_USER_REWARDS[0].userRewardId)
    expect(preview.rewardTitle).toBe(SEED_USER_REWARDS[0].rewardTitle)
  })

  it('trae el origin Prize con costo 0, que es el caso de #47', async () => {
    const preview = await getRedemptionByQrToken(BUSINESS_ID, SEED_PRIZE_QR_TOKEN)

    expect(preview.origin).toBe('Prize')
    expect(preview.geoPointsCostSnapshot).toBe(0)
  })

  /**
   * El mock no debe filtrar su propio bookkeeping: el backend nunca devolvería
   * el token en claro, y el schema no lo declara.
   */
  it('no expone el token ni el bookkeeping interno del mock', async () => {
    const preview = await getRedemptionByQrToken(BUSINESS_ID, SEED_PURCHASED_QR_TOKEN)

    expect(preview).not.toHaveProperty('qrToken')
    expect(preview).not.toHaveProperty('businessId')
    expect(preview).not.toHaveProperty('redeemedAtUtc')
  })

  it('devuelve 404 cuando ningún canje coincide con el token', async () => {
    await expect(
      getRedemptionByQrToken(BUSINESS_ID, `Nop${'Z'.repeat(40)}=`)
    ).rejects.toMatchObject({
      response: { status: 404, data: { title: 'ScanRedemptionQrCommand.RewardNotFound' } },
    })
  })

  /** Anti-enumeración: "de otro negocio" comparte código con "no existe". */
  it('devuelve el MISMO 404 para un canje de otro negocio', async () => {
    await expect(
      getRedemptionByQrToken(OTHER_BUSINESS_ID, SEED_PURCHASED_QR_TOKEN)
    ).rejects.toMatchObject({
      response: { status: 404, data: { title: 'ScanRedemptionQrCommand.RewardNotFound' } },
    })
  })

  it('devuelve 409 para un código ya canjeado', async () => {
    await expect(getRedemptionByQrToken(BUSINESS_ID, SEED_REDEEMED_QR_TOKEN)).rejects.toMatchObject(
      {
        response: { status: 409, data: { title: 'UserReward.InvalidStatusTransition' } },
      }
    )
  })

  /** 400, no 409 — los comentarios del backend dicen 409 y están mal (geoquest#206). */
  it('devuelve 400 para un código vencido, no 409', async () => {
    await expect(getRedemptionByQrToken(BUSINESS_ID, SEED_EXPIRED_QR_TOKEN)).rejects.toMatchObject({
      response: { status: 400, data: { title: 'ScanRedemptionQrCommand.QrExpired' } },
    })
  })

  it('codifica el token en la URL en vez de pegarlo crudo', async () => {
    let requestedUrl = ''
    server.use(
      http.get(
        `${API_BASE_URL}/portal/businesses/:businessId/redemptions/by-qr-token/:qrToken`,
        ({ request }) => {
          requestedUrl = request.url
          return HttpResponse.json({
            ...SEED_USER_REWARDS[0],
            qrToken: undefined,
            businessId: undefined,
            redeemedAtUtc: undefined,
          })
        }
      )
    )

    await getRedemptionByQrToken(BUSINESS_ID, `Sla${'A'.repeat(37)}+/=`)

    expect(requestedUrl).toContain('%2B%2F%3D')
    expect(requestedUrl.endsWith('+/=')).toBe(false)
  })
})

describe('scanRedemption', () => {
  it('confirma el canje y no devuelve nada (204)', async () => {
    const result = await scanRedemption(BUSINESS_ID, {
      userRewardId: SEED_USER_REWARDS[0].userRewardId,
      qrToken: SEED_PURCHASED_QR_TOKEN,
    })

    expect(result).toBeUndefined()
  })

  it('manda los dos campos que exige `ScanRedemptionQrRequest`', async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.post(
        `${API_BASE_URL}/portal/businesses/:businessId/redemptions/scan`,
        async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>
          return new HttpResponse(null, { status: 204 })
        }
      )
    )

    await scanRedemption(BUSINESS_ID, {
      userRewardId: SEED_USER_REWARDS[0].userRewardId,
      qrToken: SEED_PURCHASED_QR_TOKEN,
    })

    expect(body).toEqual({
      userRewardId: SEED_USER_REWARDS[0].userRewardId,
      qrToken: SEED_PURCHASED_QR_TOKEN,
    })
  })

  it('pone el businessId en la ruta, nunca en el body', async () => {
    let requestedUrl = ''
    server.use(
      http.post(`${API_BASE_URL}/portal/businesses/:businessId/redemptions/scan`, ({ request }) => {
        requestedUrl = request.url
        return new HttpResponse(null, { status: 204 })
      })
    )

    await scanRedemption(BUSINESS_ID, {
      userRewardId: SEED_USER_REWARDS[0].userRewardId,
      qrToken: SEED_PURCHASED_QR_TOKEN,
    })

    expect(requestedUrl).toContain(`/portal/businesses/${BUSINESS_ID}/redemptions/scan`)
  })

  /**
   * El caso más importante del flujo: un doble click, o un QR que ya pasó por
   * el mostrador, devuelve 409 y NO vuelve a canjear.
   */
  it('devuelve 409 al reintentar un canje ya confirmado', async () => {
    await scanRedemption(BUSINESS_ID, {
      userRewardId: SEED_USER_REWARDS[0].userRewardId,
      qrToken: SEED_PURCHASED_QR_TOKEN,
    })

    await expect(
      scanRedemption(BUSINESS_ID, {
        userRewardId: SEED_USER_REWARDS[0].userRewardId,
        qrToken: SEED_PURCHASED_QR_TOKEN,
      })
    ).rejects.toMatchObject({
      response: { status: 409, data: { title: 'UserReward.InvalidStatusTransition' } },
    })
  })

  it('devuelve 400 cuando el token no corresponde al canje', async () => {
    await expect(
      scanRedemption(BUSINESS_ID, {
        userRewardId: SEED_USER_REWARDS[0].userRewardId,
        qrToken: SEED_PRIZE_QR_TOKEN,
      })
    ).rejects.toMatchObject({
      response: { status: 400, data: { title: 'ScanRedemptionQrCommand.InvalidQrToken' } },
    })
  })

  it('devuelve 400 para un canje vencido', async () => {
    await expect(
      scanRedemption(BUSINESS_ID, {
        userRewardId: SEED_USER_REWARDS[3].userRewardId,
        qrToken: SEED_EXPIRED_QR_TOKEN,
      })
    ).rejects.toMatchObject({
      response: { status: 400, data: { title: 'ScanRedemptionQrCommand.QrExpired' } },
    })
  })

  it('devuelve 404 para un canje de otro negocio', async () => {
    await expect(
      scanRedemption(OTHER_BUSINESS_ID, {
        userRewardId: SEED_USER_REWARDS[0].userRewardId,
        qrToken: SEED_PURCHASED_QR_TOKEN,
      })
    ).rejects.toMatchObject({
      response: { status: 404, data: { title: 'ScanRedemptionQrCommand.RewardNotFound' } },
    })
  })

  it('rechaza un body sin userRewardId con 400 de validación', async () => {
    await expect(
      scanRedemption(BUSINESS_ID, {
        userRewardId: 'no-es-un-uuid',
        qrToken: SEED_PURCHASED_QR_TOKEN,
      })
    ).rejects.toMatchObject({
      response: { status: 400, data: { title: 'Validation.Failed' } },
    })
  })
})
