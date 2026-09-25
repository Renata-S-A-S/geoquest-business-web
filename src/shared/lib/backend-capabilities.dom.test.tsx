import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  BACKEND_MODE,
  BackendCapabilitiesProvider,
  resolveBackendCapabilities,
  useBackendCapabilities,
} from './backend-capabilities'

function Probe() {
  const capabilities = useBackendCapabilities()
  return <span data-testid="analytics">{String(capabilities.analytics)}</span>
}

describe('useBackendCapabilities / BackendCapabilitiesProvider', () => {
  it('defaults to the capabilities derived from the real BACKEND_MODE with no provider', () => {
    render(<Probe />)
    expect(screen.getByTestId('analytics')).toHaveTextContent(
      String(resolveBackendCapabilities(BACKEND_MODE).analytics)
    )
  })

  it('lets tests override capabilities through an explicit provider value', () => {
    render(
      <BackendCapabilitiesProvider value={resolveBackendCapabilities('real')}>
        <Probe />
      </BackendCapabilitiesProvider>
    )
    expect(screen.getByTestId('analytics')).toHaveTextContent('false')
  })
})
