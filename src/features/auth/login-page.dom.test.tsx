import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { useToastStore } from '@/shared/stores/toast-store'
import { useBusinessSessionStore } from '@/shared/stores/business-session-store'
import { SEED_BUSINESS_STAFF } from '@/shared/mocks/seed'
import { MOCK_BUSINESS_STAFF_PASSWORD } from '@/shared/mocks/business-staff-credentials.mock'
import { LoginPage } from './login-page'

const loggedOutState = {
  isAuthenticated: false,
  accessToken: null,
  accessTokenExpiresAtUtc: null,
  refreshToken: null,
  refreshTokenExpiresAtUtc: null,
}

function renderLoginPage() {
  // Own `QueryClient` with `retry: false` — mismo motivo que
  // `register-form.dom.test.tsx`: un caso que fuerza un error colgaría
  // `findBy*` contra el default de v5 (retry: 3).
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Marcador propio, no el `<Navigate to="/analytics" />` real —
              acopla el test a la pantalla de login, no al resto del router. */}
          <Route path="/" element={<p>Home marker</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function fillValidCredentials() {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), {
    target: { value: SEED_BUSINESS_STAFF.email },
  })
  fireEvent.change(screen.getByLabelText('Contraseña'), {
    target: { value: MOCK_BUSINESS_STAFF_PASSWORD },
  })
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
  useBusinessSessionStore.setState(loggedOutState)
})

afterEach(() => {
  useToastStore.setState({ toasts: [] })
  useBusinessSessionStore.setState(loggedOutState)
})

describe('LoginPage', () => {
  it('valid credentials store tokens and redirect to /', async () => {
    renderLoginPage()
    fillValidCredentials()

    submit()

    expect(await screen.findByText('Home marker')).toBeInTheDocument()
    expect(useBusinessSessionStore.getState().isAuthenticated).toBe(true)
  })

  it('a 401 with a `detail` shows that message via toast, no navigation, session stays logged out', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/login`, () =>
        HttpResponse.json(
          { title: 'InvalidCredentials', detail: 'Correo o contraseña incorrectos.' },
          { status: 401 }
        )
      )
    )
    renderLoginPage()
    fillValidCredentials()

    submit()

    await screen.findByRole('button', { name: 'Iniciar sesión' })
    expect(useToastStore.getState().toasts).toContainEqual(
      expect.objectContaining({ variant: 'error', message: 'Correo o contraseña incorrectos.' })
    )
    expect(screen.queryByText('Home marker')).not.toBeInTheDocument()
    expect(useBusinessSessionStore.getState().isAuthenticated).toBe(false)
  })

  it('a 401 without a parseable body falls back to the invalid-credentials message', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/login`, () => new HttpResponse(null, { status: 401 }))
    )
    renderLoginPage()
    fillValidCredentials()

    submit()

    await screen.findByRole('button', { name: 'Iniciar sesión' })
    expect(useToastStore.getState().toasts).toContainEqual(
      expect.objectContaining({ variant: 'error', message: 'Correo o contraseña incorrectos.' })
    )
  })

  it('a network error (no response) shows the generic connectivity message', async () => {
    server.use(http.post(`${API_BASE_URL}/auth/login`, () => HttpResponse.error()))
    renderLoginPage()
    fillValidCredentials()

    submit()

    await screen.findByRole('button', { name: 'Iniciar sesión' })
    expect(useToastStore.getState().toasts).toContainEqual(
      expect.objectContaining({
        variant: 'error',
        message: 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.',
      })
    )
  })

  it('empty submit shows two required-field alerts and sends no request', async () => {
    let requestSent = false
    server.use(
      http.post(`${API_BASE_URL}/auth/login`, () => {
        requestSent = true
        return HttpResponse.json({}, { status: 200 })
      })
    )
    renderLoginPage()

    submit()

    const alerts = await screen.findAllByRole('alert')
    expect(alerts).toHaveLength(2)
    for (const alert of alerts) {
      expect(alert).toHaveTextContent('Este campo es obligatorio')
    }
    expect(requestSent).toBe(false)
  })

  it('a malformed email shows the email-format error, distinct from "required"', async () => {
    renderLoginPage()
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'not-an-email' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: MOCK_BUSINESS_STAFF_PASSWORD },
    })

    submit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Ingresá un correo electrónico válido')
  })

  it('an already-authenticated visitor is redirected to / without the form ever rendering', () => {
    useBusinessSessionStore.getState().login({
      accessToken: 'access-1',
      accessTokenExpiresAtUtc: '2026-09-02T00:00:00Z',
      refreshToken: 'refresh-1',
      refreshTokenExpiresAtUtc: '2026-09-09T00:00:00Z',
    })

    renderLoginPage()

    expect(screen.getByText('Home marker')).toBeInTheDocument()
    expect(screen.queryByLabelText('Correo electrónico')).not.toBeInTheDocument()
  })
})
