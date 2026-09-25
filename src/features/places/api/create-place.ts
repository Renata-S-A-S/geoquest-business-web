import { apiClient } from '@/shared/lib/api-client'
import {
  BUSINESS_VENUE_GEO_POINTS_REWARD,
  BUSINESS_VENUE_XP_REWARD,
  createdBusinessPlaceSchema,
  type CreateBusinessPlaceInput,
  type CreatedBusinessPlace,
} from '@/shared/schemas/business-place'

/**
 * Subconjunto que el FORMULARIO recoge del usuario. Es más chico que el
 * payload real: las recompensas no se piden.
 */
export type CreatePlaceFormInput = Omit<
  CreateBusinessPlaceInput,
  'xpReward' | 'geoPointsReward'
>

/**
 * `POST /business/places` — issues #30 y #33 (B-02).
 *
 * **Las recompensas se completan acá con los valores de la REGLA**, no con
 * lo que el backend acepta hoy.
 *
 * RN-GAM-02/03 y RN-GAM-10 (verificado literal en Confluence): un lugar
 * creado desde el portal es siempre `BusinessVenue`, y un `BusinessVenue`
 * otorga **0 XP siempre** —*"consumir no es explorar"*— y **12 GeoPoints**
 * fijados por la plataforma. El negocio no elige ninguno de los dos, y por
 * eso el formulario no los pide.
 *
 * ⚠️ **El backend real va a rechazar esto con 400 hasta que se corrija.** No
 * pasa `placeType`, cae al default `TouristSite`, y esa rama exige mínimo 50
 * en ambos campos: rechaza los únicos valores que sus propias reglas
 * permiten. Está pedido en `Renata-S-A-S/geoquest#191`.
 *
 * Antes se mandaba 50/50 justamente para pasar esa validación, y eso tenía
 * una consecuencia de producto: un explorador que hacía check-in en un café
 * ganaba lo mismo que explorando un sitio turístico. Preferimos un 400
 * visible y una issue abierta antes que datos que contradicen la regla en
 * silencio.
 *
 * Devuelve solo `{ placeId }`: quien necesite el lugar completo tiene que
 * pedirlo con `GET /business/places/{id}`.
 */
export async function createPlace(input: CreatePlaceFormInput): Promise<CreatedBusinessPlace> {
  const { data } = await apiClient.post('/business/places', {
    ...input,
    xpReward: BUSINESS_VENUE_XP_REWARD,
    geoPointsReward: BUSINESS_VENUE_GEO_POINTS_REWARD,
  })

  return createdBusinessPlaceSchema.parse(data)
}
