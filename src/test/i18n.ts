import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources, ns, defaultNS } from '@/shared/locales/resources'

/**
 * Init de i18n SOLO para tests — sin LanguageDetector: leería
 * `navigator.language` del runner antes de que `lng: 'es'` surta efecto,
 * exactamente la no-determinismo que este init existe para evitar (mismo
 * criterio D-C que geoquest-web).
 */
void i18next.use(initReactI18next).init({
  resources,
  ns,
  defaultNS,
  lng: 'es',
  fallbackLng: 'es',
  supportedLngs: ['es', 'en'],
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18next
