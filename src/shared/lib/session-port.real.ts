import axios from 'axios'
import type { SessionPort } from '@/shared/lib/session-port'
import { API_BASE_URL } from '@/shared/lib/env'
import { authTokensSchema } from '@/shared/schemas/auth'
import { useBusinessSessionStore } from '@/shared/stores/business-session-store'
import { decodeJwtClaims } from '@/shared/lib/jwt-claims'

/**
 * Nunca pasa por `session-interceptor.ts`: si `refresh()` llamara al
 * `apiClient` interceptado, un `/auth/refresh` que responde 401 recursaría
 * sobre sí mismo (el interceptor intentaría refrescar el refresh). Mismo
 * motivo que el `rawAxios` de geoquest-web (`auth-interceptor.ts`).
 */
const rawAxios = axios.create({ baseURL: API_BASE_URL })

/**
 * Implementación real de `SessionPort` — issue #20. `POST /auth/refresh`
 * con `{ refreshToken }`, misma forma que geoquest-web confirmó contra el
 * backend real de Identity (mismo Identity que `BusinessStaff`, distinto
 * claim de rol — contratos-portal-b2b.md §4.1).
 *
 * No expone un método `login`, más allá de los 5 de `SessionPort`: esta
 * clase solo sabe refrescar/cerrar una sesión ya iniciada, no iniciar una
 * nueva. `POST /auth/login` queda fuera de alcance de #20 — lo consume la
 * futura pantalla de login (#28), que guarda los tokens que reciba
 * llamando a `useBusinessSessionStore.getState().login(...)` directamente,
 * sin pasar por esta interfaz.
 */
export const realSessionPort: SessionPort = {
  getAccessToken: () => useBusinessSessionStore.getState().accessToken,
  isAuthenticated: () => useBusinessSessionStore.getState().isAuthenticated,
  getIdentityClaims: () => {
    const { accessToken } = useBusinessSessionStore.getState()
    return accessToken ? decodeJwtClaims(accessToken) : null
  },
  refresh: async () => {
    const { refreshToken } = useBusinessSessionStore.getState()
    if (!refreshToken) {
      throw new Error('realSessionPort.refresh: no hay refresh token')
    }

    const { data } = await rawAxios.post('/auth/refresh', { refreshToken })
    const tokens = authTokensSchema.parse(data)
    useBusinessSessionStore.getState().login(tokens)
    return tokens.accessToken
  },
  signOut: () => useBusinessSessionStore.getState().logout(),
  subscribe: (listener) => useBusinessSessionStore.subscribe(listener),
}
