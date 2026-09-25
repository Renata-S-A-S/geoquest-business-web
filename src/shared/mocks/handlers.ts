import { http, HttpResponse, type StrictResponse } from 'msw'
import { API_BASE_URL } from '@/shared/lib/env'
import { UPLOAD_LIMITS } from '@/shared/lib/upload-limits'
import { readDb, writeDb } from '@/shared/mocks/db'
import { resolveGoogleMapsVerification } from '@/shared/mocks/google-maps-verification.mock'
import { isValidMockCredential } from '@/shared/mocks/business-staff-credentials.mock'
import { SEED_BUSINESS_STAFF, SEED_BUSINESS_STAFF_USERNAME } from '@/shared/mocks/seed'
import { createMockJwt } from '@/shared/mocks/mock-jwt'
import {
  createBusinessPlaceInputSchema,
  type BusinessPlaceDetail,
  type BusinessPlaceSummary,
} from '@/shared/schemas/business-place'
import { isValidTaxonomy } from '@/shared/schemas/taxonomy'
import {
  canEditReward,
  canPauseReward,
  canPublishReward,
  canRepublishReward,
  republishWillExhaust,
  committedUnits,
  createBusinessRewardInputSchema,
  updateBusinessRewardInputSchema,
  type BusinessRewardSummary,
} from '@/shared/schemas/business-reward'
import { registerBusinessInputSchema, type Business } from '@/shared/schemas/business'
import { loginInputSchema, type AuthTokens } from '@/shared/schemas/auth'
import { analyticsDateSchema, analyticsGranularitySchema } from '@/shared/schemas/analytics'
import { buildMockAnalyticsSummary, buildMockCheckInSeries } from '@/shared/mocks/analytics.mock'
import type { AnalyticsRange } from '@/shared/lib/analytics-range'
import {
  lookupRedemptionInputSchema,
  scanRedemptionInputSchema,
} from '@/shared/schemas/business-redemption'

/**
 * Lee y valida `from`/`to` del query string de los endpoints propuestos de
 * analytics (`Renata-S-A-S/geoquest#205`). Devuelve `null` si falta alguno o si
 * no son fechas `YYYY-MM-DD`, para que el handler responda 400 en vez de
 * agregar sobre un rango inventado.
 *
 * `to < from` también cae acá: un rango invertido produciría una serie vacía y
 * el negocio la leería como «no hubo visitas».
 */
function readAnalyticsRange(url: string): AnalyticsRange | null {
  const params = new URL(url).searchParams
  const from = params.get('from')
  const to = params.get('to')

  if (!analyticsDateSchema.safeParse(from).success) return null
  if (!analyticsDateSchema.safeParse(to).success) return null
  if ((to as string) < (from as string)) return null

  return { from: from as string, to: to as string }
}

function analyticsMissingRange() {
  return HttpResponse.json(
    {
      title: 'Analytics.InvalidRange',
      detail:
        "Query parameters 'from' and 'to' are required and must be YYYY-MM-DD, with from <= to.",
      status: 400,
    },
    { status: 400 }
  )
}

function analyticsBusinessNotFound(businessId: unknown) {
  return HttpResponse.json(
    {
      title: 'Analytics.BusinessNotFound',
      detail: `No Business exists with Id '${String(businessId)}' for the current session.`,
      status: 404,
    },
    { status: 404 }
  )
}

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
/** `problem+json` tal como lo arma `ProblemResults.ToProblem` del backend. */
interface PortalProblem {
  title: string
  detail: string
  status: number
}

/**
 * Guardas del portal de recompensas, replicadas de `PortalAccess.AuthorizeAsync`
 * (`Application/Abstractions/PortalAccess.cs:18-39`) contra backend `main` @
 * `ea471f4`. Se replican EXACTAS, no en una versión «más segura»: una guarda
 * del cliente más estricta que la del servidor esconde funcionalidad válida,
 * que es el bug que tuvo `canPublishPlace`.
 */

