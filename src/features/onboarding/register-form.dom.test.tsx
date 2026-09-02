import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { useToastStore } from '@/shared/stores/toast-store'
import { RegisterPage } from './register-page'
import { PendingStatusPage } from './pending-page'

function renderRegisterPage() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/registro']}>
        <Routes>
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/registro/pendiente" element={<PendingStatusPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

/** Llena los 4 campos de texto con datos válidos — deja category/legalDocumentType a elección de cada test. */
function fillTextFields() {
  fireEvent.change(screen.getByLabelText('Nombre legal'), {
    target: { value: 'Café de la 70 SAS' },
  })
  fireEvent.change(screen.getByLabelText('Nombre público'), { target: { value: 'Café de la 70' } })
  fireEvent.change(screen.getByLabelText('Correo electrónico'), {
    target: { value: 'contacto@cafe70.co' },
  })
  fireEvent.change(screen.getByLabelText('Número de documento'), {
    target: { value: '900123456-7' },
  })
}

function selectCategory(label: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Categoría' }))
  fireEvent.click(screen.getByRole('option', { name: label }))
}

function selectLegalDocumentType(label: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Tipo de documento legal' }))
  fireEvent.click(screen.getByRole('option', { name: label }))
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Registrar negocio' }))
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

afterEach(() => {
  useToastStore.setState({ toasts: [] })
})

describe('RegisterForm', () => {
  it('al enviar vacío, muestra el error de requerido en los 6 campos y no navega', async () => {
    renderRegisterPage()

    submit()

    const alerts = await screen.findAllByRole('alert')
    expect(alerts).toHaveLength(6)
    for (const alert of alerts) {
      expect(alert).toHaveTextContent('Este campo es obligatorio')
    }
    expect(screen.getByText('Registra tu negocio')).toBeInTheDocument()
  })

  it('un email con formato inválido muestra su propio mensaje, sin bloquear el resto por "requerido"', async () => {
    renderRegisterPage()
    fillTextFields()
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'no-es-un-email' },
    })
    selectCategory('Gastronomía')
    selectLegalDocumentType('NIT')

    submit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Ingresá un correo electrónico válido')
  })

  it('sin categoría elegida, muestra su error aunque el resto del formulario sea válido', async () => {
    renderRegisterPage()
    fillTextFields()
    selectLegalDocumentType('NIT')

    submit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Este campo es obligatorio')
    expect(screen.getByRole('combobox', { name: 'Categoría' })).toHaveTextContent(
      'Elegí una categoría'
    )
  })

  it('con datos válidos, registra el negocio y redirige a /registro/pendiente', async () => {
    renderRegisterPage()
    fillTextFields()
    selectCategory('Gastronomía')
    selectLegalDocumentType('NIT')

    submit()

    expect(
      await screen.findByText('negocio — pendiente de verificación (ver #27)')
    ).toBeInTheDocument()
  })

  it('si el backend responde 400 problem+json, muestra el detail en un toast y no navega', async () => {
    server.use(
      http.post(`${API_BASE_URL}/business/register`, () =>
        HttpResponse.json(
          { title: 'ValidationFailed', detail: 'El documento ya está registrado' },
          { status: 400 }
        )
      )
    )
    renderRegisterPage()
    fillTextFields()
    selectCategory('Gastronomía')
    selectLegalDocumentType('NIT')

    submit()

    await screen.findByText('Registra tu negocio')
    expect(useToastStore.getState().toasts).toContainEqual(
      expect.objectContaining({ variant: 'error', message: 'El documento ya está registrado' })
    )
  })
})
