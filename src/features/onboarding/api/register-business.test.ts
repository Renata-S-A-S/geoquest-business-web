import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { registerBusiness } from './register-business'
import { API_BASE_URL } from '@/shared/lib/env'
import type { RegisterBusinessInput } from '@/shared/schemas/business'

const validInput: RegisterBusinessInput = {
  legalName: 'Café de la 70 SAS',
  displayName: 'Café de la 70',
  email: 'contacto@cafe70.co',
  category: 'gastronomia',
  legalDocumentType: 'NIT',
  legalDocumentNumber: '900123456-7',
}

describe('registerBusiness', () => {
  it('devuelve el Business creado con status Pending (usa el handler mock real)', async () => {
    const business = await registerBusiness(validInput)
    expect(business).toMatchObject({ ...validInput, status: 'Pending' })
  })

  it('rechaza con el error de axios cuando el backend responde 400 problem+json', async () => {
    server.use(
      http.post(`${API_BASE_URL}/business/register`, () =>
        HttpResponse.json(
          { title: 'ValidationFailed', detail: 'El email es inválido' },
          { status: 400 }
        )
      )
    )

    await expect(registerBusiness(validInput)).rejects.toMatchObject({
      response: { status: 400, data: { detail: 'El email es inválido' } },
    })
  })

  it('rechaza si el backend responde una forma inválida (zod)', async () => {
    server.use(
      http.post(`${API_BASE_URL}/business/register`, () =>
        HttpResponse.json({ nope: true }, { status: 201 })
      )
    )

    await expect(registerBusiness(validInput)).rejects.toBeTruthy()
  })
})
