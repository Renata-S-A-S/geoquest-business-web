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
 * Solo un `Draft` con al menos una foto se puede publicar. Las tres razones
 * de rechazo del backend son 409:
 *
 * - `Place.Deleted` — un lugar borrado no revive
 * - `Place.AlreadyActive` — ya está publicado
 * - `Place.ActiveRequiresAtLeastOnePhoto` — sin fotos no hay nada que mostrar
 *
 * Chequearlo del lado del cliente no reemplaza al servidor: evita ofrecer un
 * botón que va a fallar, que es distinto de confiar en que no falle.
 */
export function canPublishPlace(place: BusinessPlaceDetail): boolean {
  return place.status === 'Draft' && place.photos.length > 0
}
