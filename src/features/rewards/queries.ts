import { useQuery } from '@tanstack/react-query'
import { getRewards } from './api/get-rewards'

/**
 * Registro de query keys de la slice `rewards` — issue #36 (B-03). Mismo
 * criterio que `businessKeys` (#72) y `placeKeys` (#29): las keys viven en
 * un solo lugar para que invalidar no se desincronice de leer.
 *
 * `list` no comparte prefijo con `businessKeys` ni con `placeKeys`. La key
 * describe qué hay en la cache, no de qué URL vino: si compartiera raíz con
 * el negocio, invalidar el perfil arrastraría las recompensas sin que nadie
 * lo haya pedido.
 */
export const rewardKeys = {
  list: ['rewards', 'list'] as const,
}

/**
 * `GET /portal/rewards` (#36) — recompensas del negocio.
 *
 * `staleTime: 30_000`, igual que `usePlaces()` y `useBusinessMe()`:
 * amortigua refetches automáticos por foco de pestaña sin tocar el refresh
 * manual (`refetch()` ignora `staleTime`).
 *
 * Si una pantalla necesita otra frescura, se le pasa un override de
 * opciones a este hook — nunca bifurcar la key, o la invalidación deja de
 * alcanzar esa pantalla en silencio.
 *
 * La mutación de publicación (`POST /portal/rewards/{id}/publish`) NO vive
 * acá todavía: el mock ya la soporta, pero llega con su primer consumidor
 * real, siguiendo el precedente de `useUpdateBusinessMe` (#72) y de la
 * creación de lugares (#29). Un hook sin consumidor se testea contra la
 * idea de cómo se va a usar, que es donde se cuelan los errores de diseño.
 */
export function useRewards() {
  return useQuery({
    queryKey: rewardKeys.list,
    queryFn: getRewards,
    staleTime: 30_000,
  })
}
