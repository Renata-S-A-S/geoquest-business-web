import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { registerBusiness } from './register-business'
import { API_BASE_URL } from '@/shared/lib/env'
import { useBusinessSessionStore } from '@/shared/stores/business-session-store'
import type { RegisterBusinessInput } from '@/shared/schemas/business'

const validInput: RegisterBusinessInput = {
  legalName: 'Café de la 70 SAS',
  displayName: 'Café de la 70',
  email: 'contacto@cafe70.co',
  category: 'gastronomia',
  legalDocumentType: 'NIT',
  legalDocumentNumber: '900123456-7',
  commercialAgreementAccepted: true,
  termsAccepted: true,
}

afterEach(() => {
  useBusinessSessionStore.getState().logout()
})

describe('registerBusiness', () => {
  it('devuelve el MyBusiness creado con status PendingVerification (usa el handler mock real)', async () => {
    const business = await registerBusiness(validInput)
    expect(business).toMatchObject({ name: validInput.displayName, status: 'PendingVerification' })
  })

  it('manda el bearer token de sesión en vez de skipSessionAuth (PR10: alta autenticada, geoquest#212)', async () => {
    useBusinessSessionStore.getState().login({
      accessToken: 'a-real-access-token',
      accessTokenExpiresAtUtc: '2026-09-25T00:00:00Z',
      refreshToken: 'a-refresh-token',
      refreshTokenExpiresAtUtc: '2026-10-25T00:00:00Z',
    })
    let capturedAuthHeader: string | null = null
    server.use(
      http.post(`${API_BASE_URL}/business/register`, ({ request }) => {
        capturedAuthHeader = request.headers.get('Authorization')
        return HttpResponse.json(
          {
            businessId: '00000000-0000-0000-0000-000000000099',
            name: validInput.displayName,
            status: 'PendingVerification',
            rejectionReason: null,
            rejectedAtUtc: null,
            hasLegalDocument: false,
            legalDocumentWaived: false,
            logoUrl: null,
            hasVerificationVideo: false,
          },
          { status: 201 }
        )
      })
    )

    await registerBusiness(validInput)

    expect(capturedAuthHeader).toBe('Bearer a-real-access-token')
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
