import { useQuery } from '@tanstack/react-query'
import { getBusinessMe } from './api/get-business-me'
import { getBusinessStaffMe } from './api/get-business-staff-me'

/**
 * Registro de query keys de la slice `business` — issue #72. Se crea ahora
 * porque el literal `['business', 'me']` (antes solo en `pending-page.tsx`)
 * pasa a tener tres consumidores (`pending-page`, la lectura de `/negocio`
 * y el `setQueryData` de la mutación de edición) más una segunda key,
 * `['business-staff', 'me']` (#72, PR4), que resuelve la identidad del
 * `BusinessStaff` autenticado. Centralizarlas acá es lo que evita que la
 * invalidación quede desalineada con los hooks que las leen.
 *
 * Alcance deliberadamente angosto: un archivo, una sola feature. No es una
 * fábrica de keys genérica ni un registro cross-feature — si esa necesidad
 * aparece, se resuelve ahí, no generalizando esto.
 *
 * `useUpdateBusinessMe` (la mutación de `PATCH /business/me`, PR3) sigue
 * diferido: su contrato ya existe (`patchBusinessMe` en
 * `api/patch-business-me.ts`), pero el hook llega recién con su primer
 * consumidor de UI (el formulario de edición, PR5) — no se anticipa acá.
 */
export const businessKeys = {
  me: ['business', 'me'] as const,
  staffMe: ['business-staff', 'me'] as const,
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
 * `GET /business-staff/me` (#72, PR4) — identidad del `BusinessStaff`
 * autenticado. Mismo `staleTime` que `useBusinessMe()` y misma
 * justificación: el rol/username no cambian con frecuencia, así que
 * amortiguar refetches por foco de pestaña no le cuesta nada a la UI que
 * lo consuma (el gate de edición, D4, y el bloque de usuario de
 * `/configuracion`, PR6).
 */
export function useBusinessStaffMe() {
  return useQuery({
    queryKey: businessKeys.staffMe,
    queryFn: getBusinessStaffMe,
    staleTime: 30_000,
  })
}
