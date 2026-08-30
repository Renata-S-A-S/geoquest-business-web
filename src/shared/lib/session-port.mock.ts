import type { SessionPort } from '@/shared/lib/session-port'
import { useSessionStore } from '@/shared/stores/session-store'

/**
 * Implementación mock — no hace ninguna llamada HTTP. `refresh()` no tiene
 * un concepto real de expiración: si hay sesión mock activa, la devuelve
 * (éxito trivial); si no, rechaza. Alcanza para ejercitar el flujo de
 * 401-retry del interceptor sin fingir conocer un mecanismo real.
 */
export const mockSessionPort: SessionPort = {
  getAccessToken: () => useSessionStore.getState().accessToken,
  isAuthenticated: () => useSessionStore.getState().isAuthenticated,
  refresh: async () => {
    const token = useSessionStore.getState().accessToken
    if (!token) {
      throw new Error('mockSessionPort.refresh: no hay sesión mock activa')
    }
    return token
  },
  signOut: () => useSessionStore.getState().signOut(),
  subscribe: (listener) => useSessionStore.subscribe(listener),
}
