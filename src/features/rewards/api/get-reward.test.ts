import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { getReward } from './get-reward'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS, SEED_REWARDS } from '@/shared/mocks/seed'

const businessId = SEED_BUSINESS.id
const rewardId = SEED_REWARDS[0].rewardId
const DETAIL_URL = `${API_BASE_URL}/portal/businesses/${businessId}/rewards/${rewardId}`

describe('getReward', () => {
  it('devuelve la recompensa parseada contra el handler mock real', async () => {
    const reward = await getReward(businessId, rewardId)

    expect(reward).toMatchObject({
      rewardId,
      title: SEED_REWARDS[0].title,
      status: SEED_REWARDS[0].status,
    })
  })

  /**
   * El detalle y el listado comparten DTO en el backend, así que tienen que
   * compartir schema en el portal. Si alguien declarara un schema de detalle
   * aparte, este test no lo detectaría — pero sí detecta que el detalle acepte
   * exactamente los mismos campos que el listado produce.
   */
  it('acepta la misma forma que el listado, sin campos extra ni faltantes', async () => {
    const reward = await getReward(businessId, rewardId)

    expect(Object.keys(reward).sort()).toEqual(Object.keys(SEED_REWARDS[0]).sort())
  })

  it('acepta Exhausted, que es un estado real del servidor', async () => {
    server.use(
      http.get(DETAIL_URL, () => HttpResponse.json({ ...SEED_REWARDS[0], status: 'Exhausted' }))
    )

    await expect(getReward(businessId, rewardId)).resolves.toMatchObject({
      status: 'Exhausted',
    })
  })

  it('rechaza un estado que el backend no tiene', async () => {
    server.use(
      http.get(DETAIL_URL, () => HttpResponse.json({ ...SEED_REWARDS[0], status: 'Active' }))
    )

    await expect(getReward(businessId, rewardId)).rejects.toBeTruthy()
  })

  it('propaga el 404 RewardPortal.RewardNotFound de un id desconocido', async () => {
    await expect(
      getReward(businessId, '00000000-0000-0000-0000-0000000000ff')
    ).rejects.toMatchObject({
      response: { status: 404, data: { title: 'RewardPortal.RewardNotFound' } },
    })
  })

  /**
   * Un `businessId` ajeno devuelve 403 y NO 404, por anti-enumeración
   * (`PortalAccess.cs:22`). El portal no puede distinguir «no existe» de «no
   * es tuya», y este test fija que el transporte no lo disfrace.
   */
  it('propaga el 403 NotBusinessOwner de un businessId ajeno', async () => {
    await expect(getReward('00000000-0000-0000-0000-0000000000aa', rewardId)).rejects.toMatchObject(
      {
        response: { status: 403, data: { title: 'RewardPortal.NotBusinessOwner' } },
      }
    )
  })

  it('rechaza una respuesta que viola el contrato', async () => {
    server.use(http.get(DETAIL_URL, () => HttpResponse.json({ rewardId: 'no-es-un-uuid' })))

    await expect(getReward(businessId, rewardId)).rejects.toBeTruthy()
  })
})
