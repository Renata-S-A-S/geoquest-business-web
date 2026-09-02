import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { AuthTokens } from '@/shared/schemas/auth'

interface BusinessSessionState {
  accessToken: string | null
  accessTokenExpiresAtUtc: string | null
  refreshToken: string | null
  refreshTokenExpiresAtUtc: string | null
  isAuthenticated: boolean
  login: (tokens: AuthTokens) => void
  logout: () => void
}

const loggedOutTokenState = {
  accessToken: null,
  accessTokenExpiresAtUtc: null,
  refreshToken: null,
  refreshTokenExpiresAtUtc: null,
} as const

/**
 * Store que respalda `session-port.real.ts` — issue #20. Deliberadamente
 * separado de `session-store.ts` (que sigue respaldando únicamente
 * `session-port.mock.ts` sin ningún cambio): el criterio de aceptación
 * pide conservar el mock intacto para tests/storybook, no reutilizar ni
 * mutar su store.
 *
 * Misma forma y misma decisión de persistencia que `auth-store.ts` de
 * geoquest-web (mismo `Identity`, mismo backend real): persistido en
 * `localStorage` porque el refresh de un access token vencido se resuelve
 * perezoso, en la primera petición autenticada tras un reload (vía
 * `session-interceptor.ts`) — no hace falta refrescar al montar.
 *
 * `login()` no es parte de la interfaz `SessionPort` (#20 no cubre
 * `POST /auth/login`, ver #28) — existe para que la futura pantalla de
 * login (#28) pueda guardar los tokens que reciba, sin que ningún otro
 * archivo del resto de la app conozca este store.
 */
export const useBusinessSessionStore = create<BusinessSessionState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      ...loggedOutTokenState,
      login: (tokens) =>
        set({
          isAuthenticated: Boolean(tokens.accessToken),
          accessToken: tokens.accessToken,
          accessTokenExpiresAtUtc: tokens.accessTokenExpiresAtUtc,
          refreshToken: tokens.refreshToken,
          refreshTokenExpiresAtUtc: tokens.refreshTokenExpiresAtUtc,
        }),
      logout: () => set({ isAuthenticated: false, ...loggedOutTokenState }),
    }),
    {
      name: 'geoquest-business.auth',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    }
  )
)
