import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { getPlaces } from './get-places'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_PLACES } from '@/shared/mocks/seed'

describe('getPlaces', () => {
  it('devuelve la lista de Place parseada (usa el handler mock real, lugares semilla)', async () => {
    const places = await getPlaces()
    expect(places).toEqual(SEED_PLACES)
  })

  it('devuelve una lista vacía sin romper cuando el negocio todavía no creó ningún lugar', async () => {
    server.use(http.get(`${API_BASE_URL}/business/me/places`, () => HttpResponse.json([])))

    await expect(getPlaces()).resolves.toEqual([])
  })

  it('acepta un Place en Draft sin fotos — el mínimo de 1 se exige al publicar (#34), no al leer', async () => {
    const draft = { ...SEED_PLACES[0], status: 'Draft' as const, photos: [] }
    server.use(http.get(`${API_BASE_URL}/business/me/places`, () => HttpResponse.json([draft])))

    await expect(getPlaces()).resolves.toEqual([draft])
  })

  it('rechaza con el error de axios cuando el backend responde 500 problem+json', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/me/places`, () =>
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
      http.get(`${API_BASE_URL}/business/me/places`, () =>
        HttpResponse.json(SEED_PLACES[0], { status: 200 })
      )
    )

    await expect(getPlaces()).rejects.toBeTruthy()
  })

  it('rechaza la lista entera si UNA fila viola el contrato — falla ruidoso en vez de mostrar datos a medias', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/me/places`, () =>
        HttpResponse.json([SEED_PLACES[0], { id: 'no-es-un-uuid' }], { status: 200 })
      )
    )

    await expect(getPlaces()).rejects.toBeTruthy()
  })
})
