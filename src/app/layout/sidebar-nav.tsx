import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { NAV_ITEMS } from './nav-items'
import { AccountMenu } from './account-menu'
import { cn } from '@/shared/lib/cn'

/**
 * Sidebar con labels — visible desde 1024px (breakpoint `lg`), reemplazada
 * por `BottomNav` por debajo de ese corte (mobile-first, decisión del
 * founder que reemplaza el desktop-first original — ver ADR pendiente que
 * supersede la parte de navegación de ADR-047-BF).
 *
 * A diferencia del rail angosto de geoquest-web, acá se mantiene con
 * labels también en desktop: es un panel de gestión con más secciones y
 * más densidad de datos que el mapa de exploración, no una app de consumo.
 *
 * `justify-between` + pie con `AccountMenu` (issue #70, decisión de diseño
 * #1) mirror el rail del Explorer (`rail-nav.tsx`), que ya resuelve el
 * mismo problema: el logout necesita estar en todo momento alcanzable
 * desde el sidebar sin competir por espacio con la lista de secciones.
 */
export function SidebarNav() {
  const { t } = useTranslation()

  return (
    <nav className="hidden h-full w-[220px] shrink-0 flex-col justify-between rounded-md bg-surface-inverse p-4 lg:flex">
      <div className="flex flex-col gap-1">
        <div className="mb-4 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-teal">
            <b className="font-display text-sm text-on-inverse">G</b>
          </div>
          <span className="font-display text-sm font-bold text-on-inverse">Negocios</span>
        </div>
        {NAV_ITEMS.map(({ id, to, labelKey, icon: Icon }) => (
          <NavLink
            key={id}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-sm px-3 py-2 font-sans text-sm text-on-inverse/70 transition-colors',
                isActive ? 'bg-teal/15 font-bold text-teal' : 'hover:bg-on-inverse/5'
              )
            }
          >
            <Icon size={18} weight="fill" />
            {t(labelKey)}
          </NavLink>
        ))}
      </div>
      <div className="flex items-center gap-2 px-2 pt-4">
        <AccountMenu />
        <span className="font-sans text-sm text-on-inverse/70">{t('account.title')}</span>
      </div>
    </nav>
  )
}
