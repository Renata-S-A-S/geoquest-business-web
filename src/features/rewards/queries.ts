import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRewards } from './api/get-rewards'
import { createReward, type CreateRewardFormInput } from './api/create-reward'

/**
 * Registro de query keys de la slice `rewards` — issue #36 (B-03). Mismo
 * criterio que `businessKeys` (#72) y `placeKeys` (#29): las keys viven en
 * un solo lugar para que invalidar no se desincronice de leer.
 *
 * **El `businessId` es parte de la key, no un detalle del transporte.** Ahora
 * que las rutas lo llevan en el path, dos negocios distintos devuelven
 * listados distintos para la misma pantalla; sin el id en la key, cambiar de
 * negocio serviría la cache del anterior. Un dueño con más de un negocio es
 * un caso real: `GET /business/mine` del backend devuelve un array
 * justamente por eso.
 *
 * `list` y `detail` comparten la raíz `['rewards', businessId]` A PROPÓSITO,
 * igual que `placeKeys`: después de pausar o republicar hay que invalidar el
 * prefijo para que el cambio alcance al detalle Y al listado, no solo a la
 * pantalla en la que se hizo clic.
 *
 * No comparte prefijo con `businessKeys` ni con `placeKeys`: la key describe
 * qué hay en la cache, no de qué URL vino.
 */
export const rewardKeys = {
  /** Prefijo de invalidación: alcanza el listado y todos los detalles. */
  all: ['rewards'] as const,
  list: (businessId: string) => ['rewards', businessId, 'list'] as const,
}

/**
 * `GET /portal/businesses/{businessId}/rewards` (#36).
 *
 * Recibe el `businessId` en vez de resolverlo adentro, igual que
 * `usePlace(placeId)`: así la dependencia queda visible en el contenedor, que
 * es quien tiene que decidir qué mostrar mientras el negocio carga o si su
 * lectura falla. Un hook que lo resolviera solo dejaría la query en
 * `isPending` para siempre cuando `GET /business/me` falla — un spinner
 * eterno sin error a la vista.
 *
 * `staleTime: 30_000`, igual que `usePlaces()` y `useBusinessMe()`:
 * amortigua refetches automáticos por foco de pestaña sin tocar el refresh
 * manual (`refetch()` ignora `staleTime`).
 */
export function useRewards(businessId: string | undefined) {
  return useQuery({
    queryKey: rewardKeys.list(businessId ?? ''),
    queryFn: () => getRewards(businessId as string),
    enabled: Boolean(businessId),
    staleTime: 30_000,
  })
}

/**
 * `POST /portal/businesses/{businessId}/rewards` (#38, #40, #41).
 *
 * Invalida en vez de sembrar la cache, por el mismo motivo que
 * `useCreatePlace`: el `POST` devuelve solo `{ rewardId }`, así que armar la
 * fila a mano sería adivinar lo que el servidor decidió — el estado, el
 * stock restante — y esa fila inventada quedaría en pantalla hasta el
 * próximo refetch.
 *
 * Invalida el prefijo `['rewards']` y no solo la lista del negocio actual:
 * es una escritura, y el costo de un refetch de más es menor que el de una
 * pantalla mostrando datos viejos.
 *
 * Nunca optimista: el servidor puede rechazar con 400, y una lista que ya
 * mostró la recompensa tendría que quitarla.
 */
export function useCreateReward(businessId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateRewardFormInput) => createReward(businessId as string, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rewardKeys.all })
    },
  })
}
