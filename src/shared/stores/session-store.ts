import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface SessionState {
  accessToken: string | null
  isAuthenticated: boolean
  signIn: (accessToken: string) => void
  signOut: () => void
}

/**
 * Store que respalda `mockSessionPort` (ver session-port.ts). Persistido en
 * localStorage para sobrevivir un reload, igual que `auth-store.ts` en
 * geoquest-web — mismo motivo: sin esto, F5 pierde la sesión mock aunque
 * "siguiera vigente".
 */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      accessToken: null,
      isAuthenticated: false,
      signIn: (accessToken) => set({ accessToken, isAuthenticated: true }),
      signOut: () => set({ accessToken: null, isAuthenticated: false }),
    }),
    {
      name: 'geoquest-business.session',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    }
  )
)
