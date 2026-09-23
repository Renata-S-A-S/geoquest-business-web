import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS } from '@/shared/mocks/seed'
import type { Business } from '@/shared/schemas/business'
import { PendingStatusPage } from './pending-page'

/** Negocio `Pending` de fixture — Group A no ejercita la rama fast/reinforced (#25, PR 2). */
const PENDING_BUSINESS: Business = {
  ...SEED_BUSINESS,
  status: 'Pending',
  googleMapsPlaceId: null,
  isGoogleMapsVerified: false,
}

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
    server.use(http.get(`${API_BASE_URL}/business/me`, () => new Promise(() => {})))

    renderPendingPage()

    expect(screen.getByRole('heading', { name: 'Estado de tu negocio' })).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Cargando el estado de tu negocio…')
  })

  it('shows the inline error with retry when the query fails', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/me`, () =>
        HttpResponse.json(
          { title: 'InternalError', detail: 'No pudimos consultar el negocio' },
          { status: 500 }
        )
      )
    )

    renderPendingPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos consultar el negocio')
    expect(screen.getByRole('button', { name: 'Actualizar estado' })).toBeEnabled()
  })

  it('renders resolved copy and the success badge for an Active business on load, without SLA or branch text', async () => {
    server.use(http.get(`${API_BASE_URL}/business/me`, () => HttpResponse.json(SEED_BUSINESS)))

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

  it('renders the heading, Pending badge, and the SLA message, without any branch content', async () => {
    server.use(http.get(`${API_BASE_URL}/business/me`, () => HttpResponse.json(PENDING_BUSINESS)))

    renderPendingPage()

    // Se espera primero el texto del SLA (solo aparece con `data` resuelto)
    // para garantizar que el arm de loading (también `role="status"`) ya
    // desmontó, antes de consultar `getByRole('status')` sin ambigüedad.
    expect(
      await screen.findByText(
        'Estamos verificando los datos de tu negocio. La revisión toma hasta 48 horas hábiles desde el registro.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('En verificación')
    expect(screen.getByRole('heading', { name: 'Estado de tu negocio' })).toBeInTheDocument()
  })

  it('refetches on refresh click, disables the button while fetching, and replaces Pending copy with Active copy', async () => {
    let callCount = 0
    server.use(
      http.get(`${API_BASE_URL}/business/me`, async () => {
        callCount += 1
        // Pequeño delay real (no fake timers) SOLO en el 2do call, para que
        // la ventana de `isFetching: true` sea observable por el test — el
        // 1er call (carga inicial) responde de inmediato.
        if (callCount === 2) await new Promise((resolve) => setTimeout(resolve, 20))
        return HttpResponse.json(callCount === 1 ? PENDING_BUSINESS : SEED_BUSINESS)
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
