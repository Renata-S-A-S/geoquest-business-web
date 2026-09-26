import { useBusinessAccess } from './use-business-access'

/**
 * Props listas para asignar a cualquier control de escritura (`Button`
 * nativo o `ActionLink`), derivadas de `useBusinessAccess()` (PR8a). Un solo
 * hook resuelve "¿está bloqueado y por qué?" para las superficies de
 * recompensas, lugares y canjes que un negocio Paused/Suspended no puede
 * usar (PR8b, owner decision #1546 punto 1: sin excepciones, incluido el
 * lookup/scan de canjes).
 */
export interface WriteGuard {
  disabled: boolean
  /** Id del banner de estado, o `undefined` cuando se puede escribir. */
  describedBy: string | undefined
}

export function useWriteGuard(): WriteGuard {
  const { canWrite, bannerId } = useBusinessAccess()
  return { disabled: !canWrite, describedBy: canWrite ? undefined : bannerId }
}
