import { z } from 'zod'
import { categorySchema, subcategorySchema } from './taxonomy'

/**
 * Contrato REAL de `/business/places`, copiado de los DTOs del backend ya
 * desplegado (`GeoQuest.Modules.Geo`). Convive temporalmente con el
 * `placeSchema` propuesto en `place.ts`, que se retira en el PR siguiente
 * junto con sus consumidores.
 *
 * Diferencias con lo que el portal asumía, todas verificadas contra código:
 *
 * - La ruta es `/business/places`, no `/business/me/places`.
 * - **La lista y el detalle NO tienen la misma forma.** `GET /business/places`
 *   devuelve 7 campos; `GET /business/places/{id}` devuelve 12. El portal
 *   modelaba un único `Place` para ambos.
 * - `latitude`/`longitude` son **dobles planos**, no un objeto
 *   `coordinates: { lat, lng }`. Internamente el backend guarda un
 *   `geography(point,4326)` de PostGIS, pero ese `Point` nunca se serializa.
 * - `category`/`subcategory` viajan como **enteros** (ver `taxonomy.ts`).
 * - `description` existe y es **obligatoria**.
 * - Campos que el portal inventó y no existen en ningún DTO: `businessId`,
 *   `placeType`, `timeZoneId`, `isVerified`, `totalCheckIns`,
 *   `allowedInDiscoveryRoutes`, `createdAt`. Y `id` es `placeId`.
 *
 * Contexto completo: `Renata-S-A-S/geoquest#191`.
 */

/**
 * `PlaceStatus.ToString()` del backend. Son **cuatro**, no tres: el portal
 * omitía `Deleted`, y es alcanzable — ni el repositorio de lista ni el de
 * detalle filtran por estado.
 */
export const businessPlaceStatusSchema = z.enum(['Draft', 'Active', 'Paused', 'Deleted'])
export type BusinessPlaceStatus = z.infer<typeof businessPlaceStatusSchema>

/** `GET /business/places` → `BusinessPlaceSummaryResult[]`. */
export const businessPlaceSummarySchema = z.object({
  placeId: z.string().uuid(),
  name: z.string(),
  category: categorySchema,
  subcategory: subcategorySchema,
  status: businessPlaceStatusSchema,
  xpReward: z.number().int().nonnegative(),
  geoPointsReward: z.number().int().nonnegative(),
})
export type BusinessPlaceSummary = z.infer<typeof businessPlaceSummarySchema>

/**
 * `GET /business/places/{id}` → `BusinessPlaceDetailResult`.
 *
 * `photos` es un arreglo de URLs planas, sin id por foto. El `photoId` que
 * pide `DELETE .../photos/{photoId}` se obtiene del nombre del archivo en
 * la última parte de la URL (`.../places/{placeId}/{photoId}.jpg`) — así lo
 * parsea el propio backend en `PlacePhotoId.TryParse`.
 */
export const businessPlaceDetailSchema = z.object({
  placeId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  category: categorySchema,
  subcategory: subcategorySchema,
  latitude: z.number(),
  longitude: z.number(),
  checkInRadiusMeters: z.number().int(),
  xpReward: z.number().int().nonnegative(),
  geoPointsReward: z.number().int().nonnegative(),
  status: businessPlaceStatusSchema,
  photos: z.array(z.string()),
})
export type BusinessPlaceDetail = z.infer<typeof businessPlaceDetailSchema>

/** Radio de check-in: 50–1000 metros inclusive (`Place.cs:36-37`). */
export const MIN_CHECK_IN_RADIUS_METERS = 50
export const MAX_CHECK_IN_RADIUS_METERS = 1000
export const DEFAULT_CHECK_IN_RADIUS_METERS = 100

