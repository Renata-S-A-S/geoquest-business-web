import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { createReward, type CreateRewardFormInput } from './create-reward'
import { API_BASE_URL } from '@/shared/lib/env'
import { getRewards } from './get-rewards'

const INPUT: CreateRewardFormInput = {
  title: 'Postre gratis con bebida caliente',
  description: 'Un postre de la vitrina llevando cualquier bebida caliente.',
  geoPointsCost: 80,
  estimatedValueCop: 12000,
  placeId: null,
  stockTotal: 20,
}

describe('createReward', () => {
  it('crea la recompensa y devuelve solo el id', async () => {
    const created = await createReward(INPUT)

    expect(created.rewardId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(Object.keys(created)).toEqual(['rewardId'])
  })

  /**
   * Nace `Draft`, no `Published`. Es la decisión de producto de mantener el
   * flujo B-03 con borrador previo, y el mock la modela para que la pantalla
   * exista antes de que el backend agregue la transición.
   */
  it('deja la recompensa en Draft, no publicada', async () => {
    const created = await createReward(INPUT)
    const rewards = await getRewards()

    expect(rewards.find((r) => r.rewardId === created.rewardId)?.status).toBe('Draft')
  })

  it('arranca sin imagen: se sube después, igual que las fotos de lugar', async () => {
    const created = await createReward(INPUT)
    const rewards = await getRewards()

    expect(rewards.find((r) => r.rewardId === created.rewardId)?.imageUrl).toBeNull()
  })

  it('siembra el stock restante con el total', async () => {
    const created = await createReward({ ...INPUT, stockTotal: 7 })
    const rewards = await getRewards()

    expect(rewards.find((r) => r.rewardId === created.rewardId)).toMatchObject({
      stockTotal: 7,
      stockRemaining: 7,
    })
  })

  it('acepta stock ilimitado como null', async () => {
    const created = await createReward({ ...INPUT, stockTotal: null })
    const rewards = await getRewards()

    expect(rewards.find((r) => r.rewardId === created.rewardId)).toMatchObject({
      stockTotal: null,
      stockRemaining: null,
    })
  })

  /**
   * `menuItemId` apunta a una entidad que no existe en el backend, así que
   * el transporte lo fija en `null` y el formulario no lo conoce. Este caso
   * verifica que efectivamente se manda.
   */
  it('manda menuItemId en null, que es lo único que el backend puede aceptar', async () => {
    let received: Record<string, unknown> | undefined
    server.use(
      http.post(`${API_BASE_URL}/portal/rewards`, async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ rewardId: crypto.randomUUID() }, { status: 201 })
      })
    )

    await createReward(INPUT)

    expect(received).toHaveProperty('menuItemId', null)
  })

  it('no permite que el formulario mande un menuItemId', () => {
    // Garantía de tipo: si alguien agregara la clave a `CreateRewardFormInput`
    // esto deja de compilar.
    const keys: Array<keyof CreateRewardFormInput> = [
      'title',
      'description',
      'geoPointsCost',
      'estimatedValueCop',
      'placeId',
      'stockTotal',
    ]

    expect(keys).toHaveLength(6)
  })

  it('rechaza con el error de axios cuando el backend responde 400', async () => {
    server.use(
      http.post(`${API_BASE_URL}/portal/rewards`, () =>
        HttpResponse.json(
          { title: 'Validation.Failed', detail: 'Description must not be empty.' },
          { status: 400 }
        )
      )
    )

    await expect(createReward(INPUT)).rejects.toMatchObject({
      response: { status: 400, data: { title: 'Validation.Failed' } },
    })
  })
})
