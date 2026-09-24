import { useEffect } from 'react'
import { THEME_COLOR_META } from '@/shared/lib/theme'
import { useResolvedTheme } from '@/shared/hooks/use-resolved-theme'

/**
 * Componente que no renderiza ningún nodo — NO es un hook llamado en el
 * cuerpo de `AppProviders`: suscribir ahí un hook que re-resuelve en cada
 * cambio de tema re-renderizaría todo el árbol de la app en cada toggle.
 * Por eso se monta como HERMANO dentro de `AppProviders` (ver
 * `providers.tsx`), no como una llamada a hook.
 *
 * Único dueño de las dos mutaciones de DOM relacionadas al tema: la clase
 * `dark` en `<html>` y el `content` de `<meta name="theme-color">`. El
 * bootstrap de pre-paint en `index.html` ya fijó los valores iniciales
 * correctos antes del primer render de React; este componente solo
 * reconcilia cambios posteriores (un switch explícito del usuario, o un
 * flip de preferencia del SO mientras el modo sigue en "system").
 */
export function ThemeEffects() {
  const resolved = useResolvedTheme()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLOR_META[resolved])
  }, [resolved])

  return null
}
