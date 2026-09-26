import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { setMockBusiness } from '@/test/mock-business'
import { BUSINESS_WRITE_BLOCK_ID } from '@/features/business/use-business-access'
import { BusinessStatusBanner } from './business-status-banner'

function renderBanner() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <BusinessStatusBanner />
    </QueryClientProvider>
  )
}

describe('BusinessStatusBanner', () => {
  it('no renderiza nada cuando el negocio está Active', async () => {
    renderBanner()

    // Espera a que la query resuelva antes de afirmar la ausencia — si no,
    // el "no está" sería trivial (todavía cargando, no una decisión real).
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('muestra el aviso de pausa con role=status y el id del banner cuando el negocio está Paused', async () => {
    setMockBusiness('Paused')
    renderBanner()

    const banner = await screen.findByRole('status')
    expect(banner).toHaveAttribute('id', BUSINESS_WRITE_BLOCK_ID)
    expect(banner).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('Tu negocio está en pausa')).toBeInTheDocument()
    expect(
      screen.getByText(/Los exploradores no pueden ver lugares nuevos/)
    ).toBeInTheDocument()
  })

  it('muestra el aviso de suspensión cuando el negocio está Suspended', async () => {
    setMockBusiness('Suspended')
    renderBanner()

    const banner = await screen.findByRole('status')
    expect(banner).toHaveAttribute('id', BUSINESS_WRITE_BLOCK_ID)
    expect(screen.getByText('Tu negocio está suspendido')).toBeInTheDocument()
    expect(screen.getByText(/No podés crear ni editar nada/)).toBeInTheDocument()
  })
})
