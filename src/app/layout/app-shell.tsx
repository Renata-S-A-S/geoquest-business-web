import { Outlet } from 'react-router-dom'
import { SidebarNav } from './sidebar-nav'
import { BottomNav } from './bottom-nav'
import { MobileTopBar } from './mobile-top-bar'
import { PwaUpdatePrompt } from '@/app/components/pwa-update-prompt'
import { BACKEND_MODE } from '@/shared/lib/backend-capabilities'

/**
 * Shell del portal, mobile-first: `BottomNav` por debajo de 1024px,
 * `SidebarNav` desde ahí — mismo corte (`lg`) que `geoquest-web`. Reemplaza
 * el shell desktop-only original (ver ADR pendiente, supersede parcial de
 * ADR-047-BF).
 *
 * `MobileTopBar` (issue #70) se monta arriba de `<main>`, mismo corte `lg`
 * que `BottomNav` pero inverso: da el encabezado de marca + el trigger de
 * cuenta que en desktop ya vive en el pie del sidebar.
 *
 * ⚠️ `PwaUpdatePrompt` NO se monta con `VITE_USE_MOCKS=true` (issue #86).
 * Ese componente llama `useRegisterSW()`, que registra el service worker de
 * Workbox (`sw.js`) en el scope raíz — el MISMO que ya ocupa el worker de
 * MSW (`mockServiceWorker.js`), arrancado en `main.tsx` antes de montar
 * React. El segundo registro DESPLAZA al primero, MSW deja de interceptar y
 * toda petición se va a `VITE_API_BASE_URL` (que no existe todavía), en
 * silencio, porque MSW corre con `onUnhandledRequest: 'bypass'`.
 *
 * No se reproduce en `npm run dev` (`devOptions: { enabled: false }` en
 * `vite.config.ts`) ni en los tests (jsdom no implementa service workers):
 * solo aparece al ejecutar el bundle compilado.
 *
 * Los dos nunca se necesitan a la vez: con mocks activos no tiene sentido
 * cachear una app que sirve datos falsos, y cuando el backend real exista
 * los mocks se apagan y la PWA queda operativa. El componente y su banner
 * no cambian — solo CUÁNDO se registra el worker.
 */
export function AppShell() {
  return (
    <div className="flex h-dvh flex-col bg-paper lg:flex-row lg:gap-3 lg:p-3">
      <SidebarNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileTopBar />
        <main className="flex-1 overflow-y-auto bg-surface-raised p-4 lg:rounded-md lg:p-6">
          <Outlet />
        </main>
        <BottomNav />
      </div>
      {BACKEND_MODE === 'real' && <PwaUpdatePrompt />}
    </div>
  )
}
