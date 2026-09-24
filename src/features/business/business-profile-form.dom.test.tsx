import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { useToastStore } from '@/shared/stores/toast-store'
import { SEED_BUSINESS } from '@/shared/mocks/seed'
import { BusinessProfileForm } from './business-profile-form'

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/negocio/editar']}>
        <Routes>
          <Route
            path="/negocio/editar"
            element={<BusinessProfileForm business={SEED_BUSINESS} />}
          />
          {/* Marcador propio de "volvió a /negocio" — no acopla el test al
              resto del router real, mismo criterio que login-page.dom.test.tsx. */}
          <Route path="/negocio" element={<p>Negocio marker</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

afterEach(() => {
  useToastStore.setState({ toasts: [] })
})

describe('BusinessProfileForm', () => {
  it('prefills exactly the three editable fields from the server-read business, nothing else', () => {
    renderForm()

    expect(screen.getByLabelText('Nombre público')).toHaveValue(SEED_BUSINESS.displayName)
    expect(screen.getByLabelText('Correo de contacto')).toHaveValue(SEED_BUSINESS.email)
    expect(screen.getByRole('combobox')).toHaveTextContent('Gastronomía')

    // Solo lectura: ninguno de los campos legales/de plataforma aparece en
    // el formulario (issue #72 — el 409 de "campo de solo lectura" solo
    // tiene sentido si el form nunca los incluye, ni siquiera deshabilitados).
    expect(screen.queryByLabelText('Nombre legal')).not.toBeInTheDocument()
    expect(screen.queryByText(SEED_BUSINESS.legalName)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/tipo de documento/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Estado')).not.toBeInTheDocument()
  })

  it('empty displayName and email show required-field alerts and send no request', async () => {
    let requestSent = false
    server.use(
      http.patch(`${API_BASE_URL}/business/me`, () => {
        requestSent = true
        return HttpResponse.json(SEED_BUSINESS)
      })
    )
    renderForm()

    fireEvent.change(screen.getByLabelText('Nombre público'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Correo de contacto'), { target: { value: '' } })
    submit()

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.length).toBeGreaterThanOrEqual(2)
    expect(requestSent).toBe(false)
  })

  it('an invalid email shows the email-format error, distinct from "required"', async () => {
    renderForm()

    fireEvent.change(screen.getByLabelText('Correo de contacto'), {
      target: { value: 'not-an-email' },
    })
    submit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Ingresá un correo válido.')
  })

  it('on successful submit, saves via the update mutation and navigates back to /negocio', async () => {
    server.use(
      http.patch(`${API_BASE_URL}/business/me`, () =>
        HttpResponse.json({ ...SEED_BUSINESS, displayName: 'Café de la 70 Renovado' })
      )
    )
    renderForm()

    fireEvent.change(screen.getByLabelText('Nombre público'), {
      target: { value: 'Café de la 70 Renovado' },
    })
    submit()

    expect(await screen.findByText('Negocio marker')).toBeInTheDocument()
  })

  it('shows the read-only-field-specific message when the server rejects with 409', async () => {
    server.use(
      http.patch(`${API_BASE_URL}/business/me`, () => new HttpResponse(null, { status: 409 }))
    )
    renderForm()

    submit()

    await screen.findByRole('button', { name: 'Guardar cambios' })
    expect(useToastStore.getState().toasts).toContainEqual(
      expect.objectContaining({
        variant: 'error',
        message: 'Uno de los campos que intentaste cambiar no se puede editar desde acá.',
      })
    )
  })

  it('shows the generic error message for a non-409 failure', async () => {
    server.use(
      http.patch(`${API_BASE_URL}/business/me`, () => new HttpResponse(null, { status: 500 }))
    )
    renderForm()

    submit()

    await screen.findByRole('button', { name: 'Guardar cambios' })
    expect(useToastStore.getState().toasts).toContainEqual(
      expect.objectContaining({
        variant: 'error',
        message: 'No pudimos guardar los cambios.',
      })
    )
  })

  it('links back to /negocio via the cancel action', () => {
    renderForm()

    const link = screen.getByRole('link', { name: 'Cancelar' })
    expect(link).toHaveAttribute('href', '/negocio')
  })
})
