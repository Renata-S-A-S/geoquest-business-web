import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { setMockBusiness } from '@/test/mock-business'
import { AppShell } from './app-shell'

// `QueryClientProvider` es nuevo acá desde PR8a: `BusinessStatusBanner`
// (adentro de `AppShell`) lee `useMyBusiness()`.
function renderShell(initialPath = '/lugares') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/lugares" element={<div>contenido de lugares</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AppShell', () => {
  it('renderiza el sidebar, la bottom nav y el contenido routeado', () => {
    renderShell()

    // Cada NAV_ITEM aparece dos veces: una en SidebarNav (desktop) y otra en
    // BottomNav (mobile) — ambos siempre están en el DOM, el corte lg: es
    // puramente CSS y jsdom no lo evalúa.
    expect(screen.getAllByText('Lugares')).toHaveLength(2)
    expect(screen.getByText('contenido de lugares')).toBeInTheDocument()
  })

  it('no muestra el aviso de actualización cuando no hay un service worker esperando', () => {
    renderShell()
    expect(screen.queryByText('Hay una versión nueva disponible')).not.toBeInTheDocument()
  })

  it('monta ambos triggers de cuenta (sidebar y MobileTopBar) sin tocar BottomNav', () => {
    renderShell()

    // Uno en el pie de SidebarNav (desktop) y otro en MobileTopBar (mobile)
    // — ambos siempre en el DOM, el corte lg: es puramente CSS (issue #70,
    // decisión de diseño #1: BottomNav no gana un 6to ítem).
    //
    // Son `link` y no `button` desde que el avatar navega directo a
    // `/configuracion` en vez de abrir un menú: el rol tiene que reflejar
    // que la acción es navegar, no desplegar.
    const triggers = screen.getAllByRole('link', { name: 'Abrir menú de cuenta' })
    expect(triggers).toHaveLength(2)
    expect(triggers[0]).toHaveAttribute('href', '/configuracion')
    expect(screen.getAllByText('Lugares')).toHaveLength(2)
  })

  it('no muestra el banner de negocio cuando el negocio está Active', async () => {
    renderShell()
    expect(await screen.findByText('contenido de lugares')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('muestra el banner de negocio en pausa arriba del contenido, en cualquier ruta', async () => {
    setMockBusiness('Paused')
    renderShell()

    expect(await screen.findByRole('status')).toHaveTextContent('Tu negocio está en pausa')
    expect(screen.getByText('contenido de lugares')).toBeInTheDocument()
  })
})
