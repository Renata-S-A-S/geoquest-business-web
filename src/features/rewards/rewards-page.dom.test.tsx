import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS, SEED_REWARDS } from '@/shared/mocks/seed'
import { setMockBusiness } from '@/test/mock-business'
import { BUSINESS_WRITE_BLOCK_ID } from '@/features/business/use-business-access'
import { RewardsPage } from './rewards-page'

const REWARDS_URL = `${API_BASE_URL}/portal/businesses/${SEED_BUSINESS.id}/rewards`

function renderRewardsPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RewardsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('RewardsPage', () => {
  /**
   * La rama que más fácil se rompe: el listado depende del `businessId`, así
   * que su query queda `enabled: false` mientras el negocio no resuelva. Si el
   * contenedor no forkeara sobre la query del negocio, un `/business/mine`
   * caído dejaría la pantalla en «Cargando…» para siempre en vez de mostrar
   * un error con reintento.
   */
  it('muestra un error propio, no un spinner eterno, si no puede resolver el negocio', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/mine`, () =>
        HttpResponse.json({ title: 'InternalError' }, { status: 500 })
      )
    )

    renderRewardsPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos identificar tu negocio')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  /**
   * `useMyBusiness()` puede resolver con éxito y `data === null`
   * (`/business/mine` devuelve `[]`, real-backend-readiness PR6b) — un caso
   * que `useBusinessMe()` no podía representar. Sin la rama dedicada,
   * `rewardsQuery` se quedaría `enabled: false` para siempre y la pantalla
   * mostraría «Cargando…» eternamente en vez de un error con reintento.
   */
  it('muestra el mismo error, no un spinner eterno, cuando el explorador no tiene negocio propio', async () => {
    setMockBusiness('none')

    renderRewardsPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos identificar tu negocio')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('muestra el estado de carga mientras la consulta está pendiente', async () => {
    server.use(http.get(REWARDS_URL, () => new Promise<never>(() => {})))

    renderRewardsPage()

    expect(await screen.findByRole('status')).toHaveTextContent('Cargando tus recompensas…')
  })

  it('renderiza las recompensas sembradas cuando la consulta resuelve', async () => {
    renderRewardsPage()

    expect((await screen.findAllByText(SEED_REWARDS[0].title)).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(SEED_REWARDS[1].title).length).toBeGreaterThanOrEqual(1)
  })

  it('traduce el estado en vez de mostrar el literal del enum', async () => {
    renderRewardsPage()

    expect((await screen.findAllByText('Publicada')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Borrador').length).toBeGreaterThanOrEqual(1)
  })

  it('no muestra el literal crudo del enum en ninguna parte', async () => {
    renderRewardsPage()

    await screen.findAllByText('Publicada')
    expect(screen.queryByText('Published')).not.toBeInTheDocument()
    expect(screen.queryByText('Draft')).not.toBeInTheDocument()
  })

  it('muestra el costo en GeoPoints', async () => {
    renderRewardsPage()

    expect((await screen.findAllByText('100 GeoPoints')).length).toBeGreaterThanOrEqual(1)
  })

  /**
   * Estos tres casos son el corazón de la pantalla. «Agotada» NO es un
   * estado del servidor: se calcula de `stockRemaining`. Y `null` significa
   * stock ILIMITADO, no cero — tratarlos igual mostraría «Agotada» en la
   * recompensa que nunca se agota, que es el error exactamente al revés.
   */
  it('muestra el stock restante sobre el total cuando hay límite', async () => {
    renderRewardsPage()

    expect((await screen.findAllByText('42 de 50')).length).toBeGreaterThanOrEqual(1)
  })

  it('muestra «Ilimitado» cuando la recompensa no tiene tope de stock', async () => {
    renderRewardsPage()

    expect((await screen.findAllByText('Ilimitado')).length).toBeGreaterThanOrEqual(1)
  })

  it('muestra «Agotada» solo cuando el restante llegó a cero, sin tocar el badge de estado', async () => {
    server.use(
      http.get(REWARDS_URL, () => HttpResponse.json([{ ...SEED_REWARDS[0], stockRemaining: 0 }]))
    )

    renderRewardsPage()

    expect((await screen.findAllByText('Agotada')).length).toBeGreaterThanOrEqual(1)
    // Sigue Publicada: agotada no es un estado, y esa distinción es
    // justamente la que el negocio necesita ver.
    expect(screen.getAllByText('Publicada').length).toBeGreaterThanOrEqual(1)
  })

  it('muestra el estado vacío con el CTA de crear cuando el negocio no tiene recompensas', async () => {
    server.use(http.get(REWARDS_URL, () => HttpResponse.json([])))

    renderRewardsPage()

    expect(await screen.findByText('Todavía no hay ninguna recompensa')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Crear recompensa' }).length).toBeGreaterThanOrEqual(
      1
    )
  })

  it('mantiene el CTA de crear visible cuando la lista YA tiene recompensas', async () => {
    renderRewardsPage()

    await screen.findAllByText(SEED_REWARDS[0].title)
    expect(screen.getByRole('link', { name: 'Crear recompensa' })).toHaveAttribute(
      'href',
      '/recompensas/nueva'
    )
  })

  it('muestra el error y permite reintentar cuando el backend falla', async () => {
    let callCount = 0
    server.use(
      http.get(REWARDS_URL, () => {
        callCount += 1
        return HttpResponse.json(
          { title: 'InternalError', detail: 'No pudimos consultar las recompensas' },
          { status: 500 }
        )
      })
    )

    renderRewardsPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos consultar las recompensas'
    )
    expect(callCount).toBe(1)

    screen.getByRole('button', { name: 'Reintentar' }).click()

    await screen.findByRole('alert')
    expect(callCount).toBeGreaterThan(1)
  })

  it('ya no renderiza el placeholder de ruta', async () => {
    renderRewardsPage()

    await screen.findAllByText(SEED_REWARDS[0].title)
    expect(screen.queryByText('recompensas — pendiente')).not.toBeInTheDocument()
  })

  /**
   * Integración representativa de PR8b (owner decision #1546 punto 1): con el
   * negocio Paused, el CTA de crear deja de ser un `link` navegable y explica
   * el motivo vía `aria-describedby` — no un `disabled` mudo.
   */
  it('bloquea el CTA de crear cuando el negocio está Paused', async () => {
    setMockBusiness('Paused')

    renderRewardsPage()

    await screen.findAllByText(SEED_REWARDS[0].title)
    expect(screen.queryByRole('link', { name: 'Crear recompensa' })).not.toBeInTheDocument()
    const cta = screen.getAllByText('Crear recompensa')[0]
    expect(cta).toHaveAttribute('aria-disabled', 'true')
    expect(cta).toHaveAttribute('aria-describedby', BUSINESS_WRITE_BLOCK_ID)
  })
})
