import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { updateReward } from './update-reward'
import { getReward } from './get-reward'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS, SEED_PLACES, SEED_REWARDS } from '@/shared/mocks/seed'
import type { UpdateBusinessRewardInput } from '@/shared/schemas/business-reward'

const businessId = SEED_BUSINESS.id
const published = SEED_REWARDS[0]
const draft = SEED_REWARDS[1]
const PUT_URL = `${API_BASE_URL}/portal/businesses/${businessId}/rewards/${published.rewardId}`

/** Body COMPLETO, que es la única forma válida de llamar a este endpoint. */
const FULL: UpdateBusinessRewardInput = {
  title: published.title,
  description: published.description,
  geoPointsCost: published.geoPointsCost,
  estimatedValueCop: published.estimatedValueCop,
  menuItemId: published.menuItemId,
  placeId: published.placeId,
  stockTotal: published.stockTotal,
}

describe('updateReward', () => {
  it('devuelve la recompensa actualizada, no un 204 vacío', async () => {
    const updated = await updateReward(businessId, published.rewardId, {
      ...FULL,
      title: 'Nuevo título',
    })

    expect(updated).toMatchObject({ rewardId: published.rewardId, title: 'Nuevo título' })
  })

  /**
   * El test más importante del archivo. `Reward.Edit` asigna sin condición
   * (`Reward.cs:245-252`), así que un `placeId: null` **borra el vínculo**.
   * Esto fija que el transporte no lo enmascare "ayudando".
   */
  it('un placeId null DESVINCULA el lugar: el PUT es reemplazo total', async () => {
    expect(published.placeId).toBe(SEED_PLACES[0].placeId)

    const updated = await updateReward(businessId, published.rewardId, {
      ...FULL,
      placeId: null,
    })

    expect(updated.placeId).toBeNull()
  })

  it('reenviar el mismo placeId lo CONSERVA', async () => {
    const updated = await updateReward(businessId, published.rewardId, FULL)

    expect(updated.placeId).toBe(published.placeId)
  })

  it('manda el body completo, con los siete campos del contrato', async () => {
    const captured: { body?: Record<string, unknown> } = {}
    server.use(
      http.put(PUT_URL, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(published)
      })
    )

    await updateReward(businessId, published.rewardId, FULL)

    expect(Object.keys(captured.body ?? {}).sort()).toEqual([
      'description',
      'estimatedValueCop',
      'geoPointsCost',
      'menuItemId',
      'placeId',
      'stockTotal',
      'title',
    ])
  })

  it('persiste los cambios: releer el detalle los devuelve', async () => {
    await updateReward(businessId, published.rewardId, { ...FULL, geoPointsCost: 250 })

    await expect(getReward(businessId, published.rewardId)).resolves.toMatchObject({
      geoPointsCost: 250,
    })
  })

  /**
   * Piso de stock (`Reward.cs:238-243`). La semilla tiene 50 totales y 42
   * restantes, o sea 8 comprometidas: bajar a 5 tiene que fallar.
   */
  it('rechaza con 409 StockBelowCommitted al bajar el stock por debajo de lo comprometido', async () => {
    await expect(
      updateReward(businessId, published.rewardId, { ...FULL, stockTotal: 5 })
    ).rejects.toMatchObject({
      response: { status: 409, data: { title: 'Reward.StockBelowCommitted' } },
    })
  })

  it('acepta bajar el stock exactamente hasta lo comprometido', async () => {
    const updated = await updateReward(businessId, published.rewardId, {
      ...FULL,
      stockTotal: 8,
    })

    expect(updated).toMatchObject({ stockTotal: 8, stockRemaining: 0 })
  })

  /**
   * El 409 NO trae el número de unidades comprometidas, y este test lo fija:
   * si algún día el backend lo agregara, conviene enterarse por un test rojo y
   * no por casualidad. Ver `committedUnits` para el cálculo del cliente.
   */
  it('el 409 de stock NO incluye el número de unidades comprometidas', async () => {
    await expect(
      updateReward(businessId, published.rewardId, { ...FULL, stockTotal: 1 })
    ).rejects.toMatchObject({
      response: {
        data: {
          title: 'Reward.StockBelowCommitted',
          detail: 'The new stock total cannot be lower than the units already committed.',
        },
      },
    })
  })

  /**
   * `Reward.NotEditable` (`Reward.cs:205`): la semilla en `Draft` no se puede
   * editar. Es el estado en el que el alta del portal deja las recompensas
   * nuevas, así que no es un caso raro.
   */
  it('rechaza con 409 NotEditable una recompensa en Draft', async () => {
    await expect(
      updateReward(businessId, draft.rewardId, { ...FULL, stockTotal: null })
    ).rejects.toMatchObject({
      response: { status: 409, data: { title: 'Reward.NotEditable' } },
    })
  })

  /**
   * `SyncStockStatus` (`Reward.cs:318-326`): una edición puede cambiar el
   * ESTADO como efecto secundario. Quitarle el tope a una `Exhausted` la
   * devuelve a `Published` sin que nadie pidiera republicarla.
   */
  it('quitar el tope devuelve una Exhausted a Published como efecto secundario', async () => {
    // Primero se agota de verdad contra el handler real: bajar el tope a las 8
    // unidades ya comprometidas deja `stockRemaining: 0`, y `SyncStockStatus`
    // mueve el estado a `Exhausted`.
    const nowExhausted = await updateReward(businessId, published.rewardId, {
      ...FULL,
      stockTotal: 8,
    })
    expect(nowExhausted.status).toBe('Exhausted')
    const exhausted = await updateReward(businessId, published.rewardId, {
      ...FULL,
      stockTotal: null,
    })

    expect(exhausted.stockTotal).toBeNull()
    expect(exhausted.status).not.toBe('Exhausted')
  })

  it('propaga el 403 NotBusinessOwner de un businessId ajeno', async () => {
    await expect(
      updateReward('00000000-0000-0000-0000-0000000000aa', published.rewardId, FULL)
    ).rejects.toMatchObject({
      response: { status: 403, data: { title: 'RewardPortal.NotBusinessOwner' } },
    })
  })

  it('propaga el 404 de un rewardId desconocido', async () => {
    await expect(
      updateReward(businessId, '00000000-0000-0000-0000-0000000000ff', FULL)
    ).rejects.toMatchObject({
      response: { status: 404, data: { title: 'RewardPortal.RewardNotFound' } },
    })
  })
})
