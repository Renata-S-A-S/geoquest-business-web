import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './nav-items'
import { cn } from '@/shared/lib/cn'

/**
 * Sidebar fijo, desktop-first — sin variante bottom-nav para mobile (a
 * diferencia de geoquest-web). El staff de un negocio opera desde mostrador
 * o escritorio; el único flujo con vocación móvil real es B-04 (escanear el
 * QR), que se reevalúa aparte cuando se implemente. Ver "Diferencias
 * deliberadas" en el plan.
 */
export function SidebarNav() {
  return (
    <nav className="flex h-full w-[220px] shrink-0 flex-col gap-1 rounded-md bg-ink p-4">
      <div className="mb-4 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-teal">
          <b className="font-display text-sm text-cream">G</b>
        </div>
        <span className="font-display text-sm font-bold text-cream">Negocios</span>
      </div>
      {NAV_ITEMS.map(({ id, to, icon: Icon }) => (
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
          {id}
        </NavLink>
      ))}
    </nav>
  )
}