/**
 * Recompensas de un `BusinessVenue`, fijadas por la plataforma.
 *
 * Verificado literal en Confluence (24 sep 2026):
 *
 * - **RN-GAM-02**: *"Un check-in en un `BusinessVenue` **nunca otorga XP**,
 *   ni base ni bonus. **Consumir no es explorar.**"*
 * - **RN-GAM-03**: `BusinessVenue` → `xpReward` = *"0 — forzado por el
 *   sistema"*.
 * - **RN-GAM-10**: *"un monto reducido de GeoPoints: 25% del baseline de
 *   plataforma (con baseline 50 → 12 GeoPoints). El porcentaje lo fija
 *   GeoQuest, no el negocio."*
 *
 * El backend tiene esas mismas dos constantes (`Place.cs`:
 * `BusinessVenueGeoPointsReward = 12`, y su docstring dice *"BusinessVenue:
 * SIEMPRE 0"* para el XP), así que los valores no son una interpretación
 * nuestra.
 *
 * ⚠️ **Pero `POST /business/places` los va a RECHAZAR hoy.** Ese endpoint no
 * pasa `placeType`, cae al default `TouristSite`, y esa rama exige mínimo 50
 * en ambos. O sea que el backend rechaza los únicos valores que sus propias
 * reglas permiten.
 *
 * Se mandan igual los correctos, por decisión de Derek: el portal queda
 * alineado con la regla y el desvío del backend está pedido en
 * `Renata-S-A-S/geoquest#191`. Antes se mandaba 50/50 solo para pasar esa
 * validación, lo que hacía que un check-in en un café diera lo mismo que
 * explorar un sitio turístico — exactamente lo que RN-GAM-02 prohíbe.
 */
export const BUSINESS_VENUE_XP_REWARD = 0
export const BUSINESS_VENUE_GEO_POINTS_REWARD = 12

/**
 * `POST /business/places` → body.
 *
 * **Sin `photos`**: las fotos no viajan en la creación. Se suben una por
 * una contra `POST /business/places/{id}/photos` como `multipart/form-data`
 * en el campo `file`, después de que el lugar existe. Eso confirma por otra
 * vía la corrección de #89 (el mínimo de 1 foto se exige al publicar, no al
 * crear): acá directamente no hay dónde ponerlas.
 *
 * Tampoco lleva `ownerBusinessId` — el backend lo resuelve desde la sesión
 * vía `BusinessMembershipRef`, el cliente nunca lo manda.
 */
export const createBusinessPlaceInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  category: categorySchema,
  subcategory: subcategorySchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  checkInRadiusMeters: z
    .number()
    .int()
    .min(MIN_CHECK_IN_RADIUS_METERS)
    .max(MAX_CHECK_IN_RADIUS_METERS),
  /*
   * Literales, no mínimos: un lugar del portal es siempre `BusinessVenue`, y
   * para ese tipo la regla no da un rango sino un valor único. Tiparlos como
   * literales hace que cualquier otro valor rompa la compilación en vez de
   * viajar al servidor.
   */
  xpReward: z.literal(BUSINESS_VENUE_XP_REWARD),
  geoPointsReward: z.literal(BUSINESS_VENUE_GEO_POINTS_REWARD),
})
export type CreateBusinessPlaceInput = z.infer<typeof createBusinessPlaceInputSchema>

/** `POST /business/places` → 201. Devuelve solo el id, no el agregado. */
export const createdBusinessPlaceSchema = z.object({ placeId: z.string().uuid() })
export type CreatedBusinessPlace = z.infer<typeof createdBusinessPlaceSchema>

/**
 * `PATCH /business/places/{id}` → body. **No es parcial pese al verbo**:
 * ambos campos son obligatorios y no vacíos, y el backend responde 204 sin
 * cuerpo. Solo se pueden editar estos dos — ni categoría, ni radio, ni
 * coordenadas, ni fotos.
 */
export const updateBusinessPlaceInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
})
export type UpdateBusinessPlaceInput = z.infer<typeof updateBusinessPlaceInputSchema>

/** `POST /business/places/{id}/publish` → 200. */
export const publishBusinessPlaceResultSchema = z.object({
  status: z.string(),
  visibleToExplorers: z.boolean(),
})
export type PublishBusinessPlaceResult = z.infer<typeof publishBusinessPlaceResultSchema>

/** `POST /business/places/{id}/photos` → 201. */
export const uploadedPlacePhotoSchema = z.object({
  photoId: z.string().uuid(),
  url: z.string(),
})
export type UploadedPlacePhoto = z.infer<typeof uploadedPlacePhotoSchema>

/** Máximo de fotos por lugar (`Place.cs:80`); la 6ta devuelve 409. */
export const MAX_PLACE_PHOTOS = 5
