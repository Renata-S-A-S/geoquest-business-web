import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import i18next from '@/test/i18n'
import { BottomNav } from './bottom-nav'

describe('BottomNav', () => {
  it('renders all 5 sections translated to Spanish (default)', () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    expect(screen.getByText('Negocio')).toBeInTheDocument()
    expect(screen.getByText('Lugares')).toBeInTheDocument()
    expect(screen.getByText('Recompensas')).toBeInTheDocument()
    expect(screen.getByText('Validar canje')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
  })

  it('re-renders in English when the active language changes', async () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    await i18next.changeLanguage('en')
    expect(await screen.findByText('Business')).toBeInTheDocument()
    expect(screen.getByText('Places')).toBeInTheDocument()
  })

  it('highlights the link matching the current route', () => {
    render(
      <MemoryRouter initialEntries={['/lugares']}>
        <BottomNav />
      </MemoryRouter>
    )
    const activeLink = screen.getByText('Lugares').closest('a')
    expect(activeLink).toHaveClass('text-teal')
  })
})
