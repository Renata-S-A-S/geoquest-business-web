import esCommon from './es/common.json'
import enCommon from './en/common.json'
import esAuth from './es/auth.json'
import enAuth from './en/auth.json'
import esOnboarding from './es/onboarding.json'
import enOnboarding from './en/onboarding.json'
import esUploads from './es/uploads.json'
import enUploads from './en/uploads.json'
import esBusiness from './es/business.json'
import enBusiness from './en/business.json'

/**
 * Bundle de recursos + registro de namespaces, compartido por el init real
 * (`shared/lib/i18n.ts`) y el init de test (`test/i18n.ts`) — mismo patrón
 * que geoquest-web (design D-B): cada feature agrega un import pair acá y
 * una entrada en `ns`.
 */
export const resources = {
  es: {
    common: esCommon,
    auth: esAuth,
    onboarding: esOnboarding,
    uploads: esUploads,
    business: esBusiness,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    onboarding: enOnboarding,
    uploads: enUploads,
    business: enBusiness,
  },
} as const

export const ns = ['common', 'auth', 'onboarding', 'uploads', 'business'] as const
export const defaultNS = 'common' as const
