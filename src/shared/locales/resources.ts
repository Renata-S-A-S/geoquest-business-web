import esCommon from './es/common.json'
import enCommon from './en/common.json'
import esAuth from './es/auth.json'
import enAuth from './en/auth.json'
import esOnboarding from './es/onboarding.json'
import enOnboarding from './en/onboarding.json'

/**
 * Bundle de recursos + registro de namespaces, compartido por el init real
 * (`shared/lib/i18n.ts`) y el init de test (`test/i18n.ts`) — mismo patrón
 * que geoquest-web (design D-B): cada feature agrega un import pair acá y
 * una entrada en `ns`.
 */
export const resources = {
  es: { common: esCommon, auth: esAuth, onboarding: esOnboarding },
  en: { common: enCommon, auth: enAuth, onboarding: enOnboarding },
} as const

export const ns = ['common', 'auth', 'onboarding'] as const
export const defaultNS = 'common' as const
