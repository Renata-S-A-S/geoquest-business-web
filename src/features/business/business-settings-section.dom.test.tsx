import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS, SEED_BUSINESS_SCENARIOS } from '@/shared/mocks/seed'
import { setMockBusiness } from '@/test/mock-business'
import { BusinessSettingsSection } from './business-settings-section'

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <BusinessSettingsSection />
    </QueryClientProvider>
  )
}

describe('BusinessSettingsSection', () => {
  it('muestra un indicador de carga mientras resuelve /business/mine', async () => {
    server.use(http.get(`${API_BASE_URL}/business/mine`, () => new Promise(() => {})))
    renderSection()
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })

  it('Activo: solo nombre, estado y logo — sin categoría, correo ni datos legales', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/mine`, () =>
        HttpResponse.json([
          { ...SEED_BUSINESS_SCENARIOS.Active, logoUrl: 'https://cdn.example.com/logo.png' },
        ])
      )
    )
    renderSection()
    expect(await screen.findByText(SEED_BUSINESS.displayName)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Activo')
    const img = screen.getByRole('img', { name: SEED_BUSINESS.displayName })
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/logo.png')
    expect(screen.queryByText(SEED_BUSINESS.category)).not.toBeInTheDocument()
    expect(screen.queryByText(SEED_BUSINESS.email)).not.toBeInTheDocument()
    expect(screen.queryByText(/legal/i)).not.toBeInTheDocument()
  })

  it('Rechazado: motivo sin truncar y fecha formateada', async () => {
    setMockBusiness('Rejected')
    renderSection()
    const reason = await screen.findByText(SEED_BUSINESS_SCENARIOS.Rejected.rejectionReason ?? '')
    expect(reason).toHaveClass('break-words')
    expect(screen.getByRole('status')).toHaveTextContent('No aprobado')
    expect(screen.getByText(/1 de septiembre de 2026/)).toBeInTheDocument()
  })

  it('error: mensaje genérico con reintento', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/mine`, () => new HttpResponse(null, { status: 500 }))
    )
    renderSection()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No pudimos cargar los datos de tu negocio.')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('sin negocio propio: mensaje dedicado, sin botón de reintentar', async () => {
    setMockBusiness('none')
    renderSection()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No encontramos un negocio asociado a tu cuenta.')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })
})
