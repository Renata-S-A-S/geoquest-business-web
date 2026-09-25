import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { getRewards } from './get-rewards'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS, SEED_REWARDS } from '@/shared/mocks/seed'

const businessId = SEED_BUSINESS.id
const REWARDS_URL = `${API_BASE_URL}/portal/businesses/${businessId}/rewards`

describe('getRewards', () => {
  it('devuelve las recompensas del negocio parseadas (handler mock real)', async () => {
    const rewards = await getRewards(businessId)

    expect(rewards.map((r) => r.title)).toEqual(SEED_REWARDS.map((r) => r.title))
  })

  it('trae los borradores además de las publicadas — el borrador es el que tiene trabajo pendiente', async () => {
    const rewards = await getRewards(businessId)

    expect(rewards.map((r) => r.status)).toContain('Draft')
    expect(rewards.map((r) => r.status)).toContain('Published')
  })

  it('devuelve una lista vacía sin romper cuando el negocio no creó ninguna', async () => {
    server.use(http.get(REWARDS_URL, () => HttpResponse.json([])))

    await expect(getRewards(businessId)).resolves.toEqual([])
  })

  /**
   * Este caso es el que más importa del archivo. `GET /rewards` existe en el
   * backend pero es anónimo y global: si `getRewards` cayera ahí ante un
   * fallo, el negocio vería el catálogo de la competencia como propio, sin
   * ningún error visible. Es mejor que la pantalla falle a la vista.
   */
  it('NO cae a /rewards cuando el endpoint del portal falla', async () => {
    let globalCalled = false
    server.use(
      http.get(REWARDS_URL, () => HttpResponse.json({}, { status: 404 })),
      http.get(`${API_BASE_URL}/rewards`, () => {
        globalCalled = true
        return HttpResponse.json([])
      })
    )

    await expect(getRewards(businessId)).rejects.toBeTruthy()
    expect(globalCalled).toBe(false)
  })

  it('rechaza con el error de axios cuando el backend responde 500 problem+json', async () => {
    server.use(
      http.get(REWARDS_URL, () =>
        HttpResponse.json(
          { title: 'InternalError', detail: 'No pudimos consultar las recompensas' },
          { status: 500 }
        )
      )
    )

    await expect(getRewards(businessId)).rejects.toMatchObject({
      response: { status: 500, data: { detail: 'No pudimos consultar las recompensas' } },
    })
  })

  it('rechaza la lista entera si UNA fila viola el contrato', async () => {
    server.use(http.get(REWARDS_URL, () => HttpResponse.json([{ rewardId: 'no-es-un-uuid' }])))

    await expect(getRewards(businessId)).rejects.toBeTruthy()
  })

  /**
   * `Active` y `Exhausted` eran los valores del schema anterior. Si el
   * backend los emitiera, el parseo debe fallar en vez de aceptarlos en
   * silencio: son señal de que algo quedó desalineado.
   */
  it('rechaza los estados inventados por el schema anterior', async () => {
    server.use(
      http.get(REWARDS_URL, () => HttpResponse.json([{ ...SEED_REWARDS[0], status: 'Active' }]))
    )

    await expect(getRewards(businessId)).rejects.toBeTruthy()
  })
})
