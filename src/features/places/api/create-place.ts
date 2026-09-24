import { apiClient } from '@/shared/lib/api-client'
import {
  createdBusinessPlaceSchema,
  MIN_GEO_POINTS_REWARD,
  MIN_XP_REWARD,
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
 * ⚠️ **Las recompensas se completan acá, no en el formulario.** Es una
 * contradicción del contrato que hay que resolver arriba, y esta función es
 * donde se absorbe mientras tanto.
 *
 * ADR-041/043 y RN-GAM-10 dicen que el negocio NO configura los puntos, y
 * el contrato es explícito: *"el formulario de B-02 debe **eliminar** el
 * campo de puntos por completo, no solo cambiar su default"*. El racional
 * registrado es evitar que un negocio compita subiendo el número, ya que
 * esos puntos son canjeables en toda la red.
 *
 * Pero el backend desplegado **exige** `xpReward` y `geoPointsReward` con
 * mínimo 50 cada uno, porque crea el lugar como `TouristSite` y esa rama
 * valida los mínimos (ver `business-place.ts`).
 *
 * Las dos reglas son incompatibles, así que se cumplen las dos hasta donde
 * se puede: **el formulario no muestra el campo** (regla de negocio) y el
 * transporte manda el mínimo aceptado (regla del servidor). Enviar el
 * mínimo es además la opción más conservadora: es el valor que menos
 * ventaja le da a un negocio sobre otro.
 *
 * Si el backend pasa a fijarlos server-side —que es lo que
 * `Renata-S-A-S/geoquest#191` propone—, estas dos líneas se borran y el
 * formulario no cambia.
 *
 * Devuelve solo `{ placeId }`: quien necesite el lugar completo tiene que
 * pedirlo con `GET /business/places/{id}`.
 */
export async function createPlace(input: CreatePlaceFormInput): Promise<CreatedBusinessPlace> {
  const { data } = await apiClient.post('/business/places', {
    ...input,
    xpReward: MIN_XP_REWARD,
    geoPointsReward: MIN_GEO_POINTS_REWARD,
  })

  return createdBusinessPlaceSchema.parse(data)
}
