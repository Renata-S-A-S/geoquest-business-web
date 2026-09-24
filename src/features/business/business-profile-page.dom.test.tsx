import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS, SEED_BUSINESS_STAFF_ME } from '@/shared/mocks/seed'
import { BusinessProfilePage } from './business-profile-page'

function renderBusinessProfilePage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BusinessProfilePage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('BusinessProfilePage', () => {
  it('muestra el indicador de carga mientras la query está pendiente', async () => {
    server.use(http.get(`${API_BASE_URL}/business/me`, () => new Promise(() => {})))

    renderBusinessProfilePage()

    expect(await screen.findByRole('status')).toHaveTextContent('Cargando los datos de tu negocio…')
  })

  it('muestra el error inline con reintento cuando la query falla, sin renderizar la vista', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/me`, () =>
        HttpResponse.json(
          { title: 'InternalError', detail: 'No pudimos consultar el negocio' },
          { status: 500 }
        )
      )
    )

    renderBusinessProfilePage()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos consultar el negocio')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled()
    expect(screen.queryByText(SEED_BUSINESS.displayName)).not.toBeInTheDocument()
  })

  it('renderiza BusinessProfileView con los datos del negocio cuando la query resuelve', async () => {
    server.use(http.get(`${API_BASE_URL}/business/me`, () => HttpResponse.json(SEED_BUSINESS)))

    renderBusinessProfilePage()

    expect(await screen.findByText(SEED_BUSINESS.displayName)).toBeInTheDocument()
    expect(screen.getByText(SEED_BUSINESS.legalName)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reintenta la query al hacer click en el botón de reintentar tras un error', async () => {
    let callCount = 0
    server.use(
      http.get(`${API_BASE_URL}/business/me`, () => {
        callCount += 1
        if (callCount === 1) {
          return HttpResponse.json(
            { title: 'InternalError', detail: 'No pudimos consultar el negocio' },
            { status: 500 }
          )
        }
        return HttpResponse.json(SEED_BUSINESS)
      })
    )

    renderBusinessProfilePage()

    const retryButton = await screen.findByRole('button', { name: 'Reintentar' })
    retryButton.click()

    expect(await screen.findByText(SEED_BUSINESS.displayName)).toBeInTheDocument()
    expect(callCount).toBe(2)
  })

  it('shows the edit link when the authenticated staff is the Owner (default seed)', async () => {
    renderBusinessProfilePage()

    expect(await screen.findByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href',
      '/negocio/editar'
    )
  })

  it('does NOT show the edit link for a non-Owner role (#72 D4 — constructed directly, gate always passes today)', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business-staff/me`, () =>
        HttpResponse.json({ ...SEED_BUSINESS_STAFF_ME, role: 'Staff' })
      )
    )

    renderBusinessProfilePage()

    await screen.findByText(SEED_BUSINESS.displayName)
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument()
  })

  it('does NOT show the edit link while the staff-identity read is still pending (fail-safe default, never fail-open)', async () => {
    server.use(http.get(`${API_BASE_URL}/business-staff/me`, () => new Promise(() => {})))

    renderBusinessProfilePage()

    await screen.findByText(SEED_BUSINESS.displayName)
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument()
  })
})
