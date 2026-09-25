import { useQuery } from '@tanstack/react-query'
import { getBusinessMe } from './api/get-business-me'
import { getMyBusinesses } from './api/get-my-businesses'

/**
 * Registro de query keys de la slice `business` — issue #72. Se crea ahora
 * porque el literal `['business', 'me']` (antes solo en `pending-page.tsx`)
 * pasa a tener varios consumidores (`pending-page`, `business-settings-section`)
 * más el `setQueryData` de la mutación de edición. Centralizarlo acá es lo
 * que evita que la invalidación quede desalineada con los hooks que la leen.
 *
 * Alcance deliberadamente angosto: un archivo, una sola feature. No es una
 * fábrica de keys genérica ni un registro cross-feature — si esa necesidad
 * aparece, se resuelve ahí, no generalizando esto.
 *
 * `staffMe` (`GET /business-staff/me`) y la mutación `useUpdateBusinessMe`
 * (`PATCH /business/me`) se borraron en #72 PR4 (real-backend-readiness):
 * ninguno de los dos endpoints existe en el backend real — la identidad
 * ahora viene del JWT (`shared/lib/jwt-claims.ts`, `useIdentityClaims()`).
 *
 * `mine` (`GET /business/mine`, PR6a) se agrega como key INDEPENDIENTE de
 * `me`, no como reemplazo: ambos endpoints coexisten durante el
 * expand/contract (PR6a-6c) y `me` sigue siendo el que lee
 * `business-settings-section.tsx` hasta PR6c.
 */
export const businessKeys = {
  me: ['business', 'me'] as const,
  mine: ['business', 'mine'] as const,
}

/**
 * `staleTime: 30_000` vive acá (y ya no en `pending-page.tsx`) porque ahora
 * es compartido entre pantallas: amortigua refetches automáticos por foco
 * de pestaña sin afectar el refresh manual (`refetch()` ignora
 * `staleTime`). Regla explícita: si una pantalla necesita otra frescura,
 * se le pasa un override de opciones a este hook — nunca bifurcar la key,
 * o la invalidación deja de alcanzar a esa pantalla en silencio.
 */
export function useBusinessMe() {
  return useQuery({
    queryKey: businessKeys.me,
    queryFn: getBusinessMe,
    staleTime: 30_000,
  })
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
