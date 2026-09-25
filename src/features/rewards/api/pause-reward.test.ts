import { describe, expect, it } from 'vitest'
import { pauseReward } from './pause-reward'
import { republishReward } from './republish-reward'
import { updateReward } from './update-reward'
import { getReward } from './get-reward'
import { SEED_BUSINESS, SEED_REWARDS } from '@/shared/mocks/seed'
import type { UpdateBusinessRewardInput } from '@/shared/schemas/business-reward'

const businessId = SEED_BUSINESS.id
const published = SEED_REWARDS[0]
const draft = SEED_REWARDS[1]

const FULL: UpdateBusinessRewardInput = {
  title: published.title,
  description: published.description,
  geoPointsCost: published.geoPointsCost,
  estimatedValueCop: published.estimatedValueCop,
  menuItemId: published.menuItemId,
  placeId: published.placeId,
  stockTotal: published.stockTotal,
}

describe('pauseReward', () => {
  it('pausa una recompensa publicada', async () => {
    await pauseReward(businessId, published.rewardId)

    await expect(getReward(businessId, published.rewardId)).resolves.toMatchObject({
      status: 'Paused',
    })
  })

  it('no devuelve nada: el endpoint responde 204 sin body', async () => {
    await expect(pauseReward(businessId, published.rewardId)).resolves.toBeUndefined()
  })

  it('rechaza con 409 AlreadyPaused si ya estaba pausada', async () => {
    await pauseReward(businessId, published.rewardId)

    await expect(pauseReward(businessId, published.rewardId)).rejects.toMatchObject({
      response: { status: 409, data: { title: 'Reward.AlreadyPaused' } },
    })
  })

  it('rechaza con 409 InvalidStatusTransition desde Draft', async () => {
    await expect(pauseReward(businessId, draft.rewardId)).rejects.toMatchObject({
      response: { status: 409, data: { title: 'Reward.InvalidStatusTransition' } },
    })
  })

  /**
   * Pausar una AGOTADA es válido en el servidor (`Reward.cs:275`). Es el caso en
   * que el negocio quiere dejar de mostrar algo que ya no puede entregar.
   */
  it('SÍ pausa una recompensa agotada', async () => {
    // Se agota de verdad: bajar el tope a lo comprometido deja remaining en 0.
    const exhausted = await updateReward(businessId, published.rewardId, {
      ...FULL,
      stockTotal: 8,
    })
    expect(exhausted.status).toBe('Exhausted')

    await pauseReward(businessId, published.rewardId)

    await expect(getReward(businessId, published.rewardId)).resolves.toMatchObject({
      status: 'Paused',
    })
  })

  it('propaga el 403 de un businessId ajeno', async () => {
    await expect(
      pauseReward('00000000-0000-0000-0000-0000000000aa', published.rewardId)
    ).rejects.toMatchObject({
      response: { status: 403, data: { title: 'RewardPortal.NotBusinessOwner' } },
    })
  })

  it('propaga el 404 de un rewardId desconocido', async () => {
    await expect(
      pauseReward(businessId, '00000000-0000-0000-0000-0000000000ff')
    ).rejects.toMatchObject({
      response: { status: 404, data: { title: 'RewardPortal.RewardNotFound' } },
    })
  })
})

describe('republishReward', () => {
  it('republica una pausada con stock y la deja Published', async () => {
    await pauseReward(businessId, published.rewardId)
    await republishReward(businessId, published.rewardId)

    await expect(getReward(businessId, published.rewardId)).resolves.toMatchObject({
      status: 'Published',
    })
  })

  it('no devuelve nada: el endpoint responde 204 sin body', async () => {
    await pauseReward(businessId, published.rewardId)

    await expect(republishReward(businessId, published.rewardId)).resolves.toBeUndefined()
  })

  /**
   * **El caso que define el issue.** Republicar sin stock deja `Exhausted`, no
   * `Published` (`Reward.cs:298`). El 204 no lo dice, así que la única forma de
   * saberlo es releer — y por eso la interfaz tiene que anticiparlo.
   */
  it('republicar SIN STOCK la deja Exhausted, no Published', async () => {
    await updateReward(businessId, published.rewardId, { ...FULL, stockTotal: 8 })
    await pauseReward(businessId, published.rewardId)

    await republishReward(businessId, published.rewardId)

    await expect(getReward(businessId, published.rewardId)).resolves.toMatchObject({
      status: 'Exhausted',
    })
  })

  it('rechaza con 409 NotPaused una recompensa que no está pausada', async () => {
    await expect(republishReward(businessId, published.rewardId)).rejects.toMatchObject({
      response: { status: 409, data: { title: 'Reward.NotPaused' } },
    })
  })

  it('rechaza con 409 NotPaused un borrador', async () => {
    await expect(republishReward(businessId, draft.rewardId)).rejects.toMatchObject({
      response: { status: 409, data: { title: 'Reward.NotPaused' } },
    })
  })

  /**
   * `SyncStockStatus()` nunca toca `Paused` (`Reward.cs:306-308`): reponer stock
   * mientras está pausada NO la despausa. Se verifica contra el mock porque es
   * el tipo de regla que un mock indulgente escondería.
   */
  it('reponer stock mientras está pausada NO la despausa', async () => {
    await pauseReward(businessId, published.rewardId)

    await updateReward(businessId, published.rewardId, { ...FULL, stockTotal: 200 })

    await expect(getReward(businessId, published.rewardId)).resolves.toMatchObject({
      status: 'Paused',
    })
  })
})
