import { useSyncExternalStore } from 'react'
import { PREFERS_DARK_QUERY, resolveTheme, type ResolvedTheme } from '@/shared/lib/theme'
import { useThemeStore } from '@/shared/stores/theme-store'

// VERIFICADO: jsdom no implementa `window.matchMedia` en absoluto. Cada
// guarda de abajo es load-bearing — sin ella, cualquier `*.dom.test.tsx`
// existente se rompería en cuanto un componente que use este hook entre al
// árbol, incluso sin llamar nunca a `stubPrefersColorScheme`.
function subscribePrefersDark(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(PREFERS_DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getPrefersDarkSnapshot(): boolean {
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia(PREFERS_DARK_QUERY).matches
}

export function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribePrefersDark, getPrefersDarkSnapshot, () => false)
}

export function useResolvedTheme(): ResolvedTheme {
  const mode = useThemeStore((state) => state.mode)
  return resolveTheme(mode, usePrefersDark())
}
