import { useSyncExternalStore } from 'react'
import { sessionPort } from '@/shared/lib/session-port.instance'

/**
 * Único punto donde un componente de React lee el estado de sesión. Usa
 * `useSyncExternalStore` contra `sessionPort.subscribe`, así que funciona
 * sin importar qué implementación esté activa (mock hoy, real mañana).
 */
export function useSession() {
  const isAuthenticated = useSyncExternalStore(sessionPort.subscribe, () =>
    sessionPort.isAuthenticated()
  )
  return { isAuthenticated }
}
