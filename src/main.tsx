import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './app/providers'
import { router } from './app/routes'
import { BACKEND_MODE } from '@/shared/lib/backend-capabilities'
import '@/shared/lib/i18n'
import './index.css'

/**
 * Con VITE_USE_MOCKS=true (default — el backend de Business no existe
 * todavía), arranca el worker de MSW ANTES de montar la app, para que
 * ninguna petición temprana se escape sin mockear.
 *
 * Lee `BACKEND_MODE` (costura de `backend-capabilities.ts`, #1547 dominio
 * `backend-capabilities`), no `USE_MOCKS` crudo: ese módulo es el único
 * lector permitido de la env var fuera de la capa de transporte.
 */
async function bootstrap() {
  if (BACKEND_MODE === 'mock') {
    const { worker } = await import('@/shared/mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>
  )
}

void bootstrap()