/**
 * El gate real es por DUEÑO, no por membresía: compara
 * `businessRef.OwnerExplorerId !== explorerId` y devuelve 403
 * `RewardPortal.NotBusinessOwner`.
 *
 * ⚠️ **Anti-enumeración**: un `businessId` desconocido y el de otro dueño
 * devuelven EL MISMO 403, nunca un 404. Por eso el mock no distingue los dos
 * casos — y por eso la interfaz nunca debe decir «negocio no encontrado».
 */
function denyUnlessOwner(
  db: { business: { id: string } },
  businessId: string | readonly string[] | undefined
): StrictResponse<PortalProblem> | undefined {
  if (businessId === db.business.id) return undefined

  return HttpResponse.json(
    {
      title: 'RewardPortal.NotBusinessOwner',
      detail: 'The authenticated explorer does not own this Business.',
      status: 403,
    },
    { status: 403 }
  )
}

/**
 * `requireActive: true` en las cinco ESCRITURAS (crear, editar, pausar,
 * republicar, imagen) y `false` en las tres LECTURAS (listado, detalle,
 * historial). O sea que un negocio pausado o suspendido puede leer sus
 * recompensas pero no tocarlas.
 */
function denyUnlessActive(db: {
  business: { status: string }
}): StrictResponse<PortalProblem> | undefined {
  if (db.business.status === 'Active') return undefined

  return HttpResponse.json(
    {
      title: 'RewardPortal.BusinessNotActive',
      detail: 'Only an Active Business can perform this action.',
      status: 403,
    },
    { status: 403 }
  )
}

/** 404 `RewardPortal.RewardNotFound`, el código real del backend. */
function rewardNotFound(
  rewardId: string | readonly string[] | undefined
): StrictResponse<PortalProblem> {
  return HttpResponse.json(
    {
      title: 'RewardPortal.RewardNotFound',
      detail: `No Reward exists with Id '${String(rewardId)}'.`,
      status: 404,
    },
    { status: 404 }
  )
}

