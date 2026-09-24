import { HttpResponse, http } from 'msw'
import { describe, expect, it, beforeEach } from 'vitest'
import { server } from '@/test/msw-server'
import { patchBusinessMe } from './patch-business-me'
import { API_BASE_URL } from '@/shared/lib/env'
import { resetDb } from '@/shared/mocks/db'
import { SEED_BUSINESS } from '@/shared/mocks/seed'

describe('patchBusinessMe', () => {
  beforeEach(() => resetDb())

  it('actualiza displayName y devuelve el Business completo parseado (usa el handler mock real)', async () => {
    const business = await patchBusinessMe({ displayName: 'Café de la 70 Renovado' })
    expect(business).toEqual({ ...SEED_BUSINESS, displayName: 'Café de la 70 Renovado' })
  })

  it('acepta las tres claves editables (displayName, category, email) a la vez', async () => {
    const business = await patchBusinessMe({
      displayName: 'Café de la 70 Renovado',
      category: 'servicios',
      email: 'nuevo-contacto@cafe70.co',
    })
    expect(business).toMatchObject({
      displayName: 'Café de la 70 Renovado',
      category: 'servicios',
      email: 'nuevo-contacto@cafe70.co',
    })
  })

  it('rechaza con el error de axios cuando el backend responde 400 problem+json', async () => {
    server.use(
      http.patch(`${API_BASE_URL}/business/me`, () =>
        HttpResponse.json(
          { title: 'ValidationFailed', detail: 'El email es inválido' },
          { status: 400 }
        )
      )
    )

    await expect(patchBusinessMe({ email: 'x' })).rejects.toMatchObject({
      response: { status: 400, data: { detail: 'El email es inválido' } },
    })
  })

  it('rechaza con el error de axios cuando el backend responde 409 ReadOnlyField', async () => {
    server.use(
      http.patch(`${API_BASE_URL}/business/me`, () =>
        HttpResponse.json(
          {
            title: 'ReadOnlyField',
            detail: 'No se pueden modificar campos de solo lectura del negocio.',
          },
          { status: 409 }
        )
      )
    )

    await expect(patchBusinessMe({ displayName: 'X' })).rejects.toMatchObject({
      response: { status: 409, data: { title: 'ReadOnlyField' } },
    })
  })

  it('rechaza si el backend responde una forma inválida (zod)', async () => {
    server.use(
      http.patch(`${API_BASE_URL}/business/me`, () =>
        HttpResponse.json({ nope: true }, { status: 200 })
      )
    )

    await expect(patchBusinessMe({ displayName: 'X' })).rejects.toBeTruthy()
  })
})
