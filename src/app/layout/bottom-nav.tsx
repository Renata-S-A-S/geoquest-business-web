import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { NAV_ITEMS } from './nav-items'
import { cn } from '@/shared/lib/cn'

/**
 * Barra inferior — visible por debajo de 1024px (breakpoint `lg`).
 * Reemplazada por `SidebarNav` en pantallas >=1024px. Mismo criterio que
 * `geoquest-web`: mobile-first es ahora el layout primario del portal, no
 * una excepción para B-04 (ver ADR pendiente, supersede parcial de
 * ADR-047-BF).
 */
export function BottomNav() {
  const { t } = useTranslation()

  return (
    <nav className="flex justify-around border-t border-border bg-cream px-1 pb-1.5 pt-2 lg:hidden">
      {NAV_ITEMS.map(({ id, to, labelKey, icon: Icon }) => (
        <NavLink
          key={id}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-0.5 px-3 font-sans text-[10px]',
              isActive ? 'font-bold text-teal' : 'text-muted'
            )
          }
        >
          <Icon size={20} weight="fill" />
          {t(labelKey)}
        </NavLink>
      ))}
    </nav>
  )
}
