import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { setMockBusiness } from '@/test/mock-business'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS_SCENARIOS } from '@/shared/mocks/seed'
import { PendingStatusPage } from './pending-page'

function renderPendingPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PendingStatusPage />
    </QueryClientProvider>
  )
}

describe('PendingStatusPage', () => {
  it('shows the loading indicator alongside the heading while the query is pending', async () => {
    server.use(http.get(`${API_BASE_URL}/business/mine`, () => new Promise(() => {})))

    renderPendingPage()

    expect(screen.getByRole('heading', { name: 'Estado de tu negocio' })).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Cargando el estado de tu negocio…')
  })

  it('shows the inline error with retry when the query fails', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/mine`, () => new HttpResponse(null, { status: 500 }))
    )

    renderPendingPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos consultar el estado de tu negocio.'
    )
    expect(screen.getByRole('button', { name: 'Actualizar estado' })).toBeEnabled()
  })

  it('renders resolved copy and the success badge for an Active business on load, without the SLA message', async () => {
    renderPendingPage()

    expect(await screen.findByText('Tu negocio está verificado')).toBeInTheDocument()
    expect(
      screen.getByText('La verificación terminó y tu negocio ya está activo en GeoQuest.')
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Activo')
    expect(
      screen.queryByText(
        'Estamos verificando los datos de tu negocio. La revisión toma hasta 48 horas hábiles desde el registro.'
      )
    ).not.toBeInTheDocument()
  })

  it('renders the heading, PendingVerification badge, and the SLA message, without resolved copy', async () => {
    setMockBusiness('PendingVerification')

    renderPendingPage()

    expect(
      await screen.findByText(
        'Estamos verificando los datos de tu negocio. La revisión toma hasta 48 horas hábiles desde el registro.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('En verificación')
    expect(screen.getByRole('heading', { name: 'Estado de tu negocio' })).toBeInTheDocument()
  })

  it('refetches on refresh click, disables the button while fetching, and replaces PendingVerification copy with Active copy', async () => {
    const { PendingVerification: pending, Active: active } = SEED_BUSINESS_SCENARIOS
    let callCount = 0
    server.use(
      http.get(`${API_BASE_URL}/business/mine`, async () => {
        callCount += 1
        if (callCount === 2) await new Promise((resolve) => setTimeout(resolve, 20))
        return HttpResponse.json([callCount === 1 ? pending : active])
      })
    )

    renderPendingPage()

    await screen.findByText(
      'Estamos verificando los datos de tu negocio. La revisión toma hasta 48 horas hábiles desde el registro.'
    )

    const refreshButton = screen.getByRole('button', { name: 'Actualizar estado' })
    fireEvent.click(refreshButton)

    expect(await screen.findByRole('button', { name: 'Actualizando…' })).toBeDisabled()
    expect(await screen.findByText('Tu negocio está verificado')).toBeInTheDocument()
    expect(
      screen.queryByText(
        'Estamos verificando los datos de tu negocio. La revisión toma hasta 48 horas hábiles desde el registro.'
      )
    ).not.toBeInTheDocument()
  })
})
