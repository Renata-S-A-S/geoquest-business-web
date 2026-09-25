import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Banner } from './banner'

describe('Banner', () => {
  it('renders as a polite live region for the warning variant', () => {
    render(<Banner variant="warning">Tu negocio está en pausa</Banner>)
    const banner = screen.getByRole('status')
    expect(banner).toHaveAttribute('aria-live', 'polite')
    expect(banner).toHaveTextContent('Tu negocio está en pausa')
  })

  it('renders as a polite live region for the error variant', () => {
    render(<Banner variant="error">Tu negocio está suspendido</Banner>)
    const banner = screen.getByRole('status')
    expect(banner).toHaveAttribute('aria-live', 'polite')
  })

  it('renders as a polite live region for the info variant', () => {
    render(<Banner variant="info">Sumale una imagen a tu recompensa</Banner>)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('applies a different background token per variant', () => {
    const { unmount: unmountWarning } = render(<Banner variant="warning">A</Banner>)
    expect(screen.getByRole('status').className).toContain('bg-surface-warning')
    unmountWarning()

    const { unmount: unmountError } = render(<Banner variant="error">B</Banner>)
    expect(screen.getByRole('status').className).toContain('bg-surface-alert')
    unmountError()

    render(<Banner variant="info">C</Banner>)
    expect(screen.getByRole('status').className).toContain('bg-surface-teal')
  })

  it('forwards an id so write controls can point aria-describedby at it', () => {
    render(
      <Banner id="business-write-block" variant="warning">
        Tu negocio está en pausa
      </Banner>
    )
    expect(screen.getByRole('status')).toHaveAttribute('id', 'business-write-block')
  })

  it('merges a custom className without dropping the base classes', () => {
    render(
      <Banner variant="warning" className="mt-2">
        Tu negocio está en pausa
      </Banner>
    )
    const banner = screen.getByRole('status')
    expect(banner.className).toContain('mt-2')
    expect(banner.className).toContain('bg-surface-warning')
  })
})
