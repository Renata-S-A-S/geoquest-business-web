import { AccountMenu } from './account-menu'

/**
 * Barra superior compacta — visible por debajo de 1024px (breakpoint `lg`),
 * donde `SidebarNav` no se renderiza (issue #70, decisión de diseño #1: un
 * 6to ítem en `BottomNav` quedó rechazado, ver diseño). Le da al layout
 * mobile el encabezado de marca que hoy solo tiene el sidebar
 * (`sidebar-nav.tsx`) y hace alcanzable "Cerrar sesión" en cualquier
 * viewport sin competir con la zona del pulgar que ocupa la navegación.
 */
export function MobileTopBar() {
  return (
    <header className="flex items-center justify-between gap-2 bg-ink px-4 py-3 lg:hidden">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-teal">
          <b className="font-display text-sm text-cream">G</b>
        </div>
        <span className="font-display text-sm font-bold text-cream">Negocios</span>
      </div>
      <AccountMenu />
    </header>
  )
}
