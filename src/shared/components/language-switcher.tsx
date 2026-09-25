import { useTranslation } from 'react-i18next'
import { cva } from 'class-variance-authority'
import { cn } from '@/shared/lib/cn'

const optionVariants = cva(
  'rounded-xs border px-3 py-1.5 font-sans text-xs font-bold transition-colors',
  {
    variants: {
      selected: {
        true: 'border-teal bg-teal text-on-brand',
        false: 'border-border bg-surface-raised text-ink hover:border-teal',
      },
    },
    defaultVariants: { selected: false },
  }
)

/**
 * Los dos idiomas que la app realmente tiene. No se derivan de
 * `i18n.languages` a propósito: eso incluye el `fallbackLng` y cualquier
 * variante regional que el detector haya resuelto, así que la lista
 * terminaría ofreciendo opciones que no son opciones.
 *
 * `supportedLngs` en `i18n.ts` es `['es', 'en']` — si crece, esta lista
 * crece con él y el test de paridad de `resources.test.ts` obliga a que el
 * namespace exista en el idioma nuevo.
 */
const LANGUAGE_OPTIONS = [
  { code: 'es', labelKey: 'language.es' },
  { code: 'en', labelKey: 'language.en' },
] as const

/**
 * Selector de idioma. Gemelo de `ThemeSwitcher` en forma y en criterio.
 *
 * ⚠️ **Llena un hueco real, no agrega una función cosmética.** La app tiene
 * traducción completa a inglés y español, con un test que exige paridad de
 * claves entre los dos (`resources.test.ts`), pero hasta ahora **no había
 * ninguna forma de que el usuario cambiara el idioma**: se resolvía solo
 * desde `navigator.language`. Un negocio cuyo navegador estuviera en inglés
 * no tenía manera de pasar el portal a español.
 *
 * `changeLanguage` persiste solo: `i18n.ts` configura
 * `caches: ['localStorage']` con `lookupLocalStorage: 'i18nextLng'`, así que
 * la elección sobrevive a la recarga sin que este componente guarde nada.
 *
 * `aria-pressed` y no `aria-selected`: son botones de alternancia, no
 * opciones de un listbox — mismo criterio que `ThemeSwitcher`.
 */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-sans text-[11px] font-bold text-ink">{t('language.label')}</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('language.label')}>
        {LANGUAGE_OPTIONS.map(({ code, labelKey }) => (
          <button
            key={code}
            type="button"
            aria-pressed={i18n.resolvedLanguage === code}
            className={cn(optionVariants({ selected: i18n.resolvedLanguage === code }))}
            onClick={() => void i18n.changeLanguage(code)}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  )
}
