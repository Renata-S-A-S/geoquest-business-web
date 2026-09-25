import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import i18next from '@/test/i18n'
import { SidebarNav } from './sidebar-nav'

describe('SidebarNav', () => {
  it('renders all 4 sections translated to Spanish (default)', () => {
    render(
      <MemoryRouter>
        <SidebarNav />
      </MemoryRouter>
    )
    expect(screen.getByText('Lugares')).toBeInTheDocument()
    expect(screen.getByText('Recompensas')).toBeInTheDocument()
    expect(screen.getByText('Validar canje')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
  })

  it('re-renders in English when the active language changes', async () => {
    render(
      <MemoryRouter>
        <SidebarNav />
      </MemoryRouter>
    )
    await i18next.changeLanguage('en')
    expect(await screen.findByText('Places')).toBeInTheDocument()
    expect(screen.getByText('Rewards')).toBeInTheDocument()
  })

  it('highlights the link matching the current route', () => {
    render(
      <MemoryRouter initialEntries={['/lugares']}>
        <SidebarNav />
      </MemoryRouter>
    )
    const activeLink = screen.getByText('Lugares').closest('a')
    expect(activeLink).toHaveClass('text-teal')
  })

  it('renders the account trigger in its footer, linking straight to settings', () => {
    render(
      <MemoryRouter>
        <SidebarNav />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: 'Abrir menú de cuenta' })).toHaveAttribute(
      'href',
      '/configuracion'
    )
  })
})