export const handlers = [
  http.get(`${API_BASE_URL}/business/me`, () => {
    const { business } = readDb()
    return HttpResponse.json(business)
  }),

  /**
   * `GET /business/mine` — contrato REAL (real-backend-readiness PR6a),
   * confirmado contra `MyBusinessResult.cs` en `origin/main`. A diferencia
   * de `/business/me` (arriba), SIEMPRE responde un array: `[myBusiness]`
   * cuando el explorador de sesión es dueño de un negocio, `[]` cuando no
   * (`db.myBusiness === null`, escenario `none` de `SEED_BUSINESS_SCENARIOS`).
   */
  http.get(`${API_BASE_URL}/business/mine`, () => {
    const { myBusiness } = readDb()
    return HttpResponse.json(myBusiness ? [myBusiness] : [])
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
   * `GET /portal/businesses/{businessId}/rewards` — listado de las
   * recompensas DEL NEGOCIO.
   *
   * ✅ Ruta REAL, verificada en `Api/PortalRewardsEndpoints.cs:26-27` contra
   * backend `main` @ `ea471f4`. La ruta vieja `GET /portal/rewards` **fue
   * eliminada** por los PRs #195–#201 sin alias, así que el mock tampoco la
   * sirve: mantenerla viva escondería que el portal llamaba a un endpoint
   * inexistente.
   *
   * Tampoco se sirve en `GET /rewards`, que es el browse **anónimo y
   * global**: servirlo para «mis recompensas» legitimaría mostrar el
   * catálogo de la competencia.
   *
   * `requireActive: false` en el backend para las lecturas, así que un
   * negocio pausado o suspendido SÍ puede leer su listado.
   */
  http.get(`${API_BASE_URL}/portal/businesses/:businessId/rewards`, ({ params }) => {
    const db = readDb()
    const denied = denyUnlessOwner(db, params.businessId)
    if (denied) return denied

    return HttpResponse.json(db.rewards)
  }),

  /**
   * `GET /portal/businesses/{businessId}/rewards/{rewardId}` — detalle, #109.
   *
   * ✅ Ruta REAL (`PortalRewardsEndpoints.cs:28`). Devuelve el MISMO
   * `PortalRewardResult` que el listado: el backend no tiene un DTO de
   * detalle aparte, así que el mock tampoco inventa uno.
   *
   * `requireActive: false`: un negocio suspendido puede abrir el detalle.
   */
  http.get(`${API_BASE_URL}/portal/businesses/:businessId/rewards/:rewardId`, ({ params }) => {
    const db = readDb()
    const denied = denyUnlessOwner(db, params.businessId)
    if (denied) return denied

    const reward = db.rewards.find((candidate) => candidate.rewardId === params.rewardId)
    if (!reward) return rewardNotFound(params.rewardId)

    return HttpResponse.json(reward)
  }),

  /**
   * `POST /portal/businesses/{businessId}/rewards` — crea la recompensa en
   * **`Draft`**.
   *
   * ✅ Ruta REAL (`PortalRewardsEndpoints.cs:26,29`). El ESTADO resultante es
   * la divergencia deliberada: el backend crea directo en `Published` (su
   * handler se llama `PublishAsync`), pero la decisión de producto de Derek
   * (24 sep 2026) mantiene el flujo B-03 con borrador previo. `Draft` ya
   * existe como estado persistido. Registrada en `geoquest#191`.
   *
   * `requireActive: true` en el backend para toda escritura, de ahí el 403
   * `RewardPortal.BusinessNotActive` cuando el negocio no está `Active`.
   *
   * Sin imagen: se sube después con
   * `PUT /portal/businesses/{businessId}/rewards/{rewardId}/image`.
   */
  http.post(
    `${API_BASE_URL}/portal/businesses/:businessId/rewards`,
    async ({ params, request }) => {
      const db = readDb()
      const denied = denyUnlessOwner(db, params.businessId) ?? denyUnlessActive(db)
      if (denied) return denied

      const body = await request.json()
      const parsed = createBusinessRewardInputSchema.safeParse(body)
      if (!parsed.success) {
        return HttpResponse.json(
          { title: 'Validation.Failed', detail: parsed.error.issues[0]?.message, status: 400 },
          { status: 400 }
        )
      }

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
    }
  ),

  /**
   * `PUT /portal/businesses/{businessId}/rewards/{rewardId}` — edición, #110.
   *
   * ✅ Ruta REAL (`PortalRewardsEndpoints.cs:30`). Responde 200 con el
   * `PortalRewardResult` actualizado, no 204.
   *
   * ⚠️ **REEMPLAZO TOTAL: asigna sin condición**, igual que
   * `Reward.Edit` (`Reward.cs:245-252`). Un `placeId` ausente en el body
   * queda `null` y desvincula el lugar. El mock lo replica a propósito: si
   * fuera indulgente, el portal podría mandar bodies parciales en desarrollo
   * y romper recién en producción.
   *
   * El orden de las guardas también se replica: estado editable → campos →
   * piso de stock → asignación.
   */
  http.put(
    `${API_BASE_URL}/portal/businesses/:businessId/rewards/:rewardId`,
    async ({ params, request }) => {
      const db = readDb()
      const denied = denyUnlessOwner(db, params.businessId) ?? denyUnlessActive(db)
      if (denied) return denied

      const reward = db.rewards.find((candidate) => candidate.rewardId === params.rewardId)
      if (!reward) return rewardNotFound(params.rewardId)

      // `Reward.cs:205` — solo Published, Exhausted o Paused.
      if (!canEditReward(reward)) {
        return HttpResponse.json(
          {
            title: 'Reward.NotEditable',
            detail: 'Only a Published, Exhausted or Paused Reward can be edited.',
            status: 409,
          },
          { status: 409 }
        )
      }

      const parsed = updateBusinessRewardInputSchema.safeParse(await request.json())
      if (!parsed.success) {
        return HttpResponse.json(
          { title: 'Validation.Failed', detail: parsed.error.issues[0]?.message, status: 400 },
          { status: 400 }
        )
      }

      /**
       * Piso de stock (`Reward.cs:238-243`). Para una recompensa con tope, lo
       * comprometido es `stockTotal - stockRemaining`. El backend rechaza bajar
       * por debajo de eso con 409 y **sin decir el número**, así que el mock
       * tampoco lo manda: mandarlo acá haría que el portal pareciera funcionar
       * en desarrollo y perdiera el dato contra el backend real.
       */
      const committed = committedUnits(reward) ?? 0
      if (parsed.data.stockTotal !== null && parsed.data.stockTotal < committed) {
        return HttpResponse.json(
          {
            title: 'Reward.StockBelowCommitted',
            detail: 'The new stock total cannot be lower than the units already committed.',
            status: 409,
          },
          { status: 409 }
        )
      }

      // Asignación incondicional, igual que el dominio: `null` BORRA.
      reward.title = parsed.data.title
      reward.description = parsed.data.description
      reward.geoPointsCost = parsed.data.geoPointsCost
      reward.estimatedValueCop = parsed.data.estimatedValueCop
      reward.placeId = parsed.data.placeId
      reward.menuItemId = parsed.data.menuItemId
      reward.stockTotal = parsed.data.stockTotal
      reward.stockRemaining =
        parsed.data.stockTotal === null ? null : parsed.data.stockTotal - committed

      /**
       * `SyncStockStatus()` (`Reward.cs:316-336`): quitar el tope devuelve una
       * `Exhausted` a `Published`, y agotar el stock mueve `Published` a
       * `Exhausted`. **Nunca toca `Paused`.** O sea que una edición puede
       * cambiar el estado como efecto secundario.
       */
      if (reward.stockTotal === null) {
        if (reward.status === 'Exhausted') reward.status = 'Published'
      } else if (reward.status === 'Published' && (reward.stockRemaining ?? 0) <= 0) {
        reward.status = 'Exhausted'
      } else if (reward.status === 'Exhausted' && (reward.stockRemaining ?? 0) > 0) {
        reward.status = 'Published'
      }

      writeDb(db)

      return HttpResponse.json(reward)
    }
  ),

  /**
   * `PUT /portal/businesses/{businessId}/rewards/{rewardId}/image` — #112.
   *
   * ✅ Ruta REAL (`RewardImageEndpoints.cs:38`). Ojo con el verbo: **`PUT`**, al
   * revés que las fotos de lugar, que son `POST`.
   *
   * Responde **200 con `{ url }`**, no la recompensa entera.
   *
   * El campo del form es **`file`** literal (`form.Files["file"]`). Un nombre
   * distinto da 400 `RewardImageEndpoints.NoFile`, no un error de validación:
   * el mock replica esa distinción porque es la que un cliente mal escrito
   * necesita ver.
   *
   * ⚠️ El backend valida el formato por **magic bytes** y no por el
   * `Content-Type` declarado. El mock no puede leer magic bytes de forma
   * barata, así que valida por `type`/tamaño — es una aproximación, y por eso
   * pasar el mock NO garantiza pasar el backend. Queda anotado para que nadie
   * lea un verde de acá como prueba de compatibilidad de formato.
   */
  http.put(
    `${API_BASE_URL}/portal/businesses/:businessId/rewards/:rewardId/image`,
    async ({ params, request }) => {
      const db = readDb()
      const denied = denyUnlessOwner(db, params.businessId) ?? denyUnlessActive(db)
      if (denied) return denied

      const reward = db.rewards.find((candidate) => candidate.rewardId === params.rewardId)
      if (!reward) return rewardNotFound(params.rewardId)

      const form = await request.formData()
      const file = form.get('file')

      /**
       * ⚠️ NO usar `instanceof File` acá. El `File` que construye el test vive
       * en el realm de jsdom, y el que devuelve `formData()` lo construye
       * undici: son clases distintas, así que `instanceof` da `false` para un
       * archivo perfectamente válido y el handler responde `NoFile`. Se detecta
       * por forma (no es string y tiene `size`/`type`), que es cross-realm.
       */
      if (file === null || typeof file === 'string') {
        return HttpResponse.json(
          {
            title: 'RewardImageEndpoints.NoFile',
            detail: "No file was received under the 'file' field.",
            status: 400,
          },
          { status: 400 }
        )
      }

      if (file.size === 0) {
        return HttpResponse.json(
          {
            title: 'RewardImage.Empty',
            detail: 'No se recibió ningún archivo o está vacío.',
            status: 400,
          },
          { status: 400 }
        )
      }

      const limit = UPLOAD_LIMITS.rewardImage
      if (file.size > limit.maxSizeBytes) {
        return HttpResponse.json(
          {
            title: 'RewardImage.TooLarge',
            detail: `El archivo supera el tamaño máximo permitido (${limit.maxSizeBytes} bytes).`,
            status: 400,
          },
          { status: 400 }
        )
      }

      if (!limit.acceptedMimeTypes.includes(file.type)) {
        return HttpResponse.json(
          {
            title: 'RewardImage.UnsupportedFormat',
            detail: 'Solo se aceptan imágenes JPEG, PNG o WebP.',
            status: 400,
          },
          { status: 400 }
        )
      }

      reward.imageUrl = `https://mock.geoquest.local/rewards/${reward.rewardId}.jpg`
      writeDb(db)

      return HttpResponse.json({ url: reward.imageUrl })
    }
  ),

  /**
   * `POST /portal/businesses/{businessId}/rewards/{rewardId}/pause` — #111.
   *
   * ✅ Ruta REAL (`PortalRewardsEndpoints.cs:31`). **204 sin body**, igual que
   * el backend: no devuelve la recompensa, así que el portal tiene que releer.
   * Devolver el objeto acá haría que el portal pareciera funcionar en
   * desarrollo y se rompiera contra el backend real.
   *
   * `Reward.cs:268-282`: `Published`/`Exhausted` → `Paused`.
   */
  http.post(
    `${API_BASE_URL}/portal/businesses/:businessId/rewards/:rewardId/pause`,
    ({ params }) => {
      const db = readDb()
      const denied = denyUnlessOwner(db, params.businessId) ?? denyUnlessActive(db)
      if (denied) return denied

      const reward = db.rewards.find((candidate) => candidate.rewardId === params.rewardId)
      if (!reward) return rewardNotFound(params.rewardId)

      if (reward.status === 'Paused') {
        return HttpResponse.json(
          {
            title: 'Reward.AlreadyPaused',
            detail: 'This Reward is already Paused.',
            status: 409,
          },
          { status: 409 }
        )
      }

      if (!canPauseReward(reward)) {
        return HttpResponse.json(
          {
            title: 'Reward.InvalidStatusTransition',
            detail: `Cannot transition Reward from '${reward.status}' to 'Paused'.`,
            status: 409,
          },
          { status: 409 }
        )
      }

      reward.status = 'Paused'
      writeDb(db)

      return new HttpResponse(null, { status: 204 })
    }
  ),

  /**
   * `POST /portal/businesses/{businessId}/rewards/{rewardId}/republish` — #111.
   *
   * ✅ Ruta REAL (`PortalRewardsEndpoints.cs:32`). **204 sin body.**
   *
   * ⚠️ El estado resultante NO es deducible del verbo: republicar sin stock
   * deja `Exhausted`, no `Published` (`Reward.cs:298`). El mock replica esa
   * decisión tal cual, porque es la que hace que el portal necesite releer.
   */
  http.post(
    `${API_BASE_URL}/portal/businesses/:businessId/rewards/:rewardId/republish`,
    ({ params }) => {
      const db = readDb()
      const denied = denyUnlessOwner(db, params.businessId) ?? denyUnlessActive(db)
      if (denied) return denied

      const reward = db.rewards.find((candidate) => candidate.rewardId === params.rewardId)
      if (!reward) return rewardNotFound(params.rewardId)

      if (!canRepublishReward(reward)) {
        return HttpResponse.json(
          {
            title: 'Reward.NotPaused',
            detail: 'Only a Paused Reward can be republished.',
            status: 409,
          },
          { status: 409 }
        )
      }

      reward.status = republishWillExhaust(reward) ? 'Exhausted' : 'Published'
      writeDb(db)

      return new HttpResponse(null, { status: 204 })
    }
  ),

  /**
   * `POST /portal/businesses/{businessId}/rewards/{rewardId}/publish` — la
   * transición que **sigue faltando** en el backend.
   *
   * ⚠️ Es el único endpoint de recompensas que continúa siendo ficción:
   * verificado @ `ea471f4`, no existe ninguna ruta `/publish`. Espejo de
   * `POST /business/places/{id}/publish`, incluida la precondición: así como
   * un lugar no se publica sin al menos una foto, una recompensa no se
   * publica sin imagen. Ver `canPublishReward`.
   */
  http.post(
    `${API_BASE_URL}/portal/businesses/:businessId/rewards/:rewardId/publish`,
    ({ params }) => {
      const db = readDb()
      const denied = denyUnlessOwner(db, params.businessId) ?? denyUnlessActive(db)
      if (denied) return denied

      const reward = db.rewards.find((candidate) => candidate.rewardId === params.rewardId)

      if (!reward) return rewardNotFound(params.rewardId)

      if (reward.status === 'Published') {
        return HttpResponse.json(
          {
            title: 'Reward.AlreadyPublished',
            detail: 'The Reward is already published.',
            status: 409,
          },
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
    }
  ),

  /**
   * `GET /portal/businesses/{businessId}/analytics/summary?from=&to=` — B-05.
   *
   * ⚠️⚠️ **ENDPOINT PROPUESTO. NO EXISTE NINGÚN ANALYTICS EN EL BACKEND.**
   * Ver `Renata-S-A-S/geoquest#205`. Confluence lista B-05 como «sin definir» y
   * `contratos-portal-b2b.md` §2.6 dice «Sin propuesta de shape todavía». Este
   * handler es ficción DELIBERADA y ETIQUETADA: sirve para construir la
   * pantalla contra una forma concreta, no para simular que el dato existe.
   *
   * Los agregados NO están hardcodeados: `analytics.mock.ts` sintetiza filas
   * con la forma de `CheckIn` y de `UserReward` y las agrega como lo haría el
   * backend, contra los lugares y recompensas que ya viven en `MockDb`. Así el
   * desglose por lugar y el valor entregado son consistentes con el resto del
   * mock en vez de ser números sueltos que se contradicen con `/business/places`.
   *
   * El 404 por `businessId` ajeno es real, no decorativo: el mock es
   * single-tenant, así que cualquier id que no sea el del negocio de la sesión
   * es exactamente el caso que un backend debería rechazar (RN-REW-06 aplica el
   * mismo criterio para canjes).
   */
  http.get(
    `${API_BASE_URL}/portal/businesses/:businessId/analytics/summary`,
    ({ params, request }) => {
      const db = readDb()
      if (params.businessId !== db.business.id) {
        return analyticsBusinessNotFound(params.businessId)
      }

      const range = readAnalyticsRange(request.url)
      if (!range) return analyticsMissingRange()

      return HttpResponse.json(buildMockAnalyticsSummary(range, db.places, db.rewards))
    }
  ),

  /**
   * `GET /portal/businesses/{businessId}/analytics/check-ins?from=&to=&granularity=day`
   *
   * ⚠️⚠️ **ENDPOINT PROPUESTO.** Ver `Renata-S-A-S/geoquest#205` y la nota del
   * handler de arriba.
   *
   * Rechaza cualquier `granularity` que no sea `'day'` con 400 en vez de
   * degradar en silencio al día: un cliente que pida `week` y reciba días
   * dibujaría una serie equivocada sin que nada falle.
   */
  http.get(
    `${API_BASE_URL}/portal/businesses/:businessId/analytics/check-ins`,
    ({ params, request }) => {
      const db = readDb()
      if (params.businessId !== db.business.id) {
        return analyticsBusinessNotFound(params.businessId)
      }

      const range = readAnalyticsRange(request.url)
      if (!range) return analyticsMissingRange()

      const granularity = new URL(request.url).searchParams.get('granularity') ?? 'day'
      if (!analyticsGranularitySchema.safeParse(granularity).success) {
        return HttpResponse.json(
          {
            title: 'Analytics.UnsupportedGranularity',
            detail: `Granularity '${granularity}' is not supported. Only 'day' is.`,
            status: 400,
          },
          { status: 400 }
        )
      }

      return HttpResponse.json(buildMockCheckInSeries(range, db.places))
    }
  ),

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

    // Valores de expiración arbitrarios (mock-only) — la vida útil real de
    // Identity no está confirmada (ver disclaimer en
    // business-staff-credentials.mock.ts), así que no se finge un valor
    // "realista": son fechas de relleno, no una regla de negocio.
    //
    // `accessToken` SÍ tiene forma real (spec "session-identity", #1547):
    // `realSessionPort` es el puerto activo en AMBOS modos
    // (`session-port.instance.ts`), así que `getIdentityClaims()` decodifica
    // este token igual que decodificaría uno real — un opaco `mock-access-*`
    // (la forma anterior) nunca expondría username/email.
    const now = Date.now()
    const tokens: AuthTokens = {
      accessToken: createMockJwt({
        sub: SEED_BUSINESS_STAFF.id,
        email: SEED_BUSINESS_STAFF.email,
        username: SEED_BUSINESS_STAFF_USERNAME,
      }),
      accessTokenExpiresAtUtc: new Date(now + 15 * 60 * 1000).toISOString(),
      refreshToken: `mock-refresh-${crypto.randomUUID()}`,
      refreshTokenExpiresAtUtc: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }
    return HttpResponse.json(tokens, { status: 200 })
  }),

  /**
   * `POST /portal/businesses/:businessId/redemptions/lookup` — paso 1 de B-04
   * (#44, #45). Contrato real, verificado contra `RedemptionEndpoints.cs`
   * (`main`@e0f0e9a, PR #210): preview de solo lectura por token, nunca muta
   * el `UserReward`.
   *
   * Nunca devuelve 409/410: un token ya canjeado, vencido, o en cualquier
   * otro estado no redimible responde 200 con `isRedeemable: false` y
   * `status` explicando por qué (spec "Successful preview") — es justo lo que
   * le ahorra al staff confirmar un canje que iba a fallar igual, sin
   * necesidad de simular los códigos de error del escaneo.
   *
   * El 404 (`RedemptionToken.NotFound`) está sobrecargado igual que en el
   * backend real: "no existe" y "es de otro negocio" comparten código para no
   * permitir enumeración por fuerza bruta del token.
   */
  http.post(
    `${API_BASE_URL}/portal/businesses/:businessId/redemptions/lookup`,
    async ({ request, params }) => {
      const parsed = lookupRedemptionInputSchema.safeParse(await request.json())

      if (!parsed.success) {
        return HttpResponse.json(
          {
            title: 'Validation.Failed',
            detail: parsed.error.issues[0]?.message,
            status: 400,
          },
          { status: 400 }
        )
      }

      const db = readDb()

      /**
       * `requireActive: true` (`LookupRedemptionByQrTokenQueryHandler.cs:39`,
       * design #1549): un negocio Pausado o Suspendido no puede ni siquiera
       * PREVISUALIZAR un canje, aunque el lookup sea de solo lectura. Mismo
       * `denyUnlessActive` que las escrituras de recompensas, chequeado ANTES
       * de resolver el token — el estado del negocio que llama, no el dueño
       * del token, es lo que se evalúa acá.
       */
      const denied = denyUnlessActive(db)
      if (denied) return denied

      const userReward = db.userRewards.find(
        (candidate) => candidate.qrToken === parsed.data.qrToken
      )

      if (!userReward) {
        return HttpResponse.json(
          {
            title: 'RedemptionToken.NotFound',
            detail: 'No redemption token matches the supplied value.',
            status: 404,
          },
          { status: 404 }
        )
      }

      // `RedemptionToken.OtherBusiness` (decision #1473): el token es de 256
      // bits y no es enumerable, así que "es de otro negocio" ya no comparte
      // el 404 anti-enumeration — tiene su propio 403.
      if (userReward.businessId !== params.businessId) {
        return HttpResponse.json(
          {
            title: 'RedemptionToken.OtherBusiness',
            detail: 'The redemption token belongs to a different business.',
            status: 403,
          },
          { status: 403 }
        )
      }

      // Solo los campos del contrato real: ni `qrToken` ni `businessId`, que
      // son de bookkeeping del mock.
      return HttpResponse.json({
        userRewardId: userReward.userRewardId,
        rewardId: userReward.rewardId,
        rewardTitle: userReward.rewardTitle,
        rewardDescription: userReward.rewardDescription,
        status: userReward.status,
        isRedeemable: userReward.status === 'Earned',
        qrExpiresAtUtc: userReward.qrExpiresAtUtc,
        origin: userReward.origin,
        geoPointsCostSnapshot: userReward.geoPointsCostSnapshot,
        explorerId: userReward.explorerId,
        explorerUsername: userReward.explorerUsername,
      })
    }
  ),

  /**
   * `POST /portal/businesses/:businessId/redemptions/scan` — paso 2 de B-04
   * (#46). Verificado contra `RedemptionEndpoints.cs` (`main`@e0f0e9a,
   * PR #210): el body ya no lleva `userRewardId`, el token es la única clave
   * de resolución.
   *
   * Devuelve **204 sin cuerpo**, que es lo que hace el backend real y lo que
   * obliga a que el estado post-canje (#48) se arme con los datos que ya
   * trajo la previsualización.
   *
   * No se modela el 401 (claim `sub` ausente): el interceptor de sesión
   * siempre manda el token, así que no hay forma de llegar a ese caso desde
   * el portal. Tampoco se modela `UserReward.ConcurrencyConflict` (xmin): no
   * hay forma de forzar una carrera real contra un mock de un solo proceso.
   */
  http.post(
    `${API_BASE_URL}/portal/businesses/:businessId/redemptions/scan`,
    async ({ request, params }) => {
      const parsed = scanRedemptionInputSchema.safeParse(await request.json())

      if (!parsed.success) {
        return HttpResponse.json(
          {
            title: 'Validation.Failed',
            detail: parsed.error.issues[0]?.message,
            status: 400,
          },
          { status: 400 }
        )
      }

      const db = readDb()

      /**
       * `requireActive: true` (`ScanRedemptionQrCommandHandler.cs:47`, design
       * #1549): un negocio Pausado o Suspendido no puede confirmar canjes.
       * Mismo criterio que el lookup, chequeado antes de resolver el token.
       */
      const denied = denyUnlessActive(db)
      if (denied) return denied

      const userReward = db.userRewards.find(
        (candidate) => candidate.qrToken === parsed.data.qrToken
      )

      if (!userReward) {
        return HttpResponse.json(
          {
            title: 'RedemptionToken.NotFound',
            detail: 'No redemption token matches the supplied value.',
            status: 404,
          },
          { status: 404 }
        )
      }

      if (userReward.businessId !== params.businessId) {
        return HttpResponse.json(
          {
            title: 'RedemptionToken.OtherBusiness',
            detail: 'The redemption token belongs to a different business.',
            status: 403,
          },
          { status: 403 }
        )
      }

      if (userReward.status === 'Redeemed') {
        return HttpResponse.json(
          {
            title: 'RedemptionToken.AlreadyRedeemed',
            detail: 'The redemption token was already redeemed.',
            status: 409,
          },
          { status: 409 }
        )
      }

      if (userReward.status === 'Expired') {
        return HttpResponse.json(
          {
            title: 'RedemptionToken.Expired',
            detail: 'The redemption token has expired.',
            status: 410,
          },
          { status: 410 }
        )
      }

      if (userReward.status === 'PendingReservation' || userReward.status === 'Failed') {
        return HttpResponse.json(
          {
            title: 'RedemptionToken.NotRedeemable',
            detail: 'The redemption token is not in a redeemable state.',
            status: 409,
          },
          { status: 409 }
        )
      }

      userReward.status = 'Redeemed'
      writeDb(db)

      return new HttpResponse(null, { status: 204 })
    }
  ),
]
