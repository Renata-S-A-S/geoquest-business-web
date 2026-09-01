import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { NAV_ITEMS } from './nav-items'
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
 */
export function SidebarNav() {
  const { t } = useTranslation()

  return (
    <nav className="hidden h-full w-[220px] shrink-0 flex-col gap-1 rounded-md bg-ink p-4 lg:flex">
      <div className="mb-4 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-teal">
          <b className="font-display text-sm text-cream">G</b>
        </div>
        <span className="font-display text-sm font-bold text-cream">Negocios</span>
      </div>
      {NAV_ITEMS.map(({ id, to, labelKey, icon: Icon }) => (
        <NavLink
          key={id}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-sm px-3 py-2 font-sans text-sm text-cream/70 transition-colors',
              isActive ? 'bg-teal/15 font-bold text-teal' : 'hover:bg-white/5'
            )
          }
        >
          <Icon size={18} weight="fill" />
          {t(labelKey)}
        </NavLink>
      ))}
    </nav>
  )
}
