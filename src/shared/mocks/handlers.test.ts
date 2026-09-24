import { describe, expect, it, beforeEach, vi } from 'vitest'
import { apiClient } from '@/shared/lib/api-client'
import { readDb, resetDb, writeDb } from '@/shared/mocks/db'
import {
  SEED_BUSINESS,
  SEED_BUSINESS_STAFF,
  SEED_BUSINESS_STAFF_USERNAME,
  SEED_PLACES,
  SEED_REWARDS,
} from '@/shared/mocks/seed'
import { MOCK_BUSINESS_STAFF_PASSWORD } from '@/shared/mocks/business-staff-credentials.mock'
import { authTokensSchema } from '@/shared/schemas/auth'
import type {
  BusinessPlaceDetail,
  BusinessPlaceSummary,
  CreatedBusinessPlace,
} from '@/shared/schemas/business-place'
import { Category, Subcategory } from '@/shared/schemas/taxonomy'
import type { BusinessRewardSummary } from '@/shared/schemas/business-reward'

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

  it('GET /business-staff/me devuelve el staff semilla con username y role Owner en PascalCase', async () => {
    const { data } = await apiClient.get('/business-staff/me')
    expect(data).toMatchObject({
      ...SEED_BUSINESS_STAFF,
      username: SEED_BUSINESS_STAFF_USERNAME,
    })
    expect(data.role).toBe('Owner')
  })

  it('GET /business/places devuelve el RESUMEN de la semilla, no el detalle', async () => {
    const { data } = await apiClient.get<BusinessPlaceSummary[]>('/business/places')

    expect(data).toHaveLength(SEED_PLACES.length)
    expect(data.map((p) => p.name)).toEqual(SEED_PLACES.map((p) => p.name))
  })

  /**
   * La lista expone 7 campos; el detalle 12. Este caso fija la asimetría:
   * si el mock sirviera el detalle en la lista, el portal se acostumbraría
   * a campos que el backend real no manda, y eso recién se descubriría al
   * apagar los mocks.
   */
  it('GET /business/places NO expone descripción, coordenadas, radio ni fotos', async () => {
    const { data } = await apiClient.get<BusinessPlaceSummary[]>('/business/places')

    expect(Object.keys(data[0]).sort()).toEqual([
      'category',
      'geoPointsReward',
      'name',
      'placeId',
      'status',
      'subcategory',
      'xpReward',
    ])
  })

  it('GET /business/places/{id} devuelve el detalle completo', async () => {
    const { data } = await apiClient.get<BusinessPlaceDetail>(
      `/business/places/${SEED_PLACES[0].placeId}`
    )

    expect(data).toEqual(SEED_PLACES[0])
    expect(data.latitude).toBeTypeOf('number')
    expect(data.longitude).toBeTypeOf('number')
  })

  it('GET /business/places/{id} responde 404 problem+json para un id desconocido', async () => {
    await expect(
      apiClient.get('/business/places/00000000-0000-0000-0000-0000000000ff')
    ).rejects.toMatchObject({
      response: { status: 404, data: { title: 'GetBusinessPlaceByIdQuery.NotFound' } },
    })
  })

  /**
   * El `POST` responde 201 con SOLO el id, no con el agregado. Quien
   * necesite el lugar recién creado tiene que pedirlo después.
   */
  it('POST /business/places devuelve solo { placeId } y el lugar aparece en la lista', async () => {
    const input = {
      name: 'Café de la 70 — Sede Estadio',
      description: 'Sede nueva sobre la 70.',
      category: Category.Gastronomia,
      subcategory: Subcategory.Cafe,
      latitude: 6.253,
      longitude: -75.588,
      checkInRadiusMeters: 150,
      xpReward: 60,
      geoPointsReward: 60,
    }

    const created = await apiClient.post<CreatedBusinessPlace>('/business/places', input)
    expect(created.status).toBe(201)
    expect(Object.keys(created.data)).toEqual(['placeId'])

    const { data: after } = await apiClient.get<BusinessPlaceSummary[]>('/business/places')
    expect(after).toHaveLength(SEED_PLACES.length + 1)
    expect(after.map((p) => p.name)).toContain('Café de la 70 — Sede Estadio')
  })

  /**
   * Las fotos no viajan en la creación: se suben aparte contra
   * `POST /business/places/{id}/photos`. El lugar nace en `Draft` y sin
   * ninguna, que es lo que el backend declara legítimo — publicar sin
   * fotos devuelve 409, crear no.
   */
  it('POST /business/places crea el lugar en Draft y sin fotos', async () => {
    const input = {
      name: 'Café de la 70 — Sede Sin Fotos',
      description: 'Sin fotos todavía.',
      category: Category.Gastronomia,
      subcategory: Subcategory.Cafe,
      latitude: 6.253,
      longitude: -75.588,
      checkInRadiusMeters: 150,
      xpReward: 50,
      geoPointsReward: 50,
    }

    const created = await apiClient.post<CreatedBusinessPlace>('/business/places', input)
    const { data: detail } = await apiClient.get<BusinessPlaceDetail>(
      `/business/places/${created.data.placeId}`
    )

    expect(detail).toMatchObject({ status: 'Draft', photos: [] })
  })

  it('POST /business/places con datos inválidos responde 400 con el title punteado del backend', async () => {
    await expect(
      apiClient.post('/business/places', { name: 'sin el resto' })
    ).rejects.toMatchObject({
      response: { status: 400, data: { title: 'Validation.Failed' } },
    })
  })

  /**
   * El backend exige mínimo 50 en ambas recompensas porque crea el lugar
   * como `TouristSite`. Contradice a ADR-041/043; ver geoquest#191.
   */
  it('POST /business/places rechaza recompensas por debajo de 50', async () => {
    await expect(
      apiClient.post('/business/places', {
        name: 'Recompensa baja',
        description: 'Prueba.',
        category: Category.Gastronomia,
        subcategory: Subcategory.Cafe,
        latitude: 6.25,
        longitude: -75.58,
        checkInRadiusMeters: 100,
        xpReward: 10,
        geoPointsReward: 10,
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('POST /business/places rechaza una subcategoría que no pertenece a su categoría', async () => {
    await expect(
      apiClient.post('/business/places', {
        name: 'Taxonomía cruzada',
        description: 'Prueba.',
        category: Category.Gastronomia,
        subcategory: Subcategory.Hotel,
        latitude: 6.25,
        longitude: -75.58,
        checkInRadiusMeters: 100,
        xpReward: 60,
        geoPointsReward: 60,
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  /**
   * Las tres razones de rechazo de `Place.Activate`, contra el mock real.
   * La semilla las provee sin montaje: hay un `Active` (ya publicado) y un
   * `Draft` sin fotos.
   */
  it('POST /business/places/{id}/publish activa un borrador que tiene fotos', async () => {
    const draft = SEED_PLACES.find((place) => place.status === 'Draft')!

    // Primero se le da una foto, porque la semilla lo tiene sin ninguna.
    const db = readDb()
    db.places.find((place) => place.placeId === draft.placeId)!.photos = [
      'https://cdn.example/a.jpg',
    ]
    writeDb(db)

    const { data } = await apiClient.post(`/business/places/${draft.placeId}/publish`)

    expect(data).toEqual({ status: 'Active', visibleToExplorers: true })
  })

  it('POST /business/places/{id}/publish responde 409 cuando el borrador no tiene fotos', async () => {
    const draft = SEED_PLACES.find((place) => place.status === 'Draft')!

    await expect(
      apiClient.post(`/business/places/${draft.placeId}/publish`)
    ).rejects.toMatchObject({
      response: { status: 409, data: { title: 'Place.ActiveRequiresAtLeastOnePhoto' } },
    })
  })

  it('POST /business/places/{id}/publish responde 409 cuando el lugar ya está activo', async () => {
    const active = SEED_PLACES.find((place) => place.status === 'Active')!

    await expect(
      apiClient.post(`/business/places/${active.placeId}/publish`)
    ).rejects.toMatchObject({
      response: { status: 409, data: { title: 'Place.AlreadyActive' } },
    })
  })

  it('POST /business/places/{id}/publish responde 409 sobre un lugar borrado', async () => {
    const db = readDb()
    db.places[1].status = 'Deleted'
    writeDb(db)

    await expect(
      apiClient.post(`/business/places/${db.places[1].placeId}/publish`)
    ).rejects.toMatchObject({
      response: { status: 409, data: { title: 'Place.Deleted' } },
    })
  })

  it('POST /business/places/{id}/publish responde 404 para un id desconocido', async () => {
    await expect(
      apiClient.post('/business/places/00000000-0000-0000-0000-0000000000ff/publish')
    ).rejects.toMatchObject({
      response: { status: 404, data: { title: 'PublishBusinessPlaceCommand.NotFound' } },
    })
  })

  /**
   * `visibleToExplorers` sale del estado del NEGOCIO, no del lugar: el lugar
   * se activa igual, pero queda invisible si GeoQuest todavía no verificó al
   * comercio. Publicar y ser visible no son lo mismo.
   */
  it('POST /business/places/{id}/publish activa pero deja invisible si el negocio no está activo', async () => {
    const db = readDb()
    db.business.status = 'Pending'
    db.places[1].photos = ['https://cdn.example/a.jpg']
    writeDb(db)

    const { data } = await apiClient.post(`/business/places/${db.places[1].placeId}/publish`)

    expect(data).toEqual({ status: 'Active', visibleToExplorers: false })
  })

  it('GET /portal/rewards devuelve las recompensas del negocio', async () => {
    const { data } = await apiClient.get<BusinessRewardSummary[]>('/portal/rewards')

    expect(data).toHaveLength(SEED_REWARDS.length)
    expect(data.map((r) => r.status)).toEqual(['Published', 'Draft'])
  })

  /**
   * `GET /rewards` existe en el backend pero es **anónimo y global**:
   * devolvería el catálogo de la competencia. El mock NO lo sirve a
   * propósito — servirlo legitimaría el error y el portal se acostumbraría
   * a una fuente que no es suya.
   */
  it('NO sirve /rewards: ese listado es global y no es el del negocio', async () => {
    await expect(apiClient.get('/rewards')).rejects.toBeTruthy()
  })

  it('POST /portal/rewards crea la recompensa en Draft y sin imagen', async () => {
    const input = {
      title: 'Segundo postre gratis',
      description: 'Prueba de creación.',
      geoPointsCost: 90,
      estimatedValueCop: 11000,
      menuItemId: null,
      placeId: null,
      stockTotal: 10,
    }

    const created = await apiClient.post<{ rewardId: string }>('/portal/rewards', input)
    expect(created.status).toBe(201)
    expect(Object.keys(created.data)).toEqual(['rewardId'])

    const { data: after } = await apiClient.get<BusinessRewardSummary[]>('/portal/rewards')
    const persisted = after.find((r) => r.rewardId === created.data.rewardId)

    expect(persisted).toMatchObject({ status: 'Draft', imageUrl: null, stockRemaining: 10 })
  })

  /**
   * Precondición espejo del precedente de `Place`: así como un lugar no se
   * publica sin al menos una foto, una recompensa no se publica sin imagen.
   * La semilla en `Draft` no la tiene, que es justo el caso a bloquear.
   */
  it('POST /portal/rewards/{id}/publish responde 409 si la recompensa no tiene imagen', async () => {
    const draft = SEED_REWARDS.find((r) => r.status === 'Draft')

    await expect(
      apiClient.post(`/portal/rewards/${draft!.rewardId}/publish`, {})
    ).rejects.toMatchObject({
      response: { status: 409, data: { title: 'Reward.PublishRequiresImage' } },
    })
  })

  it('POST /portal/rewards/{id}/publish responde 409 si ya está publicada', async () => {
    const published = SEED_REWARDS.find((r) => r.status === 'Published')

    await expect(
      apiClient.post(`/portal/rewards/${published!.rewardId}/publish`, {})
    ).rejects.toMatchObject({
      response: { status: 409, data: { title: 'Reward.AlreadyPublished' } },
    })
  })

  it('POST /portal/rewards/{id}/publish responde 404 para un id desconocido', async () => {
    await expect(
      apiClient.post('/portal/rewards/00000000-0000-0000-0000-0000000000ff/publish', {})
    ).rejects.toMatchObject({
      response: { status: 404, data: { title: 'PublishRewardCommand.NotFound' } },
    })
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
