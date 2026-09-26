import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Guarda del conflicto entre los dos service workers (issue #86).
 *
 * `PwaUpdatePrompt` llama `useRegisterSW()`, que registra el worker de
 * Workbox (`sw.js`) en el scope raíz — el MISMO que ocupa el de MSW
 * (`mockServiceWorker.js`), arrancado en `main.tsx` antes de montar React.
 * El segundo registro desplaza al primero: MSW deja de interceptar y toda
 * petición se va a `VITE_API_BASE_URL`, en silencio, porque MSW corre con
 * `onUnhandledRequest: 'bypass'`.
 *
 * Ese bug NO es reproducible acá: jsdom no implementa service workers, y
 * `npm run dev` tampoco lo muestra (`devOptions: { enabled: false }` en
 * `vite.config.ts`). Solo aparece ejecutando el bundle compilado — por eso
 * pasó desapercibido hasta que alguien probó el build a mano.
 *
 * Lo que este archivo sí garantiza es la CONDICIÓN que lo evita: que
 * `AppShell` no monte el prompt mientras los mocks estén activos. Sin esta
 * guarda, la regresión volvería a detectarse solo compilando y usando la
 * app.
 */

// `BACKEND_MODE` se expone como getter para poder variarlo por caso:
// `AppShell` lo lee al renderizar (real-backend-readiness PR1 lo migró de
// `USE_MOCKS` crudo a esta costura), así que el getter alcanza y evita
// re-importar el módulo entre tests.
let backendMode: 'mock' | 'real' = 'mock'

vi.mock('@/shared/lib/backend-capabilities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/backend-capabilities')>()
  return {
    ...actual,
    get BACKEND_MODE() {
      return backendMode
    },
  }
})

// `needRefresh: true` a propósito: si el prompt llegara a montarse, el
// banner estaría en el DOM. Así la aserción distingue "no se montó" de "se
// montó pero no había update pendiente".
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [true, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: async () => {},
  }),
}))

const { AppShell } = await import('./app-shell')

// `QueryClientProvider` es nuevo acá desde PR8a: `BusinessStatusBanner`
// (adentro de `AppShell`) lee `useMyBusiness()`.
function renderShell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/lugares']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/lugares" element={<div>contenido</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AppShell — conflicto de service workers (#86)', () => {
  beforeEach(() => {
    backendMode = 'mock'
  })

  it('NO monta el prompt de PWA cuando los mocks están activos', () => {
    renderShell()

    expect(screen.queryByText('Hay una versión nueva disponible')).not.toBeInTheDocument()
  })

  it('SÍ monta el prompt de PWA cuando los mocks están apagados', () => {
    // El día que exista el backend real los mocks se apagan y la PWA debe
    // seguir funcionando: esta mitad evita que el arreglo de #86 la deje
    // desactivada para siempre.
    backendMode = 'real'
    renderShell()

    expect(screen.getByText('Hay una versión nueva disponible')).toBeInTheDocument()
  })
})
