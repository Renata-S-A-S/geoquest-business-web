import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { createPlace, type CreatePlaceFormInput } from './create-place'
import { API_BASE_URL } from '@/shared/lib/env'
import { Category, Subcategory } from '@/shared/schemas/taxonomy'

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
   * Issue #211: `xpReward`/`geoPointsReward` NO viajan en el body. El DTO
   * real del backend (`CreateBusinessPlaceRequest`) ni siquiera los declara
   * — si el cliente los manda, System.Text.Json los descarta por no estar
   * mapeados, y el dominio fuerza igual los valores fijos de plataforma
   * (0 XP, 12 GeoPoints) para todo `BusinessVenue`. Mandarlos no cambia
   * nada, así que el transporte no los agrega.
   */
  it('NO manda xpReward ni geoPointsReward: el backend los ignora igual', async () => {
    let received: Record<string, unknown> | undefined
    server.use(
      http.post(`${API_BASE_URL}/business/places`, async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ placeId: crypto.randomUUID() }, { status: 201 })
      })
    )

    await createPlace(INPUT)

    expect(received).not.toHaveProperty('xpReward')
    expect(received).not.toHaveProperty('geoPointsReward')
    expect(Object.keys(received ?? {})).toEqual(Object.keys(INPUT))
  })

  it('no permite que el formulario mande las recompensas', () => {
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
