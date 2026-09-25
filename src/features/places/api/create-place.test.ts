import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { createPlace, type CreatePlaceFormInput } from './create-place'
import { API_BASE_URL } from '@/shared/lib/env'
import { Category, Subcategory } from '@/shared/schemas/taxonomy'
import {
  BUSINESS_VENUE_GEO_POINTS_REWARD,
  BUSINESS_VENUE_XP_REWARD,
} from '@/shared/schemas/business-place'

const INPUT: CreatePlaceFormInput = {
  name: 'Café de la 70 — Sede Estadio',
  description: 'Sede nueva sobre la 70, frente al estadio.',
  category: Category.Gastronomia,
  subcategory: Subcategory.Cafe,
  latitude: 6.253,
  longitude: -75.588,
  checkInRadiusMeters: 150,
}

describe('createPlace', () => {
  it('crea el lugar contra el handler mock y devuelve solo el id', async () => {
    const created = await createPlace(INPUT)

    expect(created.placeId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(Object.keys(created)).toEqual(['placeId'])
  })

  /**
   * El caso central de este archivo.
   *
   * RN-GAM-02/03: un `BusinessVenue` otorga **0 XP siempre** —"consumir no es
   * explorar"— y RN-GAM-10 fija sus GeoPoints en 12 desde la plataforma. El
   * negocio no elige ninguno, así que el formulario no los pide y el
   * transporte los completa con los valores de la regla.
   *
   * ⚠️ El backend real rechazará estos valores con 400 hasta que se corrija
   * (exige mínimo 50 porque crea `TouristSite`). Se mandan igual los
   * correctos: preferimos un 400 visible y una issue abierta antes que datos
   * que contradicen la regla en silencio. Ver geoquest#191.
   */
  it('completa las recompensas con los valores de la REGLA: 0 XP y 12 GeoPoints', async () => {
    let received: Record<string, unknown> | undefined
    server.use(
      http.post(`${API_BASE_URL}/business/places`, async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ placeId: crypto.randomUUID() }, { status: 201 })
      })
    )

    await createPlace(INPUT)

    expect(received).toMatchObject({
      xpReward: BUSINESS_VENUE_XP_REWARD,
      geoPointsReward: BUSINESS_VENUE_GEO_POINTS_REWARD,
    })
    // Explícito, para que el número quede a la vista de quien lea el test:
    // cero XP no es "el mínimo", es la regla.
    expect(received?.xpReward).toBe(0)
    expect(received?.geoPointsReward).toBe(12)
  })

  it('no permite que el formulario sobrescriba las recompensas', () => {
    // Garantía de tipo: `CreatePlaceFormInput` no tiene esas claves, así que
    // un formulario no puede mandarlas ni por accidente. Si alguien las
    // agregara al tipo, esto deja de compilar.
    const keys: Array<keyof CreatePlaceFormInput> = [
      'name',
      'description',
      'category',
      'subcategory',
      'latitude',
      'longitude',
      'checkInRadiusMeters',
    ]

    expect(keys).toHaveLength(7)
  })

  it('reenvía tal cual el resto de los campos del formulario', async () => {
    let received: Record<string, unknown> | undefined
    server.use(
      http.post(`${API_BASE_URL}/business/places`, async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ placeId: crypto.randomUUID() }, { status: 201 })
      })
    )

    await createPlace(INPUT)

    expect(received).toMatchObject(INPUT)
  })

  it('rechaza con el error de axios cuando el backend responde 400 problem+json', async () => {
    server.use(
      http.post(`${API_BASE_URL}/business/places`, () =>
        HttpResponse.json(
          { title: 'Validation.Failed', detail: 'Description must not be empty.' },
          { status: 400 }
        )
      )
    )

    await expect(createPlace(INPUT)).rejects.toMatchObject({
      response: { status: 400, data: { title: 'Validation.Failed' } },
    })
  })

  /**
   * La taxonomía cruzada la valida el servidor (400 `Place.InvalidTaxonomy`).
   * El formulario también la chequea antes de enviar, pero este caso fija
   * que el rechazo del servidor se propaga si llegara a pasar.
   */
  it('propaga el rechazo de taxonomía cruzada del servidor', async () => {
    await expect(
      createPlace({ ...INPUT, category: Category.Gastronomia, subcategory: Subcategory.Hotel })
    ).rejects.toMatchObject({
      response: { status: 400, data: { title: 'Place.InvalidTaxonomy' } },
    })
  })

  it('rechaza si la respuesta no trae un placeId válido', async () => {
    server.use(
      http.post(`${API_BASE_URL}/business/places`, () =>
        HttpResponse.json({ placeId: 'no-es-un-uuid' }, { status: 201 })
      )
    )

    await expect(createPlace(INPUT)).rejects.toBeTruthy()
  })
})
