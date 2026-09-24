import { cva } from 'class-variance-authority'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/cn'
import { useThemeStore } from '@/shared/stores/theme-store'
import type { ThemeMode } from '@/shared/lib/theme'

/**
 * A diferencia de `LANGUAGE_OPTIONS` (endonimias, nunca traducidas), los
 * nombres de tema SÍ se traducen — usa claves del namespace `common` en vez
 * de una etiqueta constante (design, sección "theme-switcher.tsx").
 */
const THEME_OPTIONS = [
  { mode: 'light', labelKey: 'theme.light' },
  { mode: 'dark', labelKey: 'theme.dark' },
  { mode: 'system', labelKey: 'theme.system' },
] as const satisfies ReadonlyArray<{ mode: ThemeMode; labelKey: string }>

/**
 * Este repo no tiene el componente `Pill` que usa la versión del Explorer
 * (`GeoQuestFront/src/shared/components/theme-switcher.tsx`) — se arma la
 * opción seleccionada/no seleccionada con `cva` sobre un `<button>` plano,
 * mismo patrón que `button.tsx`. El foco visible es `focus-visible:outline`
 * en vez de un `ring`, siguiendo el criterio ya usado en `input.tsx`/
 * `select.tsx` (borde/outline con color de marca en foco).
 */
const optionVariants = cva(
  'rounded-full border-[1.5px] px-3 py-1.5 font-sans text-[12.5px] font-bold transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
  {
    variants: {
      selected: {
        true: 'border-teal bg-teal text-on-brand',
        false: 'border-border bg-transparent text-ink hover:bg-teal/10',
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
)

/**
 * Hogar TEMPORAL (design decisión D-2): vive dentro de `AccountMenu`
 * únicamente porque #72 (pantalla de configuración) todavía no existe —
 * cuando #72 aterrice, este componente se muda ahí sin cambios internos
 * (un solo componente, un solo call site) y `AccountMenu` vuelve a ser
 * session-only, igual que el Explorer consolidó su propio switcher en
 * `/configuracion` (commit `a868552`). No es un accidente, es deliberado.
 *
 * Escribe ÚNICAMENTE en `useThemeStore`: nunca toca el DOM ni
 * `localStorage` directamente. `ThemeEffects` (PR3b) es el único dueño del
 * DOM (`classList`/`meta[theme-color]`) y el `persist` de zustand
 * (`theme-store.ts`) es el único dueño del storage — separación de
 * responsabilidades ya establecida en el diseño.
 */
export function ThemeSwitcher() {
  const { t } = useTranslation()
  const mode = useThemeStore((state) => state.mode)
  const setMode = useThemeStore((state) => state.setMode)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-sans text-[11px] font-bold text-ink">{t('theme.label')}</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('theme.label')}>
        {THEME_OPTIONS.map(({ mode: optionMode, labelKey }) => (
          <button
            key={optionMode}
            type="button"
            aria-pressed={mode === optionMode}
            className={cn(optionVariants({ selected: mode === optionMode }))}
            onClick={() => setMode(optionMode)}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  )
}
