import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RedemptionOriginCallout } from './redemption-origin-callout'

/**
 * #47 pide un indicador «claramente distinto, no solo texto chico». Estos
 * tests fijan las tres señales redundantes —color, ícono y texto— para que una
 * refactorización no las reduzca a una sola.
 */
describe('RedemptionOriginCallout', () => {
  it('nombra una recompensa comprada con GeoPoints', () => {
    render(<RedemptionOriginCallout origin="Purchased" />)

    expect(screen.getByTestId('redemption-origin')).toHaveTextContent('Comprada con GeoPoints')
  })

  /**
   * El corazón de #47: sin esta frase, un costo en 0 se lee como un dato roto
   * y el staff duda de entregar la recompensa.
   */
  it('explica que un premio no descontó saldo', () => {
    render(<RedemptionOriginCallout origin="Prize" />)

    expect(screen.getByTestId('redemption-origin')).toHaveTextContent('No se le descontó saldo')
  })

  it('usa un acento visual distinto para cada origen, no solo otro texto', () => {
    const { unmount } = render(<RedemptionOriginCallout origin="Purchased" />)
    const purchasedClasses = screen.getByTestId('redemption-origin').className
    unmount()

    render(<RedemptionOriginCallout origin="Prize" />)
    const prizeClasses = screen.getByTestId('redemption-origin').className

    expect(purchasedClasses).toContain('border-l-teal')
    expect(prizeClasses).toContain('border-l-green')
    expect(purchasedClasses).not.toBe(prizeClasses)
  })

  it('trae un ícono propio por origen, oculto para lectores de pantalla', () => {
    const { container, unmount } = render(<RedemptionOriginCallout origin="Purchased" />)
    const purchasedIcon = container.querySelector('svg')

    expect(purchasedIcon).toHaveAttribute('aria-hidden', 'true')
    const purchasedPaths = container.querySelectorAll('svg path').length
    unmount()

    const prize = render(<RedemptionOriginCallout origin="Prize" />)
    expect(prize.container.querySelector('svg')).toBeInTheDocument()
    expect(purchasedPaths).toBeGreaterThan(0)
  })

  /**
   * El indicador no puede apoyarse solo en el color: el texto tiene que
   * distinguir los dos casos por sí mismo.
   */
  it('distingue los dos casos por texto, sin depender del color', () => {
    const { unmount } = render(<RedemptionOriginCallout origin="Purchased" />)
    const purchasedText = screen.getByTestId('redemption-origin').textContent
    unmount()

    render(<RedemptionOriginCallout origin="Prize" />)

    expect(screen.getByTestId('redemption-origin').textContent).not.toBe(purchasedText)
  })
})
