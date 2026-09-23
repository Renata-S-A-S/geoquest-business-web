import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { getBusinessMe } from './get-business-me'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS } from '@/shared/mocks/seed'

describe('getBusinessMe', () => {
  it('devuelve el Business parseado (usa el handler mock real, negocio semilla)', async () => {
    const business = await getBusinessMe()
    expect(business).toEqual(SEED_BUSINESS)
  })

  it('rechaza con el error de axios cuando el backend responde 500 problem+json', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/me`, () =>
        HttpResponse.json(
          { title: 'InternalError', detail: 'No pudimos consultar el negocio' },
          { status: 500 }
        )
      )
    )

    await expect(getBusinessMe()).rejects.toMatchObject({
      response: { status: 500, data: { detail: 'No pudimos consultar el negocio' } },
    })
  })

  it('rechaza si el backend responde una forma inválida (zod)', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/me`, () =>
        HttpResponse.json({ nope: true }, { status: 200 })
      )
    )

    await expect(getBusinessMe()).rejects.toBeTruthy()
  })
})
