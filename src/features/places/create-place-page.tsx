import { PlaceForm } from '@/features/places/place-form'

/**
 * B-02 — Alta de lugar (#30 y #33). Reemplaza el `RoutePlaceholder` de
 * `/lugares/nuevo` que registró #29.
 *
 * Contenedor deliberadamente vacío: a diferencia de `PlacesPage`, esta
 * pantalla no lee nada antes de renderizar, así que no hay fork
 * pendiente/error que repartir. Existe igual para mantener el par
 * página/vista uniforme con el resto del repo y para tener dónde colgar la
 * precarga cuando exista la edición (`PATCH /business/places/{id}`).
 */
export function CreatePlacePage() {
  return <PlaceForm />
}
