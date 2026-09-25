import { apiClient } from '@/shared/lib/api-client'
import {
  publishBusinessPlaceResultSchema,
  type BusinessPlaceDetail,
  type PublishBusinessPlaceResult,
} from '@/shared/schemas/business-place'

/**
 * `POST /business/places/{id}/publish` — issue #34 (B-02).
 *
 * Devuelve `{ status, visibleToExplorers }`, no el `Place` completo.
 *
 * `visibleToExplorers` merece atención: el lugar se activa SIEMPRE, pero
 * puede quedar invisible para los exploradores si el negocio dueño todavía
 * no está verificado. O sea que un 200 con `visibleToExplorers: false` es
 * un éxito parcial, y la interfaz tiene que poder distinguirlo — publicar y
 * ser visible no son lo mismo.
 */
export async function publishPlace(placeId: string): Promise<PublishBusinessPlaceResult> {
  const { data } = await apiClient.post(`/business/places/${placeId}/publish`)
  return publishBusinessPlaceResultSchema.parse(data)
}

/**
 * Precondición de publicación, replicada de `Place.Activate` del backend.
 *
 * `Place.Activate` rechaza **exactamente dos** estados, ambos con 409:
 *
 * - `Place.Deleted` — un lugar borrado no revive
 * - `Place.AlreadyActive` — ya está publicado
 *
 * más `Place.ActiveRequiresAtLeastOnePhoto` si no tiene fotos.
 *
 * ⚠️ **`Paused` NO está en esa lista: un lugar pausado sí se puede
 * publicar.** El docstring de `Place.Activate` lo confirma — dice que
 * `BusinessReactivatedEventDispatcher` reutiliza ese mismo método
 * precisamente sobre lugares `Paused`.
 *
 * Esto estaba mal antes: la condición exigía `status === 'Draft'`, así que
 * el portal deshabilitaba el botón para una acción que el servidor habría
 * aceptado. Un negocio cuyo lugar quedó pausado —por ejemplo por la cascada
 * de RN-BIZ-04 al suspenderse el negocio, y luego reactivado— no tenía
 * ninguna forma de volver a publicarlo.
 *
 * Chequearlo del lado del cliente no reemplaza al servidor: evita ofrecer un
 * botón que va a fallar, que es distinto de confiar en que no falle. Pero
 * ser MÁS estricto que el servidor es peor que no chequear nada, porque
 * esconde una acción legítima.
 */
export function canPublishPlace(place: BusinessPlaceDetail): boolean {
  const publishableStatus = place.status === 'Draft' || place.status === 'Paused'
  return publishableStatus && place.photos.length > 0
}
