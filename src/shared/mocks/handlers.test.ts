import { describe, expect, it, beforeEach, vi } from 'vitest'
import { apiClient } from '@/shared/lib/api-client'
import { resetDb } from '@/shared/mocks/db'
import type { Place } from '@/shared/schemas/place'

/**
 * Prueba el round-trip completo GET -> POST -> GET a través de `apiClient`
 * real (no `fetch` crudo) contra los handlers compartidos — es la prueba
 * directa de la verificación #2 del plan: "una pantalla de prueba lee y
 * escribe una entidad contra MSW, y el dato sobrevive a un reload". Acá el
 * "reload" es una nueva lectura después de la escritura, sobre el mismo
 * storage — mismo contrato que un F5 real en el navegador.
 */
describe('mock handlers — round-trip de persistencia', () => {
  beforeEach(() => resetDb())

  it('GET /business/me devuelve el negocio semilla', async () => {
    const { data } = await apiClient.get('/business/me')
    expect(data).toMatchObject({ displayName: 'Café de la 70' })
  })

  it('GET /places devuelve la semilla inicial', async () => {
    const { data } = await apiClient.get<Place[]>('/places')
    expect(data).toHaveLength(1)
  })

  it('POST /places crea un lugar y GET /places lo refleja después', async () => {
    const input = {
      name: 'Café de la 70 — Sede Estadio',
      category: 'gastronomia',
      subcategory: 'cafe',
      coordinates: { lat: 6.253, lng: -75.588 },
      checkInRadiusMeters: 150,
      photos: ['https://picsum.photos/seed/cafe70-2/400/300'],
    }

    const created = await apiClient.post<Place>('/places', input)
    expect(created.status).toBe(201)
    expect(created.data).toMatchObject({
      name: 'Café de la 70 — Sede Estadio',
      placeType: 'BusinessVenue',
      xpReward: 0,
      status: 'Draft',
    })

    const { data: after } = await apiClient.get<Place[]>('/places')
    expect(after).toHaveLength(2)
    expect(after.map((p) => p.name)).toContain('Café de la 70 — Sede Estadio')
  })

  it('POST /places con datos inválidos responde 400 en formato problem+json', async () => {
    await expect(
      apiClient.post('/places', { name: 'sin coordinates ni fotos' })
    ).rejects.toMatchObject({
      response: {
        status: 400,
        data: { title: 'ValidationFailed' },
      },
    })
  })

  it('GET /rewards devuelve la semilla inicial', async () => {
    const { data } = await apiClient.get('/rewards')
    expect(data).toHaveLength(1)
  })

  it('POST /business/register crea el negocio y GET /business/me lo refleja después', async () => {
    const { commercialAgreementAccepted: _accepted, ...expectedPersisted } = {
      legalName: 'Panadería El Trigal SAS',
      displayName: 'El Trigal',
      email: 'contacto@eltrigal.co',
      category: 'gastronomia',
      legalDocumentType: 'NIT',
      legalDocumentNumber: '901234567-8',
      commercialAgreementAccepted: true,
    }
    const input = { ...expectedPersisted, commercialAgreementAccepted: true }

    const created = await apiClient.post('/business/register', input, { skipSessionAuth: true })
    expect(created.status).toBe(201)
    expect(created.data).toMatchObject({ ...expectedPersisted, status: 'Pending' })
    expect(created.data).not.toHaveProperty('commercialAgreementAccepted')

    const { data: after } = await apiClient.get('/business/me')
    expect(after).toMatchObject({ displayName: 'El Trigal', status: 'Pending' })
  })

  it('POST /business/register sin aceptar el acuerdo comercial responde 400', async () => {
    const input = {
      legalName: 'Panadería El Trigal SAS',
      displayName: 'El Trigal',
      email: 'contacto@eltrigal.co',
      category: 'gastronomia',
      legalDocumentType: 'NIT',
      legalDocumentNumber: '901234567-8',
      commercialAgreementAccepted: false,
    }

    await expect(
      apiClient.post('/business/register', input, { skipSessionAuth: true })
    ).rejects.toMatchObject({
      response: {
        status: 400,
        data: { title: 'ValidationFailed' },
      },
    })
  })

  it('POST /business/register sella commercialAgreementSignedAt con la hora del servidor', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-23T10:00:00.000Z'))

    try {
      const input = {
        legalName: 'Panadería El Trigal SAS',
        displayName: 'El Trigal',
        email: 'contacto@eltrigal.co',
        category: 'gastronomia',
        legalDocumentType: 'NIT',
        legalDocumentNumber: '901234567-8',
        commercialAgreementAccepted: true,
      }

      const created = await apiClient.post('/business/register', input, { skipSessionAuth: true })

      expect(created.data.commercialAgreementSignedAt).toBe('2026-09-23T10:00:00.000Z')
      expect(created.data.commercialAgreementSignedAt).toBe(created.data.createdAt)
    } finally {
      vi.useRealTimers()
    }
  })

  it('POST /business/register con datos inválidos responde 400 en formato problem+json', async () => {
    await expect(
      apiClient.post(
        '/business/register',
        { legalName: 'Sin el resto de los campos' },
        { skipSessionAuth: true }
      )
    ).rejects.toMatchObject({
      response: {
        status: 400,
        data: { title: 'ValidationFailed' },
      },
    })
  })
})
