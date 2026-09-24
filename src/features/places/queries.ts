import { useQuery } from '@tanstack/react-query'
import { getPlaces } from './api/get-places'

/**
 * Registro de query keys de la slice `places` — issue #29 (B-02). Mismo
 * criterio que `businessKeys` (#72): las keys viven en un solo lugar para
 * que invalidar no se desincronice de leer.
 *
 * `list` es un arreglo propio y NO comparte prefijo con `businessKeys`,
 * aunque el endpoint cuelgue de `/business/me/places`. La key describe qué
 * hay en la cache, no de qué URL vino: si compartieran raíz, invalidar el
 * perfil del negocio arrastraría la lista de lugares sin que nadie lo haya
 * pedido.
 *
 * Alcance angosto a propósito, igual que en `business`: un archivo, una
 * feature. No es una fábrica genérica de keys.
 */
export const placeKeys = {
  list: ['places', 'list'] as const,
}

/**
 * `GET /business/me/places` (#29) — lista de lugares del negocio.
 *
 * `staleTime: 30_000` replicando `useBusinessMe()`: amortigua refetches
 * automáticos por foco de pestaña sin tocar el refresh manual
 * (`refetch()` ignora `staleTime`). Un lugar cambia cuando el negocio lo
 * edita, no solo.
 *
 * Misma regla explícita que en `business`: si una pantalla necesita otra
 * frescura, se le pasa un override de opciones a este hook — nunca
 * bifurcar la key, o la invalidación deja de alcanzar esa pantalla en
 * silencio.
 *
 * La mutación de creación (`POST /business/me/places`) NO vive acá
 * todavía: llega con su primer consumidor real, el formulario de #30/#33,
 * siguiendo el precedente de `useUpdateBusinessMe` (#72), que se difirió
 * de PR3/PR4 a PR5 por exactamente este motivo. Un hook sin consumidor no
 * se puede verificar contra un uso real.
 */
export function usePlaces() {
  return useQuery({
    queryKey: placeKeys.list,
    queryFn: getPlaces,
    staleTime: 30_000,
  })
}
