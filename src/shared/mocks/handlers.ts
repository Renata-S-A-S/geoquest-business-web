import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '@/shared/lib/env'
import { readDb, writeDb } from '@/shared/mocks/db'
import { resolveGoogleMapsVerification } from '@/shared/mocks/google-maps-verification.mock'
import { isValidMockCredential } from '@/shared/mocks/business-staff-credentials.mock'
import { createPlaceInputSchema, type Place } from '@/shared/schemas/place'
import { registerBusinessInputSchema, type Business } from '@/shared/schemas/business'
import { loginInputSchema, type AuthTokens } from '@/shared/schemas/auth'

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

  http.post(`${API_BASE_URL}/business/register`, async ({ request }) => {
    const body = await request.json()
    const parsed = registerBusinessInputSchema.safeParse(body)
    if (!parsed.success) {
      return HttpResponse.json(
        { title: 'ValidationFailed', detail: parsed.error.issues[0]?.message, status: 400 },
        { status: 400 }
      )
    }

    const db = readDb()
    // `commercialAgreementAccepted` (RN-BIZ-03) y `termsAccepted` (#24)
    // son input-only, gates de envío: se destructuran afuera de
    // `businessInput` antes de spread, porque TypeScript NO hace
    // excess-property-check sobre un spread — dejarlos en `parsed.data` los
    // filtraría al `Business` persistido.
    const {
      commercialAgreementAccepted: _commercialAgreementAccepted,
      termsAccepted: _termsAccepted,
      ...businessInput
    } = parsed.data
    // Sin valor confirmado para trustScore/trustStatus/etc. de un negocio
    // recién registrado (ningún ERD/RN lo define) — defaults mock-only,
    // el backend real decide esto. `db.business` es un solo objeto (sin
    // multi-tenant en el mock todavía), así que este POST lo reemplaza
    // entero — simplificación del mock, no una decisión de producto.
    // `now` sella `commercialAgreementSignedAt` y `createdAt` con el mismo
    // instante para que ambos coincidan sin desfase intra-request.
    const now = new Date().toISOString()
    const newBusiness: Business = {
      ...businessInput,
      id: crypto.randomUUID(),
      status: 'Pending',
      // Heurística mock-only (#25) — ver google-maps-verification.mock.ts
      // para la regla completa y por qué es desechable.
      ...resolveGoogleMapsVerification(businessInput.category),
      isInformalBusiness: false,
      trustScore: 0,
      trustStatus: 'UnderReview',
      totalRedemptions: 0,
      totalReports: 0,
      isPlatformOwned: false,
      // Sellado incondicional: el `.refine()` del schema ya garantiza que
      // `parsed.success` implica `commercialAgreementAccepted === true`, así
      // que un `? :` sería una rama muerta e imposible de cubrir contra el
      // gate de 85% de branches.
      commercialAgreementSignedAt: now,
      createdAt: now,
    }
    db.business = newBusiness
    writeDb(db)

    return HttpResponse.json(newBusiness, { status: 201 })
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

  http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
    const body = await request.json()
    const parsed = loginInputSchema.safeParse(body)
    if (!parsed.success) {
      return HttpResponse.json(
        { title: 'ValidationFailed', detail: parsed.error.issues[0]?.message, status: 400 },
        { status: 400 }
      )
    }

    if (!isValidMockCredential(parsed.data.email, parsed.data.password)) {
      return HttpResponse.json(
        { title: 'InvalidCredentials', detail: 'Correo o contraseña incorrectos.', status: 401 },
        { status: 401 }
      )
    }

    // Valores de tokens/expiración arbitrarios (mock-only) — la vida útil
    // real de Identity no está confirmada (ver disclaimer en
    // business-staff-credentials.mock.ts), así que no se finge un valor
    // "realista": son strings/fechas de relleno, no una regla de negocio.
    const now = Date.now()
    const tokens: AuthTokens = {
      accessToken: `mock-access-${crypto.randomUUID()}`,
      accessTokenExpiresAtUtc: new Date(now + 15 * 60 * 1000).toISOString(),
      refreshToken: `mock-refresh-${crypto.randomUUID()}`,
      refreshTokenExpiresAtUtc: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }
    return HttpResponse.json(tokens, { status: 200 })
  }),
]
