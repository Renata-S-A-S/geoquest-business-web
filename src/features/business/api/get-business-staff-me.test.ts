import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { getBusinessStaffMe } from './get-business-staff-me'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS_STAFF_ME } from '@/shared/mocks/seed'

describe('getBusinessStaffMe', () => {
  it('devuelve el BusinessStaffMe parseado (usa el handler mock real, staff semilla)', async () => {
    const staff = await getBusinessStaffMe()
    expect(staff).toEqual(SEED_BUSINESS_STAFF_ME)
  })

  it('rechaza con el error de axios cuando el backend responde 500 problem+json', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business-staff/me`, () =>
        HttpResponse.json(
          { title: 'InternalError', detail: 'No pudimos consultar el staff' },
          { status: 500 }
        )
      )
    )

    await expect(getBusinessStaffMe()).rejects.toMatchObject({
      response: { status: 500, data: { detail: 'No pudimos consultar el staff' } },
    })
  })

  it('rechaza si el backend responde una forma inválida (zod, sin username)', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business-staff/me`, () =>
        HttpResponse.json({ nope: true }, { status: 200 })
      )
    )

    await expect(getBusinessStaffMe()).rejects.toBeTruthy()
  })
})
