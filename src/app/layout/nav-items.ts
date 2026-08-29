import { Buildings, MapPin, Gift, QrCode, ChartBar } from '@phosphor-icons/react'

/**
 * Secciones del portal, una por cada flujo B-0X de Confluence
 * (🏢 Flujos del Negocio). Ninguna tiene contenido real todavía — cada una
 * es un `RoutePlaceholder` hasta que su flujo se implemente en un slice
 * futuro (ver plan-geoquest-business-web.md, "Fuera de alcance").
 *
 * `id` es la clave estable no traducida para lógica estructural; `labelKey`
 * se resuelve vía i18next `t()` (WU6). Nunca programar lógica contra el
 * label renderizado — mismo criterio que geoquest-web.
 */
export const NAV_ITEMS = [
  { id: 'onboarding', to: '/negocio', labelKey: 'nav.business', icon: Buildings },
  { id: 'places', to: '/lugares', labelKey: 'nav.places', icon: MapPin },
  { id: 'rewards', to: '/recompensas', labelKey: 'nav.rewards', icon: Gift },
  { id: 'redemptions', to: '/canjes', labelKey: 'nav.redemptions', icon: QrCode },
  { id: 'analytics', to: '/analytics', labelKey: 'nav.analytics', icon: ChartBar },
] as const

export type NavItemId = (typeof NAV_ITEMS)[number]['id']
