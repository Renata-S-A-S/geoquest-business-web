import { useQuery } from '@tanstack/react-query'
import { getBusinessMe } from './api/get-business-me'

/**
 * Registro de query keys de la slice `business` — issue #72. Se crea ahora
 * porque el literal `['business', 'me']` (antes solo en `pending-page.tsx`)
 * pasa a tener tres consumidores (`pending-page`, la lectura de `/negocio`
 * y el `setQueryData` de la mutación de edición) más una segunda key que
 * llega en una PR posterior (`['business-staff', 'me']`). Centralizarlas
 * acá es lo que evita que la invalidación quede desalineada con los hooks
 * que las leen.
 *
 * Alcance deliberadamente angosto: un archivo, una sola feature. No es una
 * fábrica de keys genérica ni un registro cross-feature — si esa necesidad
 * aparece, se resuelve ahí, no generalizando esto.
 *
 * `staffMe` y los hooks de mutación (`useBusinessStaffMe`,
 * `useUpdateBusinessMe`) se agregan en las PRs que traen sus contratos —
 * no se anticipan acá.
 */
export const businessKeys = {
  me: ['business', 'me'] as const,
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
