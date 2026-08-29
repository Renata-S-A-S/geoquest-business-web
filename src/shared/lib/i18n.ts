import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { resources, ns, defaultNS } from '@/shared/locales/resources'

/**
 * Singleton de i18next de toda la app. Recursos son imports JSON estáticos
 * (mismo criterio D-A que geoquest-web) — `init()` resuelve sincrónico, sin
 * depender de un backend HTTP de traducciones.
 *
 * Módulo de efecto: se importa una sola vez desde `main.tsx`. Nunca
 * importar este desde un test — el entorno de test tiene su propio init
 * sincrónico en `src/test/i18n.ts` (mismo motivo D-C que geoquest-web:
 * importar los dos inicializaría el singleton dos veces).
 */
void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    ns,
    defaultNS,
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    nonExplicitSupportedLngs: true,
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    interpolation: { escapeValue: false }, // React ya escapa
    returnNull: false,
  })

export default i18next
