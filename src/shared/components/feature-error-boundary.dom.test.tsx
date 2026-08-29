import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FeatureErrorBoundary } from './feature-error-boundary'

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom')
  return <div>contenido ok</div>
}

describe('FeatureErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <FeatureErrorBoundary featureName="Recompensas">
        <Bomb shouldThrow={false} />
      </FeatureErrorBoundary>
    )
    expect(screen.getByText('contenido ok')).toBeInTheDocument()
  })

  it('catches a render error and shows the fallback with the feature name', () => {
    render(
      <FeatureErrorBoundary featureName="Recompensas">
        <Bomb shouldThrow={true} />
      </FeatureErrorBoundary>
    )
    expect(screen.getByText(/Recompensas/)).toBeInTheDocument()
    expect(screen.queryByText('contenido ok')).not.toBeInTheDocument()
  })

  it('recovers when Reintentar is clicked and children no longer throw', () => {
    function Wrapper() {
      const [shouldThrow, setShouldThrow] = useState(true)
      return (
        <div>
          {/* Vive FUERA del boundary a propósito: mientras el boundary
              muestra su fallback, no renderiza `children` en absoluto, así
              que nada adentro es clickeable. */}
          <button onClick={() => setShouldThrow(false)}>fix from outside</button>
          <FeatureErrorBoundary featureName="Recompensas">
            <Bomb shouldThrow={shouldThrow} />
          </FeatureErrorBoundary>
        </div>
      )
    }
    render(<Wrapper />)
    expect(screen.getByText(/Recompensas/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('fix from outside'))
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(screen.getByText('contenido ok')).toBeInTheDocument()
  })
})
