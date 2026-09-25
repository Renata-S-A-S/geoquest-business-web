import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { setMockBusiness } from '@/test/mock-business'
import { CreateRewardPage } from './create-reward-page'

function renderPage(search = '') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/recompensas/nueva${search}`]}>
        <CreateRewardPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

/**
 * El contenedor existe para resolver el `businessId` antes de montar el
 * formulario, porque `POST /portal/businesses/{businessId}/rewards` lo lleva
 * en el path. Estos tests cubren las tres ramas de esa resolución.
 */
describe('CreateRewardPage', () => {
  it('anuncia la carga mientras resuelve el negocio', () => {
    server.use(http.get(`${API_BASE_URL}/business/mine`, () => new Promise<never>(() => {})))

    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Cargando los datos de tu negocio…')
  })

  /**
   * Sin negocio no hay path que llamar, así que el formulario NO se monta: es
   * preferible un error con reintento a un formulario que se puede llenar
   * entero y falla recién al enviar.
   */
  it('muestra un error con reintento y NO monta el formulario si el negocio falla', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/mine`, () =>
        HttpResponse.json({ title: 'InternalError' }, { status: 500 })
      )
    )

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos identificar tu negocio')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument()
  })

  /**
   * `useMyBusiness()` resuelve con éxito y `data === null` cuando
   * `/business/mine` devuelve `[]` (sin negocio propio, real-backend-readiness
   * PR6b) — un caso que `useBusinessMe()` no podía representar. Colapsa en la
   * misma rama de error que un fallo de red: sin `businessId` tampoco hay
   * formulario que mostrar.
   */
  it('muestra el mismo error y NO monta el formulario cuando el explorador no tiene negocio propio', async () => {
    setMockBusiness('none')

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos identificar tu negocio')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument()
  })

  it('monta el formulario cuando el negocio ya está resuelto', async () => {
    renderPage()

    expect(await screen.findByLabelText('Título')).toBeInTheDocument()
  })

  /**
   * El lugar preseleccionado viaja por query string cuando se entra desde el
   * detalle de un lugar, y tiene que sobrevivir al fork de carga del negocio.
   */
  it('pasa el lugar preseleccionado del query string al formulario', async () => {
    renderPage('?lugar=00000000-0000-0000-0000-000000000010')

    expect(await screen.findByLabelText('Título')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Lugar (opcional)' })).toBeInTheDocument()
  })
})
