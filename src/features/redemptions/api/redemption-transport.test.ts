import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { readDb, writeDb } from '@/shared/mocks/db'
import {
  SEED_BUSINESS,
  SEED_EXPIRED_QR_TOKEN,
  SEED_FAILED_QR_TOKEN,
  SEED_PENDING_QR_TOKEN,
  SEED_PRIZE_QR_TOKEN,
  SEED_PURCHASED_QR_TOKEN,
  SEED_REDEEMED_QR_TOKEN,
  SEED_USER_REWARDS,
} from '@/shared/mocks/seed'
import { lookupRedemption } from './lookup-redemption'
import { scanRedemption } from './scan-redemption'

const BUSINESS_ID = SEED_BUSINESS.id
const OTHER_BUSINESS_ID = '00000000-0000-0000-0000-0000000000ff'

describe('lookupRedemption', () => {
  it('devuelve el userRewardId, que es la única razón por la que este lookup existe', async () => {
    const preview = await lookupRedemption(BUSINESS_ID, SEED_PURCHASED_QR_TOKEN)

    expect(preview.userRewardId).toBe(SEED_USER_REWARDS[0].userRewardId)
    expect(preview.rewardTitle).toBe(SEED_USER_REWARDS[0].rewardTitle)
    expect(preview.rewardDescription).toBe(SEED_USER_REWARDS[0].rewardDescription)
  })

  it('trae el origin Prize con costo 0, que es el caso de #47', async () => {
    const preview = await lookupRedemption(BUSINESS_ID, SEED_PRIZE_QR_TOKEN)

    expect(preview.origin).toBe('Prize')
    expect(preview.geoPointsCostSnapshot).toBe(0)
  })

  it('trae explorerUsername cuando el mock lo tiene proyectado', async () => {
    const preview = await lookupRedemption(BUSINESS_ID, SEED_PURCHASED_QR_TOKEN)

    expect(preview.explorerUsername).toBe(SEED_USER_REWARDS[0].explorerUsername)
  })

  it('trae explorerUsername nulo cuando el ExplorerRef no se proyectó (decision #1473)', async () => {
    const preview = await lookupRedemption(BUSINESS_ID, SEED_PRIZE_QR_TOKEN)

    expect(preview.explorerUsername).toBeNull()
  })

  /**
   * El mock no debe filtrar su propio bookkeeping: el backend nunca devolvería
   * el token en claro, y el schema no lo declara.
   */
  it('no expone el token ni el bookkeeping interno del mock', async () => {
    const preview = await lookupRedemption(BUSINESS_ID, SEED_PURCHASED_QR_TOKEN)

    expect(preview).not.toHaveProperty('qrToken')
    expect(preview).not.toHaveProperty('businessId')
    expect(preview).not.toHaveProperty('estimatedValueCopSnapshot')
  })

  it('nunca devuelve 409/410, aunque el token ya esté canjeado', async () => {
    const preview = await lookupRedemption(BUSINESS_ID, SEED_REDEEMED_QR_TOKEN)

    expect(preview.status).toBe('Redeemed')
    expect(preview.isRedeemable).toBe(false)
  })

  it('devuelve isRedeemable: false y status: Expired para un código vencido, en vez de un error', async () => {
    const preview = await lookupRedemption(BUSINESS_ID, SEED_EXPIRED_QR_TOKEN)

    expect(preview.status).toBe('Expired')
    expect(preview.isRedeemable).toBe(false)
  })

  it('acepta qrExpiresAtUtc nulo sin romper (canje ya resuelto)', async () => {
    const preview = await lookupRedemption(BUSINESS_ID, SEED_REDEEMED_QR_TOKEN)

    expect(preview.qrExpiresAtUtc).toBeNull()
  })

  it.each([SEED_PENDING_QR_TOKEN, SEED_FAILED_QR_TOKEN])(
    'devuelve isRedeemable: false para un estado no redimible (%s)',
    async (token) => {
      const preview = await lookupRedemption(BUSINESS_ID, token)

      expect(preview.isRedeemable).toBe(false)
    }
  )

  it('devuelve 404 cuando ningún canje coincide con el token', async () => {
    await expect(lookupRedemption(BUSINESS_ID, `Nop${'Z'.repeat(40)}=`)).rejects.toMatchObject({
      response: { status: 404, data: { title: 'RedemptionToken.NotFound' } },
    })
  })

  /** decision #1473: token de otro negocio devuelve su propio 403, no el 404. */
  it('devuelve 403 RedemptionToken.OtherBusiness para un canje de otro negocio', async () => {
    await expect(
      lookupRedemption(OTHER_BUSINESS_ID, SEED_PURCHASED_QR_TOKEN)
    ).rejects.toMatchObject({
      response: { status: 403, data: { title: 'RedemptionToken.OtherBusiness' } },
    })
  })

  /**
   * `requireActive: true` (design #1549, verificado contra
   * `LookupRedemptionByQrTokenQueryHandler.cs:39`): un negocio Pausado o
   * Suspendido no puede ni siquiera PREVISUALIZAR un canje, aunque el lookup
   * sea de solo lectura. El mismo mensaje que las escrituras de recompensas
   * (`denyUnlessActive`), para que el portal lo reconozca con el criterio ya
   * existente.
   */
  it('responde 403 BusinessNotActive al buscar con el negocio Suspended', async () => {
    const db = readDb()
    db.business.status = 'Suspended'
    writeDb(db)

    await expect(lookupRedemption(BUSINESS_ID, SEED_PURCHASED_QR_TOKEN)).rejects.toMatchObject({
      response: { status: 403, data: { title: 'RewardPortal.BusinessNotActive' } },
    })
  })

  it('manda el body como POST, no como query param ni segmento de ruta', async () => {
    let requestedUrl = ''
    let body: Record<string, unknown> | undefined
    server.use(
      http.post(
        `${API_BASE_URL}/portal/businesses/:businessId/redemptions/lookup`,
        async ({ request }) => {
          requestedUrl = request.url
          body = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({
            userRewardId: SEED_USER_REWARDS[0].userRewardId,
            rewardId: SEED_USER_REWARDS[0].rewardId,
            rewardTitle: SEED_USER_REWARDS[0].rewardTitle,
            rewardDescription: SEED_USER_REWARDS[0].rewardDescription,
            status: 'Earned',
            isRedeemable: true,
            qrExpiresAtUtc: SEED_USER_REWARDS[0].qrExpiresAtUtc,
            origin: SEED_USER_REWARDS[0].origin,
            geoPointsCostSnapshot: SEED_USER_REWARDS[0].geoPointsCostSnapshot,
            explorerId: SEED_USER_REWARDS[0].explorerId,
            explorerUsername: SEED_USER_REWARDS[0].explorerUsername,
          })
        }
      )
    )

    await lookupRedemption(BUSINESS_ID, `Sla${'A'.repeat(37)}+/=`)

    expect(requestedUrl).not.toContain('+/=')
    expect(requestedUrl.endsWith('/lookup')).toBe(true)
    expect(body).toEqual({ qrToken: `Sla${'A'.repeat(37)}+/=` })
  })
})

