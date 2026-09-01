import { Outlet } from 'react-router-dom'
import { SidebarNav } from './sidebar-nav'
import { BottomNav } from './bottom-nav'
import { PwaUpdatePrompt } from '@/app/components/pwa-update-prompt'

/**
 * Shell del portal, mobile-first: `BottomNav` por debajo de 1024px,
 * `SidebarNav` desde ahí — mismo corte (`lg`) que `geoquest-web`. Reemplaza
 * el shell desktop-only original (ver ADR pendiente, supersede parcial de
 * ADR-047-BF). `PwaUpdatePrompt` vive acá, no en cada feature, para que un
 * update pendiente se vea sin importar qué ruta esté activa.
 */
export function AppShell() {
  return (
    <div className="flex h-dvh flex-col bg-paper lg:flex-row lg:gap-3 lg:p-3">
      <SidebarNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-white p-4 lg:rounded-md lg:p-6">
          <Outlet />
        </main>
        <BottomNav />
      </div>
      <PwaUpdatePrompt />
    </div>
  )
}
