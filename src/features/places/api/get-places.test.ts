import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { getPlaces } from './get-places'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_PLACES } from '@/shared/mocks/seed'
import { Category, Subcategory } from '@/shared/schemas/taxonomy'

describe('getPlaces', () => {
  it('devuelve el RESUMEN de cada lugar, no el detalle', async () => {
    const places = await getPlaces()

    expect(places.map((p) => p.name)).toEqual(SEED_PLACES.map((p) => p.name))
    expect(places[0]).not.toHaveProperty('latitude')
    expect(places[0]).not.toHaveProperty('photos')
    expect(places[0]).not.toHaveProperty('description')
  })

  it('devuelve una lista vacía sin romper cuando el negocio todavía no creó ningún lugar', async () => {
    server.use(http.get(`${API_BASE_URL}/business/places`, () => HttpResponse.json([])))

    await expect(getPlaces()).resolves.toEqual([])
  })

  /**
   * `Deleted` faltaba en el schema anterior y es alcanzable: ningún
   * repositorio del backend filtra por estado. Sin este valor, un solo
   * lugar borrado rompía el parseo de la lista ENTERA.
   */
  it('acepta un lugar en estado Deleted, que el schema anterior omitía', async () => {
    const deleted = {
      placeId: '00000000-0000-0000-0000-0000000000aa',
      name: 'Sede cerrada',
      category: Category.Gastronomia,
      subcategory: Subcategory.Cafe,
      status: 'Deleted',
      xpReward: 50,
      geoPointsReward: 50,
    }
    server.use(http.get(`${API_BASE_URL}/business/places`, () => HttpResponse.json([deleted])))

    await expect(getPlaces()).resolves.toEqual([deleted])
  })

  it('rechaza con el error de axios cuando el backend responde 500 problem+json', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/places`, () =>
        HttpResponse.json(
          { title: 'InternalError', detail: 'No pudimos consultar los lugares' },
          { status: 500 }
        )
      )
    )

    await expect(getPlaces()).rejects.toMatchObject({
      response: { status: 500, data: { detail: 'No pudimos consultar los lugares' } },
    })
  })

  it('rechaza si el backend responde un objeto en vez de un arreglo (zod)', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/places`, () =>
        HttpResponse.json({ placeId: SEED_PLACES[0].placeId }, { status: 200 })
      )
    )

    await expect(getPlaces()).rejects.toBeTruthy()
  })

  it('rechaza la lista entera si UNA fila viola el contrato — falla ruidoso en vez de mostrar datos a medias', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/places`, () =>
        HttpResponse.json([{ placeId: 'no-es-un-uuid' }], { status: 200 })
      )
    )

    await expect(getPlaces()).rejects.toBeTruthy()
  })
})
