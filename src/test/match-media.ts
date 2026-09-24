import { vi } from 'vitest'

export interface PrefersColorSchemeStub {
  /** Invierte la preferencia de SO simulada y dispara un evento `change`,
   *  imitando el comportamiento del navegador cuando el usuario (o el SO)
   *  alterna el modo oscuro con la app abierta en `mode: 'system'`. */
  emitChange: () => void
}

/**
 * Instala `window.matchMedia` para la query exacta
 * `(prefers-color-scheme: dark)` — la única que esta app emite (
 * `PREFERS_DARK_QUERY` en `theme.ts`). jsdom no implementa `matchMedia` en
 * absoluto, así que este stub es lo que hace utilizable bajo test la
 * suscripción `useSyncExternalStore` de `use-resolved-theme.ts`.
 *
 * Deliberadamente **opt-in**: NO se instala globalmente en `setup-dom.ts`.
 * La guarda de producción (`typeof window.matchMedia !== 'function'`) vive
 * en `use-resolved-theme.ts`; un stub global la enmascararía, exactamente
 * el tipo de bug que solo aparece en un navegador real.
 *
 * Deliberadamente lanza ante cualquier otra query en vez de devolver
 * `matches: false` en silencio — una llamada a `matchMedia` fuera del tema
 * debe fallar ruidosamente, no degradar en un falso negativo.
 */
export function stubPrefersColorScheme(matches: boolean): PrefersColorSchemeStub {
  const media = '(prefers-color-scheme: dark)'
  let current = matches
  const listeners = new Set<(event: MediaQueryListEvent) => void>()

  const mediaQueryList = {
    media,
    get matches() {
      return current
    },
    addEventListener: (type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (type === 'change') listeners.add(listener)
    },
    removeEventListener: (type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (type === 'change') listeners.delete(listener)
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
    onchange: null,
  } as unknown as MediaQueryList

  window.matchMedia = vi.fn((query: string) => {
    if (query !== media) {
      throw new Error(`stubPrefersColorScheme: query de matchMedia inesperada "${query}"`)
    }
    return mediaQueryList
  })

  return {
    emitChange: () => {
      current = !current
      const event = { matches: current, media } as MediaQueryListEvent
      listeners.forEach((listener) => listener(event))
    },
  }
}
