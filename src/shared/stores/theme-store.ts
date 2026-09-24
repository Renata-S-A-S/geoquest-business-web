import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { THEME_STORAGE_KEY, THEME_STORAGE_VERSION, type ThemeMode } from '@/shared/lib/theme'

export interface ThemeStoreState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

/**
 * Persiste ÚNICAMENTE la elección explícita del usuario. El valor resuelto
 * (light/dark) lo deriva `useResolvedTheme()` a partir de `mode` +
 * `matchMedia`, nunca se guarda — mismo criterio que la relación entre un
 * idioma persistido y el `resolvedLanguage` derivado de i18n.
 *
 * `version: 1` sin `migrate`, igual que `business-session-store.ts`: la
 * superficie persistida es un enum de 3 valores y el `merge` shallow por
 * default de zustand ya resuelve cualquier campo nuevo futuro a su default.
 * La defensa real de forward-compat vive en el bootstrap de pre-paint de
 * `index.html` (PR3b), que valida `mode` contra el union literal e ignora
 * `version` por completo.
 */
export const useThemeStore = create<ThemeStoreState>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: THEME_STORAGE_KEY,
      version: THEME_STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ mode: state.mode }),
    }
  )
)
