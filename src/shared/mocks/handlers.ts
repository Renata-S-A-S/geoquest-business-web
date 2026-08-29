import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '@/shared/lib/env'
import { readDb, writeDb } from '@/shared/mocks/db'
import { createPlaceInputSchema, type Place } from '@/shared/schemas/place'

/**
 * Handlers compartidos entre el navegador (`browser.ts`, `npm run dev` y el
 * deploy de Vercel) y Vitest (`msw-server.ts`) — un solo juego de rutas, sin
 * duplicar lógica. Endpoints propuestos (ver contratos-portal-b2b.md), no
 * confirmados contra el backend real, que todavía no existe.
 *
 * `geoPointsReward` en el POST es un valor mock arbitrario (12) — el cálculo
 * real del 25% del baseline de plataforma (ADR-041/043) vive en el backend,
 * no se reimplementa acá.
 */
export const handlers = [
  http.get(`${API_BASE_URL}/business/me`, () => {
    const { business } = readDb()
    return HttpResponse.json(business)
  }),

  http.get(`${API_BASE_URL}/places`, () => {
    const { places } = readDb()
    return HttpResponse.json(places)
  }),

  http.post(`${API_BASE_URL}/places`, async ({ request }) => {
    const body = await request.json()
    const parsed = createPlaceInputSchema.safeParse(body)
    if (!parsed.success) {
      return HttpResponse.json(
        { title: 'ValidationFailed', detail: parsed.error.issues[0]?.message, status: 400 },
        { status: 400 }
      )
    }

    const db = readDb()
    const newPlace: Place = {
      ...parsed.data,
      id: crypto.randomUUID(),
      businessId: db.business.id,
      placeType: 'BusinessVenue',
      timeZoneId: 'America/Bogota',
      xpReward: 0,
      geoPointsReward: 12,
      isVerified: false,
      status: 'Draft',
      totalCheckIns: 0,
      allowedInDiscoveryRoutes: false,
      createdAt: new Date().toISOString(),
    }
    db.places.push(newPlace)
    writeDb(db)

    return HttpResponse.json(newPlace, { status: 201 })
  }),

  http.get(`${API_BASE_URL}/rewards`, () => {
    const { rewards } = readDb()
    return HttpResponse.json(rewards)
  }),
]
