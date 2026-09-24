import { apiClient } from '@/shared/lib/api-client'
import {
  businessPlaceDetailSchema,
  type BusinessPlaceDetail,
} from '@/shared/schemas/business-place'

/**
 * `GET /business/places/{id}` — issue #35 (B-02).
 *
 * ⚠️ La issue dice *"no hay `GET /places/{id}` confirmado todavía — puede
 * resolver del listado (#29) hasta que exista"*. **Esa premisa quedó
 * vieja**: el endpoint existe y devuelve `BusinessPlaceDetailResult`, con
 * los cinco campos que el resumen del listado NO trae (descripción,
 * coordenadas, radio y fotos). Resolver del listado habría dado una
 * pantalla de detalle sin nada que el listado no mostrara ya.
 *
 * Devuelve el lugar en cualquier estado, incluido `Deleted`: el dueño
 * puede verlo siempre (documentado en `IPlaceRepository`).
 */
export async function getPlace(placeId: string): Promise<BusinessPlaceDetail> {
  const { data } = await apiClient.get(`/business/places/${placeId}`)
  return businessPlaceDetailSchema.parse(data)
}
