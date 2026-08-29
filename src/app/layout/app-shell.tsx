import { Outlet } from 'react-router-dom'
import { SidebarNav } from './sidebar-nav'

/**
 * Shell del portal: sidebar fijo a la izquierda, contenido routeado a la
 * derecha. Desktop-first, sin colapso a bottom-nav — ver "Diferencias
 * deliberadas" en el plan.
 */
export function AppShell() {
  return (
    <div className="flex h-dvh gap-3 bg-paper p-3">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto rounded-md bg-white p-6">
        <Outlet />
      </main>
    </div>
  )
}