describe('scanRedemption', () => {
  it('confirma el canje y no devuelve nada (204)', async () => {
    const result = await scanRedemption(BUSINESS_ID, { qrToken: SEED_PURCHASED_QR_TOKEN })

    expect(result).toBeUndefined()
  })

  it('manda EXCLUSIVAMENTE qrToken en el body: userRewardId ya no es parte del contrato', async () => {
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

    await scanRedemption(BUSINESS_ID, { qrToken: SEED_PURCHASED_QR_TOKEN })

    expect(body).toEqual({ qrToken: SEED_PURCHASED_QR_TOKEN })
  })

  it('pone el businessId en la ruta, nunca en el body', async () => {
    let requestedUrl = ''
    server.use(
      http.post(`${API_BASE_URL}/portal/businesses/:businessId/redemptions/scan`, ({ request }) => {
        requestedUrl = request.url
        return new HttpResponse(null, { status: 204 })
      })
    )

    await scanRedemption(BUSINESS_ID, { qrToken: SEED_PURCHASED_QR_TOKEN })

    expect(requestedUrl).toContain(`/portal/businesses/${BUSINESS_ID}/redemptions/scan`)
  })

  /**
   * El caso más importante del flujo: un doble click, o un QR que ya pasó por
   * el mostrador, devuelve 409 y NO vuelve a canjear.
   */
  it('devuelve 409 RedemptionToken.AlreadyRedeemed al reintentar un canje ya confirmado', async () => {
    await scanRedemption(BUSINESS_ID, { qrToken: SEED_PURCHASED_QR_TOKEN })

    await expect(
      scanRedemption(BUSINESS_ID, { qrToken: SEED_PURCHASED_QR_TOKEN })
    ).rejects.toMatchObject({
      response: { status: 409, data: { title: 'RedemptionToken.AlreadyRedeemed' } },
    })
  })

  it('devuelve 410 RedemptionToken.Expired para un código vencido', async () => {
    await expect(
      scanRedemption(BUSINESS_ID, { qrToken: SEED_EXPIRED_QR_TOKEN })
    ).rejects.toMatchObject({
      response: { status: 410, data: { title: 'RedemptionToken.Expired' } },
    })
  })

  it.each([SEED_PENDING_QR_TOKEN, SEED_FAILED_QR_TOKEN])(
    'devuelve 409 RedemptionToken.NotRedeemable para un estado no redimible (%s)',
    async (token) => {
      await expect(scanRedemption(BUSINESS_ID, { qrToken: token })).rejects.toMatchObject({
        response: { status: 409, data: { title: 'RedemptionToken.NotRedeemable' } },
      })
    }
  )

  it('devuelve 404 RedemptionToken.NotFound para un token desconocido', async () => {
    await expect(
      scanRedemption(BUSINESS_ID, { qrToken: `Nop${'Z'.repeat(40)}=` })
    ).rejects.toMatchObject({
      response: { status: 404, data: { title: 'RedemptionToken.NotFound' } },
    })
  })

  it('devuelve 403 RedemptionToken.OtherBusiness para un canje de otro negocio', async () => {
    await expect(
      scanRedemption(OTHER_BUSINESS_ID, { qrToken: SEED_PURCHASED_QR_TOKEN })
    ).rejects.toMatchObject({
      response: { status: 403, data: { title: 'RedemptionToken.OtherBusiness' } },
    })
  })

  /**
   * `requireActive: true` (design #1549, verificado contra
   * `ScanRedemptionQrCommandHandler.cs:47`): un negocio no Active no puede
   * confirmar canjes — mismo criterio y mismo mensaje que el lookup.
   * `db.business` (contrato LEGACY) solo modela `Pending|Active|Suspended`;
   * `Paused` existe en `MyBusiness` pero no acá — ver PR6a.
   */
  it('responde 403 BusinessNotActive al escanear con el negocio Suspended', async () => {
    const db = readDb()
    db.business.status = 'Suspended'
    writeDb(db)

    await expect(
      scanRedemption(BUSINESS_ID, { qrToken: SEED_PURCHASED_QR_TOKEN })
    ).rejects.toMatchObject({
      response: { status: 403, data: { title: 'RewardPortal.BusinessNotActive' } },
    })
  })

  it('rechaza un body sin qrToken con 400 de validación', async () => {
    await expect(
      scanRedemption(BUSINESS_ID, {} as unknown as { qrToken: string })
    ).rejects.toMatchObject({
      response: { status: 400, data: { title: 'Validation.Failed' } },
    })
  })
})
