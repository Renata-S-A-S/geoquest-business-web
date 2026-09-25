import type { SessionPort } from '@/shared/lib/session-port'
import { useSessionStore } from '@/shared/stores/session-store'
import { SEED_BUSINESS_STAFF, SEED_BUSINESS_STAFF_USERNAME } from '@/shared/mocks/seed'

/**
 * Implementación mock — no hace ninguna llamada HTTP. `refresh()` no tiene
 * un concepto real de expiración: si hay sesión mock activa, la devuelve
 * (éxito trivial); si no, rechaza. Alcanza para ejercitar el flujo de
 * 401-retry del interceptor sin fingir conocer un mecanismo real.
 */
export const mockSessionPort: SessionPort = {
  getAccessToken: () => useSessionStore.getState().accessToken,
  isAuthenticated: () => useSessionStore.getState().isAuthenticated,
  /**
   * Este token (`mock-token`) nunca tuvo forma de JWT, así que no hay nada
   * que decodificar: devuelve la identidad semilla directo, mismo criterio
   * que documenta `session-port.instance.ts` sobre por qué este puerto
   * quedó fuera del flujo activo.
   */
  getIdentityClaims: () =>
    useSessionStore.getState().isAuthenticated
      ? { username: SEED_BUSINESS_STAFF_USERNAME, email: SEED_BUSINESS_STAFF.email }
      : null,
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
