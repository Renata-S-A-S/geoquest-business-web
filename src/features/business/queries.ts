import { useQuery } from '@tanstack/react-query'
import { getMyBusinesses } from './api/get-my-businesses'

/**
 * Registro de query keys de la slice `business` — issue #72. `me` (`GET
 * /business/me`) se retiró en PR6c-part2b junto con el endpoint legado;
 * `mine` (`GET /business/mine`, PR6a) queda como la única key.
 *
 * Alcance deliberadamente angosto: un archivo, una sola feature. No es una
 * fábrica de keys genérica ni un registro cross-feature — si esa necesidad
 * aparece, se resuelve ahí, no generalizando esto.
 */
export const businessKeys = {
  mine: ['business', 'mine'] as const,
}

/**
 * `select: (list) => list[0] ?? null` — decisión de diseño #1549 "con varios
 * negocios propios usar el primer elemento" (open question, aceptada con su
 * default en #1550 punto 4). Cachea el ARRAY completo bajo `businessKeys.mine`
 * (listo para un futuro selector multi-negocio sin otro round-trip), y
 * expone `null` — no `undefined` — cuando el array está vacío, para que un
 * consumidor pueda distinguir "sin negocio propio" (`data === null`) de
 * "todavía cargando" (`data === undefined`, ver `isPending`).
 */
export function useMyBusiness() {
  return useQuery({
    queryKey: businessKeys.mine,
    queryFn: getMyBusinesses,
    select: (businesses) => businesses[0] ?? null,
    staleTime: 30_000,
  })
}
