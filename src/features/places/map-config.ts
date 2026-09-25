import type { ResolvedTheme } from '@/shared/lib/theme'

/**
 * Configuración del mapa de lugares.
 *
 * ⚠️ **`VITE_MAPBOX_TOKEN` no está provisionado todavía**, ni acá ni en el
 * Explorer. El comentario de `map-config.ts` de `geoquest-web` lo dice
 * explícitamente: *"user-provisioned and not yet set… the app must degrade
 * to list-only mode, not crash, when it's absent"*.
 *
 * Acá se sigue el mismo criterio, adaptado: **sin token la pantalla muestra
 * las coordenadas en texto**, que es exactamente lo que mostraba antes de
 * que existiera el mapa. Degradar a lo anterior es mejor que degradar a un
 * hueco gris, y significa que este PR no depende de que nadie consiga una
 * credencial para ser útil.
 *
 * La resolución vive en funciones puras para poder testear las dos ramas sin
 * stubbear `import.meta.env`, mismo criterio que el Explorer.
 */
export const MAPBOX_TOKEN: string | undefined = import.meta.env.VITE_MAPBOX_TOKEN

export function computeHasMapboxToken(token: string | undefined): boolean {
  return Boolean(token && token.trim().length > 0)
}

export const hasMapboxToken = computeHasMapboxToken(MAPBOX_TOKEN)

/**
 * Estilos de stock, no estilos de marca. Se eligen los mismos dos que usa el
 * Explorer para que un lugar se vea igual en las dos aplicaciones: un mapa
 * con otra paleta haría dudar de si es el mismo sitio.
 */
export const MAP_STYLE_URLS: Record<ResolvedTheme, string> = {
  light: 'mapbox://styles/mapbox/streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
}

export function resolveMapStyleUrl(theme: ResolvedTheme): string {
  return MAP_STYLE_URLS[theme]
}

/**
 * Zoom de un lugar concreto. 16 muestra la manzana: suficiente para
 * reconocer la esquina sin perder el contexto de las calles alrededor.
 */
export const PLACE_DETAIL_ZOOM = 16
