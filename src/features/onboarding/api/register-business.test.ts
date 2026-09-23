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
  commercialAgreementAccepted: true,
}

describe('registerBusiness', () => {
  it('devuelve el Business creado con status Pending (usa el handler mock real)', async () => {
    // `commercialAgreementAccepted` is input-only — `businessSchema.parse`
    // strips it, so it's excluded here rather than asserted as a property
    // of the persisted `Business`.
    const { commercialAgreementAccepted: _accepted, ...expectedPersisted } = validInput
    const business = await registerBusiness(validInput)
    expect(business).toMatchObject({ ...expectedPersisted, status: 'Pending' })
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
