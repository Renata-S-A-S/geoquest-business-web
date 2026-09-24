import { describe, expect, it, beforeEach, vi } from 'vitest'
import { apiClient } from '@/shared/lib/api-client'
import { resetDb } from '@/shared/mocks/db'
import { SEED_BUSINESS, SEED_BUSINESS_STAFF } from '@/shared/mocks/seed'
import { MOCK_BUSINESS_STAFF_PASSWORD } from '@/shared/mocks/business-staff-credentials.mock'
import { authTokensSchema } from '@/shared/schemas/auth'
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

  it('PATCH /business/me actualiza displayName y GET /business/me lo refleja después', async () => {
    const patched = await apiClient.patch('/business/me', {
      displayName: 'Café de la 70 Renovado',
    })
    expect(patched.status).toBe(200)
    expect(patched.data).toMatchObject({ displayName: 'Café de la 70 Renovado' })

    const { data: after } = await apiClient.get('/business/me')
    expect(after).toMatchObject({ displayName: 'Café de la 70 Renovado' })
  })

  it('PATCH /business/me con solo category no toca displayName ni email (semántica PATCH parcial)', async () => {
    const patched = await apiClient.patch('/business/me', { category: 'servicios' })
    expect(patched.data).toMatchObject({
      category: 'servicios',
      displayName: SEED_BUSINESS.displayName,
      email: SEED_BUSINESS.email,
    })
  })

  it('PATCH /business/me devuelve el agregado Business completo, no un eco del patch', async () => {
    const patched = await apiClient.patch('/business/me', { displayName: 'Nuevo Nombre' })
    expect(patched.data).toEqual({ ...SEED_BUSINESS, displayName: 'Nuevo Nombre' })
  })

  it('PATCH /business/me con body vacío responde 400 ValidationFailed', async () => {
    await expect(apiClient.patch('/business/me', {})).rejects.toMatchObject({
      response: { status: 400, data: { title: 'ValidationFailed' } },
    })
  })

  it('PATCH /business/me con un email inválido responde 400 ValidationFailed', async () => {
    await expect(
      apiClient.patch('/business/me', { email: 'no-es-un-email' })
    ).rejects.toMatchObject({
      response: { status: 400, data: { title: 'ValidationFailed' } },
    })
  })

  it('PATCH /business/me intentando cambiar legalName responde 409 ReadOnlyField y NO lo aplica', async () => {
    await expect(
      apiClient.patch('/business/me', { legalName: 'Otro Nombre Legal SAS' })
    ).rejects.toMatchObject({
      response: { status: 409, data: { title: 'ReadOnlyField' } },
    })

    const { data: after } = await apiClient.get('/business/me')
    expect(after.legalName).toBe(SEED_BUSINESS.legalName)
  })

  it('PATCH /business/me intentando cambiar legalDocumentNumber responde 409 ReadOnlyField y NO lo aplica', async () => {
    await expect(
      apiClient.patch('/business/me', { legalDocumentNumber: '999999999-9' })
    ).rejects.toMatchObject({
      response: { status: 409, data: { title: 'ReadOnlyField' } },
    })

    const { data: after } = await apiClient.get('/business/me')
    expect(after.legalDocumentNumber).toBe(SEED_BUSINESS.legalDocumentNumber)
  })

  it('PATCH /business/me mezclando un campo editable con uno congelado rechaza el request entero (409, nada se aplica)', async () => {
    await expect(
      apiClient.patch('/business/me', {
        displayName: 'Nombre Que No Debería Aplicarse',
        legalDocumentNumber: '999999999-9',
      })
    ).rejects.toMatchObject({
      response: { status: 409, data: { title: 'ReadOnlyField' } },
    })

    const { data: after } = await apiClient.get('/business/me')
    expect(after.displayName).toBe(SEED_BUSINESS.displayName)
  })

  it('PATCH /business/me intentando cambiar un campo server-owned (status) también responde 409 ReadOnlyField', async () => {
    await expect(apiClient.patch('/business/me', { status: 'Suspended' })).rejects.toMatchObject({
      response: { status: 409, data: { title: 'ReadOnlyField' } },
    })
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
    const {
      commercialAgreementAccepted: _accepted,
      termsAccepted: _terms,
      ...expectedPersisted
    } = {
      legalName: 'Panadería El Trigal SAS',
      displayName: 'El Trigal',
      email: 'contacto@eltrigal.co',
      category: 'gastronomia',
      legalDocumentType: 'NIT',
      legalDocumentNumber: '901234567-8',
      commercialAgreementAccepted: true,
      termsAccepted: true,
    }
    const input = { ...expectedPersisted, commercialAgreementAccepted: true, termsAccepted: true }

    const created = await apiClient.post('/business/register', input, { skipSessionAuth: true })
    expect(created.status).toBe(201)
    expect(created.data).toMatchObject({ ...expectedPersisted, status: 'Pending' })
    expect(created.data).not.toHaveProperty('commercialAgreementAccepted')
    expect(created.data).not.toHaveProperty('termsAccepted')

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
      termsAccepted: true,
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

  it('POST /business/register sin aceptar los Términos y Condiciones responde 400', async () => {
    const input = {
      legalName: 'Panadería El Trigal SAS',
      displayName: 'El Trigal',
      email: 'contacto@eltrigal.co',
      category: 'gastronomia',
      legalDocumentType: 'NIT',
      legalDocumentNumber: '901234567-8',
      commercialAgreementAccepted: true,
      termsAccepted: false,
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
        termsAccepted: true,
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

  it('POST /business/register con categoría "gastronomia" persiste isGoogleMapsVerified true y un place id', async () => {
    const input = {
      legalName: 'Panadería El Trigal SAS',
      displayName: 'El Trigal',
      email: 'contacto@eltrigal.co',
      category: 'gastronomia',
      legalDocumentType: 'NIT',
      legalDocumentNumber: '901234567-8',
      commercialAgreementAccepted: true,
      termsAccepted: true,
    }

    const created = await apiClient.post('/business/register', input, { skipSessionAuth: true })

    expect(created.data).toMatchObject({
      isGoogleMapsVerified: true,
      googleMapsPlaceId: 'ChIJ_mock_gastronomia',
    })
  })

  it('POST /business/register con categoría "servicios" persiste isGoogleMapsVerified false y googleMapsPlaceId null', async () => {
    const input = {
      legalName: 'Plomería Rápida SAS',
      displayName: 'Plomería Rápida',
      email: 'contacto@plomeriarapida.co',
      category: 'servicios',
      legalDocumentType: 'NIT',
      legalDocumentNumber: '901234568-9',
      commercialAgreementAccepted: true,
      termsAccepted: true,
    }

    const created = await apiClient.post('/business/register', input, { skipSessionAuth: true })

    expect(created.data).toMatchObject({
      isGoogleMapsVerified: false,
      googleMapsPlaceId: null,
    })
  })

  it('POST /auth/login con el par mock aceptado devuelve 200 y un body que valida contra authTokensSchema', async () => {
    const { data, status } = await apiClient.post(
      '/auth/login',
      { email: SEED_BUSINESS_STAFF.email, password: MOCK_BUSINESS_STAFF_PASSWORD },
      { skipSessionAuth: true }
    )

    expect(status).toBe(200)
    expect(() => authTokensSchema.parse(data)).not.toThrow()
  })

  it('POST /auth/login con contraseña incorrecta responde 401 problem+json con detail', async () => {
    await expect(
      apiClient.post(
        '/auth/login',
        { email: SEED_BUSINESS_STAFF.email, password: 'wrong-password' },
        { skipSessionAuth: true }
      )
    ).rejects.toMatchObject({
      response: { status: 401, data: { detail: expect.any(String) } },
    })
  })

  it('POST /auth/login con body malformado responde 400', async () => {
    await expect(
      apiClient.post('/auth/login', { email: 'not-an-email' }, { skipSessionAuth: true })
    ).rejects.toMatchObject({
      response: { status: 400 },
    })
  })
})
