import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '@/shared/lib/env'
import { readDb, writeDb } from '@/shared/mocks/db'
import { resolveGoogleMapsVerification } from '@/shared/mocks/google-maps-verification.mock'
import { isValidMockCredential } from '@/shared/mocks/business-staff-credentials.mock'
import { SEED_BUSINESS_STAFF_USERNAME } from '@/shared/mocks/seed'
import {
  createBusinessPlaceInputSchema,
  DEFAULT_CHECK_IN_RADIUS_METERS,
  type BusinessPlaceDetail,
  type BusinessPlaceSummary,
} from '@/shared/schemas/business-place'
import { isValidTaxonomy } from '@/shared/schemas/taxonomy'
import {
  canPublishReward,
  createBusinessRewardInputSchema,
  type BusinessRewardSummary,
} from '@/shared/schemas/business-reward'
import {
  registerBusinessInputSchema,
  updateBusinessMeInputSchema,
  BUSINESS_READONLY_FIELDS,
  type Business,
} from '@/shared/schemas/business'
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

  /**
   * `PATCH /business/me` — #72, PR3. Ver contratos-portal-b2b.md §2.1.1
   * para el contrato completo.
   *
   * El chequeo de campos congelados corre ANTES del `safeParse` del
   * subconjunto editable, y sobre el body crudo — `updateBusinessMeInputSchema`
   * ni siquiera declara `legalName`/`status`/etc. como claves, así que si
   * se validara primero esas claves se descartarían en silencio (el
   * comportamiento default de `z.object()` sin `.strict()`) y el 409
   * nunca se dispararía. RN-BIZ-01 exige rechazar el intento, no
   * ignorarlo — devolver 200 sin aplicar el cambio dejaría al cliente
   * creyendo que se guardó.
   *
   * Nota de alcance: este handler NO verifica el rol Owner (403) ni
   * "negocio inexistente" (404) — ambos están documentados en el
   * contrato pero su verificación depende de infraestructura que todavía
   * no existe en este repo (lectura de rol vía `GET /business-staff/me`,
   * mock single-tenant sin noción de "sin negocio"). Ver contrato §2.1.1.
   */
  http.patch(`${API_BASE_URL}/business/me`, async ({ request }) => {
    const body: unknown = await request.json()

    const hasReadOnlyField =
      body !== null &&
      typeof body === 'object' &&
      BUSINESS_READONLY_FIELDS.some((field) => field in body)
    if (hasReadOnlyField) {
      return HttpResponse.json(
        {
          title: 'ReadOnlyField',
          detail: 'No se pueden modificar campos de solo lectura del negocio.',
          status: 409,
        },
        { status: 409 }
      )
    }

    const parsed = updateBusinessMeInputSchema.safeParse(body)
    if (!parsed.success) {
      return HttpResponse.json(
        { title: 'ValidationFailed', detail: parsed.error.issues[0]?.message, status: 400 },
        { status: 400 }
      )
    }

    const db = readDb()
    const updatedBusiness: Business = { ...db.business, ...parsed.data }
    db.business = updatedBusiness
    writeDb(db)

    return HttpResponse.json(updatedBusiness, { status: 200 })
  }),

  /**
   * `GET /business-staff/me` — #72, PR4. Ver contratos-portal-b2b.md
   * §2.1.2 para el contrato completo. `username` no vive en `MockDb`
   * (`db.businessStaff` es `BusinessStaff`, sin ese campo — ver
   * `businessStaffSchema`): se arma acá igual que lo haría un backend real
   * al resolver el `Identity` del bearer token, con el valor semilla de
   * `SEED_BUSINESS_STAFF_USERNAME` (propuesta sin confirmar, ver
   * `Renata-S-A-S/geoquest#182`).
   *
   * Nota de alcance: este handler NO modela el 404 `BusinessStaffNotFound`
   * documentado en el contrato — el mock es single-tenant, siempre hay un
   * `db.businessStaff`, así que ese caso no es reproducible acá.
   */
  http.get(`${API_BASE_URL}/business-staff/me`, () => {
    const { businessStaff } = readDb()
    return HttpResponse.json({ ...businessStaff, username: SEED_BUSINESS_STAFF_USERNAME })
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

  /**
   * `GET /business/places` — devuelve el RESUMEN, no el detalle. El mock
   * proyecta los 7 campos que expone `BusinessPlaceSummaryResult`, igual
   * que el backend: la lista no trae descripción, coordenadas, radio ni
   * fotos. Servir el detalle acá escondería esa asimetría hasta el día de
   * la conexión real.
   */
  http.get(`${API_BASE_URL}/business/places`, () => {
    const { places } = readDb()
    const summaries: BusinessPlaceSummary[] = places.map((place) => ({
      placeId: place.placeId,
      name: place.name,
      category: place.category,
      subcategory: place.subcategory,
      status: place.status,
      xpReward: place.xpReward,
      geoPointsReward: place.geoPointsReward,
    }))
    return HttpResponse.json(summaries)
  }),

  /** `GET /business/places/{id}` — detalle completo, cualquier estado. */
  http.get(`${API_BASE_URL}/business/places/:placeId`, ({ params }) => {
    const { places } = readDb()
    const place = places.find((candidate) => candidate.placeId === params.placeId)

    if (!place) {
      return HttpResponse.json(
        {
          title: 'GetBusinessPlaceByIdQuery.NotFound',
          detail: `No Place exists with Id '${String(params.placeId)}'.`,
          status: 404,
        },
        { status: 404 }
      )
    }

    return HttpResponse.json(place)
  }),

  /**
   * `POST /business/places` — responde **201 con solo `{ placeId }`**, no
   * con el agregado. Quien necesite el lugar recién creado tiene que
   * pedirlo después con `GET /business/places/{id}`.
   *
   * Las fotos no viajan acá: se suben una por una contra
   * `POST /business/places/{id}/photos`, así que el lugar nace sin ninguna.
   */
  http.post(`${API_BASE_URL}/business/places`, async ({ request }) => {
    const body = await request.json()
    const parsed = createBusinessPlaceInputSchema.safeParse(body)
    if (!parsed.success) {
      return HttpResponse.json(
        { title: 'Validation.Failed', detail: parsed.error.issues[0]?.message, status: 400 },
        { status: 400 }
      )
    }

    // El backend valida el par categoría/subcategoría server-side y
    // responde 400 `Place.InvalidTaxonomy`. El mock lo replica para que el
    // formulario se pruebe contra el mismo rechazo, no contra uno inventado.
    if (!isValidTaxonomy(parsed.data.category, parsed.data.subcategory)) {
      return HttpResponse.json(
        {
          title: 'Place.InvalidTaxonomy',
          detail: `Subcategory '${parsed.data.subcategory}' does not belong to Category '${parsed.data.category}'.`,
          status: 400,
        },
        { status: 400 }
      )
    }

    const db = readDb()
    const newPlace: BusinessPlaceDetail = {
      ...parsed.data,
      placeId: crypto.randomUUID(),
      checkInRadiusMeters: parsed.data.checkInRadiusMeters ?? DEFAULT_CHECK_IN_RADIUS_METERS,
      status: 'Draft',
      photos: [],
    }
    db.places.push(newPlace)
    writeDb(db)

    return HttpResponse.json({ placeId: newPlace.placeId }, { status: 201 })
  }),

  /**
   * `POST /business/places/{id}/publish` (#34) — espejo de `Place.Activate`.
   *
   * Las tres razones de rechazo son 409 y están todas replicadas: un lugar
   * borrado no revive, uno ya activo no se republica, y uno sin fotos no se
   * publica porque no habría nada que mostrarle al explorador.
   *
   * `visibleToExplorers` se calcula del estado del negocio: el lugar se
   * activa igual, pero queda invisible si el negocio no está verificado.
   * Publicar y ser visible NO son lo mismo, y el mock lo refleja para que la
   * interfaz pueda distinguirlo.
   */
  http.post(`${API_BASE_URL}/business/places/:placeId/publish`, ({ params }) => {
    const db = readDb()
    const place = db.places.find((candidate) => candidate.placeId === params.placeId)

    if (!place) {
      return HttpResponse.json(
        {
          title: 'PublishBusinessPlaceCommand.NotFound',
          detail: `No Place exists with Id '${String(params.placeId)}'.`,
          status: 404,
        },
        { status: 404 }
      )
    }

    if (place.status === 'Deleted') {
      return HttpResponse.json(
        { title: 'Place.Deleted', detail: 'The Place is deleted.', status: 409 },
        { status: 409 }
      )
    }

    if (place.status === 'Active') {
      return HttpResponse.json(
        { title: 'Place.AlreadyActive', detail: 'The Place is already active.', status: 409 },
        { status: 409 }
      )
    }

    if (place.photos.length === 0) {
      return HttpResponse.json(
        {
          title: 'Place.ActiveRequiresAtLeastOnePhoto',
          detail: 'An active Place requires at least one photo.',
          status: 409,
        },
        { status: 409 }
      )
    }

    place.status = 'Active'
    writeDb(db)

    return HttpResponse.json({
      status: place.status,
      visibleToExplorers: db.business.status === 'Active',
    })
  }),

  /**
   * `GET /portal/rewards` — listado de las recompensas DEL NEGOCIO.
   *
   * ⚠️ El path es una propuesta (`geoquest#191`); la forma no. Hoy el
   * único listado que existe es `GET /rewards`, **anónimo y global**: usarlo
   * para «mis recompensas» mostraría el catálogo de la competencia sin que
   * nada falle. Por eso el mock NO lo sirve en esa ruta — servirlo
   * legitimaria el error.
   */
  http.get(`${API_BASE_URL}/portal/rewards`, () => {
    const { rewards } = readDb()
    return HttpResponse.json(rewards)
  }),

  /**
   * `POST /portal/rewards` — crea la recompensa en **`Draft`**.
   *
   * Decisión de producto (Derek, 24 sep 2026): se mantiene el flujo B-03,
   * borrador primero y publicación aparte. El backend hoy crea directo en
   * `Published`, pero `Draft` ya existe como estado persistido y su propio
   * docstring lo declara diferido, no descartado. Divergencia deliberada,
   * registrada en `geoquest#191`.
   *
   * Sin imagen: se sube después con `PUT /portal/rewards/{id}/image`.
   */
  http.post(`${API_BASE_URL}/portal/rewards`, async ({ request }) => {
    const body = await request.json()
    const parsed = createBusinessRewardInputSchema.safeParse(body)
    if (!parsed.success) {
      return HttpResponse.json(
        { title: 'Validation.Failed', detail: parsed.error.issues[0]?.message, status: 400 },
        { status: 400 }
      )
    }

    const db = readDb()
    const newReward: BusinessRewardSummary = {
      ...parsed.data,
      rewardId: crypto.randomUUID(),
      businessId: db.business.id,
      status: 'Draft',
      stockRemaining: parsed.data.stockTotal,
      imageUrl: null,
    }
    db.rewards.push(newReward)
    writeDb(db)

    return HttpResponse.json({ rewardId: newReward.rewardId }, { status: 201 })
  }),

  /**
   * `POST /portal/rewards/{id}/publish` — la transición que hoy falta en
   * el backend. Espejo de `POST /business/places/{id}/publish`, incluida la
   * precondición: así como un lugar no se publica sin al menos una foto,
   * una recompensa no se publica sin imagen. Ver `canPublishReward`.
   */
  http.post(`${API_BASE_URL}/portal/rewards/:rewardId/publish`, ({ params }) => {
    const db = readDb()
    const reward = db.rewards.find((candidate) => candidate.rewardId === params.rewardId)

    if (!reward) {
      return HttpResponse.json(
        {
          title: 'PublishRewardCommand.NotFound',
          detail: `No Reward exists with Id '${String(params.rewardId)}'.`,
          status: 404,
        },
        { status: 404 }
      )
    }

    if (reward.status === 'Published') {
      return HttpResponse.json(
        { title: 'Reward.AlreadyPublished', detail: 'The Reward is already published.', status: 409 },
        { status: 409 }
      )
    }

    if (!canPublishReward(reward)) {
      return HttpResponse.json(
        {
          title: 'Reward.PublishRequiresImage',
          detail: 'A Reward cannot be published without an image.',
          status: 409,
        },
        { status: 409 }
      )
    }

    reward.status = 'Published'
    writeDb(db)

    return HttpResponse.json({ status: reward.status, visibleToExplorers: true })
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
