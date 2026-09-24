export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'] as const

/** DEBE coincidir byte a byte con el `name`/`version` del `persist` en
 *  `theme-store.ts` — el bootstrap de pre-paint de `index.html` (PR3b) lee
 *  esta misma clave y el drift-guard de esa PR fija este string exacto.
 *
 *  Deliberadamente distinto de `geoquest.theme` (el Explorer): este repo ya
 *  usa `geoquest-business.auth` para su sesión persistida, así que este
 *  nombre es consistente con esa convención y evita cualquier colisión si
 *  ambos portales alguna vez comparten dominio. */
export const THEME_STORAGE_KEY = 'geoquest-business.theme'
export const THEME_STORAGE_VERSION = 1

export const PREFERS_DARK_QUERY = '(prefers-color-scheme: dark)'

/** Valores de `<meta name="theme-color">` = el token `paper` (fondo del
 *  shell, `app-shell.tsx`), que es justo lo que el chrome del navegador
 *  toca. El `theme_color` del manifest PWA (`vite.config.ts`) permanece
 *  `#10262B` siempre, sin relación con esto. */
export const THEME_COLOR_META: Record<ResolvedTheme, string> = {
  light: '#F6F3EC',
  dark: '#0A1618',
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

/** El modo es la elección explícita del usuario; el tema resuelto es
 *  siempre derivado, nunca guardado. `system` es el único modo que
 *  consulta la preferencia del SO — elegir Light o Dark explícitamente
 *  debe ganarle siempre a esa preferencia. */
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'system') return prefersDark ? 'dark' : 'light'
  return mode
}
