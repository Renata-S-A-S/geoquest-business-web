import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS, SEED_BUSINESS_STAFF_ME } from '@/shared/mocks/seed'
import { BusinessProfileEditPage } from './business-profile-edit-page'

function renderEditPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/negocio/editar']}>
        <Routes>
          <Route path="/negocio/editar" element={<BusinessProfileEditPage />} />
          <Route path="/negocio" element={<p>Negocio marker</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('BusinessProfileEditPage', () => {
  it('shows the loading indicator while either query is pending', async () => {
    server.use(http.get(`${API_BASE_URL}/business/me`, () => new Promise(() => {})))

    renderEditPage()

    expect(await screen.findByRole('status')).toHaveTextContent('Cargando los datos de tu negocio…')
  })

  it('shows the inline error with retry when the business read fails, never rendering the form', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/me`, () =>
        HttpResponse.json(
          { title: 'InternalError', detail: 'No pudimos consultar el negocio' },
          { status: 500 }
        )
      )
    )

    renderEditPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos consultar el negocio')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled()
    expect(screen.queryByLabelText('Nombre público')).not.toBeInTheDocument()
  })

  it('shows the inline error with retry when the staff-identity read fails, never rendering the form', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business-staff/me`, () =>
        HttpResponse.json(
          { title: 'InternalError', detail: 'No pudimos resolver tu identidad' },
          { status: 500 }
        )
      )
    )

    renderEditPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos resolver tu identidad')
    expect(screen.queryByLabelText('Nombre público')).not.toBeInTheDocument()
  })

  it('renders a translated not-Owner notice (no redirect, no disabled inputs) for a Manager/Staff role', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business-staff/me`, () =>
        HttpResponse.json({ ...SEED_BUSINESS_STAFF_ME, role: 'Staff' })
      )
    )

    renderEditPage()

    expect(
      await screen.findByText('Solo el dueño del negocio puede editar estos datos.')
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombre público')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /nombre público/i })).not.toBeInTheDocument()

    const backLink = screen.getByRole('link', { name: 'Volver a Mi negocio' })
    expect(backLink).toHaveAttribute('href', '/negocio')
  })

  it('renders the edit form prefilled from the server read for an Owner', async () => {
    renderEditPage()

    expect(await screen.findByLabelText('Nombre público')).toHaveValue(SEED_BUSINESS.displayName)
  })

  it('retries only the failed query on click (both business and staff reads can fail independently)', async () => {
    let businessCallCount = 0
    server.use(
      http.get(`${API_BASE_URL}/business/me`, () => {
        businessCallCount += 1
        if (businessCallCount === 1) {
          return HttpResponse.json(
            { title: 'InternalError', detail: 'No pudimos consultar el negocio' },
            { status: 500 }
          )
        }
        return HttpResponse.json(SEED_BUSINESS)
      })
    )

    renderEditPage()

    const retryButton = await screen.findByRole('button', { name: 'Reintentar' })
    fireEvent.click(retryButton)

    expect(await screen.findByLabelText('Nombre público')).toHaveValue(SEED_BUSINESS.displayName)
    expect(businessCallCount).toBe(2)
  })
})
