import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './app/providers'
import { router } from './app/routes'
import { USE_MOCKS } from '@/shared/lib/env'
import '@/shared/lib/i18n'
import './index.css'

/**
 * Con VITE_USE_MOCKS=true (default — el backend de Business no existe
 * todavía), arranca el worker de MSW ANTES de montar la app, para que
 * ninguna petición temprana se escape sin mockear.
 */
async function bootstrap() {
  if (USE_MOCKS) {
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
