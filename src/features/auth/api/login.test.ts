import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS_STAFF } from '@/shared/mocks/seed'
import { MOCK_BUSINESS_STAFF_PASSWORD } from '@/shared/mocks/business-staff-credentials.mock'
import { login } from './login'
import type { LoginInput } from '@/shared/schemas/auth'

const validInput: LoginInput = {
  email: SEED_BUSINESS_STAFF.email,
  password: MOCK_BUSINESS_STAFF_PASSWORD,
}

describe('login', () => {
  it('devuelve AuthTokens con el par mock aceptado (usa el handler real)', async () => {
    const tokens = await login(validInput)
    expect(tokens).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    })
  })

  it('rechaza con el error de axios cuando el backend responde 401 problem+json', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/login`, () =>
        HttpResponse.json(
          { title: 'InvalidCredentials', detail: 'Correo o contraseña incorrectos.' },
          { status: 401 }
        )
      )
    )

    await expect(login(validInput)).rejects.toMatchObject({
      response: { status: 401, data: { detail: 'Correo o contraseña incorrectos.' } },
    })
  })

  it('rechaza si el backend responde una forma inválida (zod)', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/login`, () =>
        HttpResponse.json({ nope: true }, { status: 200 })
      )
    )

    await expect(login(validInput)).rejects.toBeTruthy()
  })
})
