import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ActionLink } from './action-link'

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('ActionLink', () => {
  it('renders as a navigable link when enabled', () => {
    renderWithRouter(<ActionLink to="/recompensas/1/editar">Editar</ActionLink>)
    const link = screen.getByRole('link', { name: 'Editar' })
    expect(link).toHaveAttribute('href', '/recompensas/1/editar')
  })

  it('renders as a disabled span with aria-describedby when blocked', () => {
    renderWithRouter(
      <ActionLink to="/recompensas/1/editar" disabled describedById="business-write-block">
        Editar
      </ActionLink>
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    const disabledAction = screen.getByText('Editar')
    expect(disabledAction.tagName).toBe('SPAN')
    expect(disabledAction).toHaveAttribute('aria-disabled', 'true')
    expect(disabledAction).toHaveAttribute('aria-describedby', 'business-write-block')
  })

  it('merges a custom className in both the enabled and disabled states', () => {
    const { unmount } = renderWithRouter(
      <ActionLink to="/x" className="custom-link">
        Ir
      </ActionLink>
    )
    expect(screen.getByRole('link').className).toContain('custom-link')
    unmount()

    renderWithRouter(
      <ActionLink to="/x" disabled describedById="reason" className="custom-link">
        Ir
      </ActionLink>
    )
    expect(screen.getByText('Ir').className).toContain('custom-link')
  })
})
