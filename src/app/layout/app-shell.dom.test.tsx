import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppShell } from './app-shell'

function renderShell(initialPath = '/lugares') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/lugares" element={<div>contenido de lugares</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
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
    expect(screen.getAllByRole('button', { name: 'Abrir menú de cuenta' })).toHaveLength(2)
    expect(screen.getAllByText('Lugares')).toHaveLength(2)
  })
})
