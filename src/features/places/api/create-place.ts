import { apiClient } from '@/shared/lib/api-client'
import {
  createdBusinessPlaceSchema,
  type CreateBusinessPlaceInput,
  type CreatedBusinessPlace,
} from '@/shared/schemas/business-place'

/**
 * Lo que el FORMULARIO recoge del usuario. Coincide 1 a 1 con el payload
 * real: `createBusinessPlaceInputSchema` ya no declara recompensas (#211),
 * así que no hace falta un `Omit` acá.
 */
export type CreatePlaceFormInput = CreateBusinessPlaceInput

/**
 * `POST /business/places` — issues #30 y #33 (B-02).
 *
 * **No manda `xpReward`/`geoPointsReward`** (issue #211): el DTO real del
 * backend (`CreateBusinessPlaceRequest`) ni siquiera los declara, y el
 * dominio fuerza los valores fijos de plataforma —0 XP (RN-GAM-02/03) y 12
 * GeoPoints (RN-GAM-10)— para todo `BusinessVenue`, sin importar lo que el
 * cliente envíe. Mandarlos no cambiaría el resultado, así que el formulario
 * no los pide y el transporte reenvía el input tal cual.
 *
 * Devuelve solo `{ placeId }`: quien necesite el lugar completo tiene que
 * pedirlo con `GET /business/places/{id}`.
 */
export async function createPlace(input: CreatePlaceFormInput): Promise<CreatedBusinessPlace> {
  const { data } = await apiClient.post('/business/places', input)

  return createdBusinessPlaceSchema.parse(data)
}
