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
 * Mínimos de recompensa que el backend exige.
 *
 * ⚠️ **Contradicción sin resolver, y no es del frontend.** ADR-041/043 y
 * RN-GAM-10 dicen que un `Place` creado desde el portal es `BusinessVenue`,
 * otorga 0 XP y 12 GeoPoints fijados por la plataforma, y que el negocio
 * **no los configura** — el racional registrado es evitar que compita
 * subiendo el número.
 *
 * El backend hace lo contrario: `CreateBusinessPlaceCommandHandler` no pasa
 * `placeType`, así que `Place.Create` cae a su default `TouristSite`, y con
 * eso **exige** que el llamador mande ambos valores con mínimo 50. El
 * override `(0, 12)` solo aplica a `BusinessVenue`, que ese endpoint nunca
 * crea.
 *
 * Acá se replica lo que el servidor ACEPTA, porque es lo único verificable.
 * La decisión de producto está pedida en `Renata-S-A-S/geoquest#191`: de
 * ella depende si el formulario muestra el campo de puntos o lo elimina.
 */
export const MIN_XP_REWARD = 50
export const MIN_GEO_POINTS_REWARD = 50

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
  xpReward: z.number().int().min(MIN_XP_REWARD),
  geoPointsReward: z.number().int().min(MIN_GEO_POINTS_REWARD),
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
