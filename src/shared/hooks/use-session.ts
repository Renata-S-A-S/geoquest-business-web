import { useSyncExternalStore } from 'react'
import { sessionPort } from '@/shared/lib/session-port.instance'

/**
 * Único punto donde un componente de React lee el estado de sesión. Usa
 * `useSyncExternalStore` contra `sessionPort.subscribe`, así que funciona
 * sin importar qué implementación esté activa (mock hoy, real mañana).
 *
 * También expone `signOut` (issue #70): un componente nunca importa
 * `session-port.instance` directamente, pasa siempre por este hook — mismo
 * criterio de encapsulamiento que ya aplica `isAuthenticated`.
 */
export function useSession() {
  const isAuthenticated = useSyncExternalStore(sessionPort.subscribe, () =>
    sessionPort.isAuthenticated()
  )
  return { isAuthenticated, signOut: sessionPort.signOut }
}
