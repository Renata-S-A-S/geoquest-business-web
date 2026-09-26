import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { setMockBusiness } from '@/test/mock-business'
import { API_BASE_URL } from '@/shared/lib/env'
import { useBusinessSessionStore } from '@/shared/stores/business-session-store'
import { createMockJwt } from '@/shared/mocks/mock-jwt'
import { SEED_BUSINESS_STAFF, SEED_BUSINESS_STAFF_USERNAME } from '@/shared/mocks/seed'
import {
  BackendCapabilitiesProvider,
  resolveBackendCapabilities,
  type BackendCapabilities,
} from '@/shared/lib/backend-capabilities'
import { RegistrationRoute } from './registration-route'

/** Misma semilla que `business-gateway.dom.test.tsx` — `useMyBusiness()` necesita una sesión real. */
function signIn() {
  useBusinessSessionStore.setState({
    isAuthenticated: true,
    accessToken: createMockJwt({
      sub: SEED_BUSINESS_STAFF.id,
      email: SEED_BUSINESS_STAFF.email,
      username: SEED_BUSINESS_STAFF_USERNAME,
    }),
    accessTokenExpiresAtUtc: null,
    refreshToken: 'a-refresh',
    refreshTokenExpiresAtUtc: null,
  })
}

function renderRegistrationRoute(capabilities?: BackendCapabilities) {
  signIn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <BackendCapabilitiesProvider value={capabilities}>
        <MemoryRouter initialEntries={['/registro']}>
          <Routes>
            <Route path="/registro" element={<RegistrationRoute />} />
            <Route path="/" element={<p>Home marker</p>} />
          </Routes>
        </MemoryRouter>
      </BackendCapabilitiesProvider>
    </QueryClientProvider>
  )
}

describe('RegistrationRoute', () => {
  it('redirige a / cuando la capability registration está apagada', async () => {
    renderRegistrationRoute(resolveBackendCapabilities('real'))

    expect(await screen.findByText('Home marker')).toBeInTheDocument()
  })

  it('muestra un estado de carga mientras useMyBusiness está pendiente', () => {
    server.use(http.get(`${API_BASE_URL}/business/mine`, () => new Promise(() => {})))
    renderRegistrationRoute(resolveBackendCapabilities('mock'))

    expect(screen.getByRole('status')).toHaveTextContent('Cargando los datos de tu negocio…')
  })

  it('redirige a / cuando el explorador ya tiene un negocio propio', async () => {
    renderRegistrationRoute(resolveBackendCapabilities('mock'))

    expect(await screen.findByText('Home marker')).toBeInTheDocument()
  })

  it('renderiza el formulario de registro sin negocio propio y con la capability encendida', async () => {
    setMockBusiness('none')
    renderRegistrationRoute(resolveBackendCapabilities('mock'))

    expect(await screen.findByRole('heading', { name: 'Registra tu negocio' })).toBeInTheDocument()
  })
})
