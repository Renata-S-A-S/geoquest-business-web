import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge, type StatusBadgeVariant } from './status-badge'

/**
 * Mapeo de referencia — no es el mapa oficial de ninguna feature (eso lo
 * define cada consumidora: #29 listado de lugares, #36 listado de
 * recompensas, etc.), solo cubre los 10 valores citados en el criterio de
 * aceptación de #19, tomados de Business/Place/Reward/UserReward
 * (`src/shared/schemas/*.ts`).
 */
const referenceVariantMap: Record<string, StatusBadgeVariant> = {
  Pending: 'neutral',
  Draft: 'neutral',
  Reserved: 'neutral',
  Active: 'success',
  Earned: 'success',
  Redeemed: 'success',
  Paused: 'warning',
  Suspended: 'error',
  Exhausted: 'error',
  Expired: 'error',
}

describe('StatusBadge', () => {
  it.each(Object.keys(referenceVariantMap))('renders the raw status text for "%s"', (status) => {
    render(<StatusBadge status={status} variantMap={referenceVariantMap} />)
    expect(screen.getByRole('status')).toHaveTextContent(status)
  })

  it('falls back to the neutral variant when status has no entry in variantMap', () => {
    render(<StatusBadge status="Unknown" variantMap={{}} />)
    const badge = screen.getByRole('status')
    expect(badge).toHaveTextContent('Unknown')
    expect(badge.className).toContain('bg-paper')
  })

  it('renders each variant with its own background token', () => {
    const variants: StatusBadgeVariant[] = ['neutral', 'success', 'warning', 'error']
    const expectedBg: Record<StatusBadgeVariant, string> = {
      neutral: 'bg-paper',
      success: 'bg-surface-mint',
      warning: 'bg-surface-warning',
      error: 'bg-surface-alert',
    }
    for (const variant of variants) {
      const { unmount } = render(<StatusBadge status="X" variantMap={{ X: variant }} />)
      expect(screen.getByRole('status').className).toContain(expectedBg[variant])
      unmount()
    }
  })

  it('prefers `label` over the raw status when both are given', () => {
    render(<StatusBadge status="Active" label="Activo" variantMap={{ Active: 'success' }} />)
    expect(screen.getByRole('status')).toHaveTextContent('Activo')
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
  })

  it('merges a custom className without dropping the base classes', () => {
    render(<StatusBadge status="Active" variantMap={{ Active: 'success' }} className="ml-2" />)
    const badge = screen.getByRole('status')
    expect(badge.className).toContain('ml-2')
    expect(badge.className).toContain('bg-surface-mint')
  })
})
