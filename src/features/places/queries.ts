import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getPlaces } from './api/get-places'
import { createPlace } from './api/create-place'
import { getPlace } from './api/get-place'
import { publishPlace } from './api/publish-place'

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
  /**
   * Clave por lugar. Comparte el prefijo `['places']` con `list` a
   * propósito: es el ÚNICO caso donde compartir raíz es correcto, porque
   * invalidar `['places']` después de publicar debe alcanzar al detalle Y al
   * listado — el estado cambió en los dos.
   */
  detail: (placeId: string) => ['places', 'detail', placeId] as const,
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
 * La mutación de creación llega en #30/#33 (abajo), con su primer
 * consumidor real — `PlaceForm`.
 */
export function usePlaces() {
  return useQuery({
    queryKey: placeKeys.list,
    queryFn: getPlaces,
    staleTime: 30_000,
  })
}

/**
 * `POST /business/places` (#30, #33) — mutación del formulario de creación.
 *
 * **Nunca optimista**, misma regla verificada del Explorer que aplica
 * `useUpdateBusinessMe` (#72): el servidor puede rechazar el alta (400 por
 * validación o taxonomía cruzada), y una lista que ya mostró el lugar
 * tendría que quitarlo, lo que confunde más de lo que ayuda.
 *
 * En éxito **invalida** en vez de hacer `setQueryData`, a diferencia de
 * `useUpdateBusinessMe`. El motivo es concreto: el `POST` devuelve solo
 * `{ placeId }`, no el agregado, así que no hay con qué sembrar la cache.
 * Construir la fila a mano desde el input sería adivinar lo que el servidor
 * decidió — el estado, las recompensas resueltas — y esa fila inventada
 * quedaría en pantalla hasta el próximo refetch.
 */
export function useCreatePlace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createPlace,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: placeKeys.list })
    },
  })
}

/**
 * `GET /business/places/{id}` (#35) — detalle de un lugar.
 *
 * Mismo `staleTime` que el listado. `enabled` deja de correr la consulta si
 * la ruta llega sin id: preferimos no disparar un request condenado a 404
 * antes que dejar que el usuario vea un error que no explica nada.
 */
export function usePlace(placeId: string | undefined) {
  return useQuery({
    queryKey: placeKeys.detail(placeId ?? ''),
    queryFn: () => getPlace(placeId as string),
    enabled: Boolean(placeId),
    staleTime: 30_000,
  })
}

/**
 * `POST /business/places/{id}/publish` (#34).
 *
 * En éxito invalida **todo el prefijo `['places']`**, no solo el detalle: el
 * estado del lugar cambió, y el listado muestra ese estado en su badge.
 * Invalidar solo el detalle dejaría el listado diciendo «Borrador» sobre un
 * lugar que ya está activo, y el negocio no tendría motivo para dudar de lo
 * que ve.
 *
 * Nunca optimista, por la misma razón que el resto: el servidor puede
 * rechazar con 409 (sin fotos, ya activo, borrado), y una pantalla que ya
 * mostró «Activo» tendría que retractarse.
 */
export function usePublishPlace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: publishPlace,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['places'] })
    },
  })
}
