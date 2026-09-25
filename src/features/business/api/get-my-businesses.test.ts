import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { setMockBusiness } from '@/test/mock-business'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS_SCENARIOS } from '@/shared/mocks/seed'
import { getMyBusinesses } from './get-my-businesses'

describe('getMyBusinesses', () => {
  it('devuelve un array con el MyBusiness parseado cuando el explorador es dueño (handler mock real)', async () => {
    const businesses = await getMyBusinesses()
    expect(businesses).toEqual([SEED_BUSINESS_SCENARIOS.Active])
  })

  it('devuelve [] cuando el explorador no tiene negocio propio (escenario none)', async () => {
    setMockBusiness('none')

    await expect(getMyBusinesses()).resolves.toEqual([])
  })

  it('refleja el status Rejected sembrado, con motivo y fecha', async () => {
    setMockBusiness('Rejected')

    const [business] = await getMyBusinesses()
    expect(business).toMatchObject({
      status: 'Rejected',
      rejectionReason: SEED_BUSINESS_SCENARIOS.Rejected!.rejectionReason,
    })
  })

  it('rechaza con el error de axios cuando el backend responde 500 problem+json', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/mine`, () =>
        HttpResponse.json(
          { title: 'InternalError', detail: 'No pudimos consultar tus negocios' },
          { status: 500 }
        )
      )
    )

    await expect(getMyBusinesses()).rejects.toMatchObject({
      response: { status: 500, data: { detail: 'No pudimos consultar tus negocios' } },
    })
  })

  it('rechaza si el backend responde una forma inválida (zod) — objeto suelto en vez de array', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/mine`, () =>
        HttpResponse.json({ businessId: 'not-an-array' }, { status: 200 })
      )
    )

    await expect(getMyBusinesses()).rejects.toBeTruthy()
  })
})
