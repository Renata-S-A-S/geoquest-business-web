import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS, SEED_PLACES, SEED_REWARDS } from '@/shared/mocks/seed'
import { RewardDetailPage } from './reward-detail-page'

const businessId = SEED_BUSINESS.id
const published = SEED_REWARDS[0]
const draft = SEED_REWARDS[1]

function detailUrl(rewardId: string) {
  return `${API_BASE_URL}/portal/businesses/${businessId}/rewards/${rewardId}`
}

function renderDetail(rewardId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/recompensas/${rewardId}`]}>
        <Routes>
          <Route path="/recompensas/:rewardId" element={<RewardDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('RewardDetailPage', () => {
  it('muestra el título y el estado traducido, no el literal del enum', async () => {
    renderDetail(published.rewardId)

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(published.title)
    expect(screen.getByRole('status')).toHaveTextContent('Publicada')
    expect(screen.queryByText('Published')).not.toBeInTheDocument()
  })

  it('anuncia la carga mientras resuelve', () => {
    server.use(http.get(detailUrl(published.rewardId), () => new Promise<never>(() => {})))

    renderDetail(published.rewardId)

    expect(screen.getByRole('status')).toHaveTextContent('Cargando la recompensa…')
  })

  /**
   * Los tres casos de stock que pide #109. `stockTotal === null` es ilimitado,
   * NO cero — tratarlos igual mostraría «Agotada» en la que nunca se agota.
   */
  it('muestra el stock con tope como restantes sobre total', async () => {
    renderDetail(published.rewardId)

    expect(await screen.findByText('42 de 50 disponibles')).toBeInTheDocument()
  })

  it('muestra el stock sin tope como ilimitado, no como cero', async () => {
    renderDetail(draft.rewardId)

    expect(await screen.findByText('Sin tope: ilimitada')).toBeInTheDocument()
    expect(screen.queryByText('Agotada: no quedan canjes')).not.toBeInTheDocument()
  })

  it('muestra agotada cuando el stock restante llegó a cero', async () => {
    server.use(
      http.get(detailUrl(published.rewardId), () =>
        HttpResponse.json({ ...published, stockRemaining: 0 })
      )
    )

    renderDetail(published.rewardId)

    expect(await screen.findByText('Agotada: no quedan canjes')).toBeInTheDocument()
  })

  it('muestra la imagen cuando existe', async () => {
    renderDetail(published.rewardId)

    const image = await screen.findByRole('img', { name: `Imagen de ${published.title}` })
    expect(image).toHaveAttribute('src', published.imageUrl)
  })

  /**
   * «Dice qué falta si no» es criterio de aceptación explícito de #109: un
   * hueco vacío no le explica al negocio que le falta subir algo.
   */
  it('explica qué falta cuando no hay imagen, en vez de dejar un hueco', async () => {
    renderDetail(draft.rewardId)

    expect(await screen.findByText('Esta recompensa todavía no tiene imagen.')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('resuelve el NOMBRE del lugar en vez de mostrar su UUID', async () => {
    renderDetail(published.rewardId)

    expect(await screen.findByText(SEED_PLACES[0].name)).toBeInTheDocument()
    expect(screen.queryByText(published.placeId as string)).not.toBeInTheDocument()
  })

  it('dice que vale en todos los lugares cuando no está atada a ninguno', async () => {
    renderDetail(draft.rewardId)

    expect(await screen.findByText('Válida en todos tus lugares')).toBeInTheDocument()
  })

  /**
   * 403 y 404 colapsan en el mismo mensaje y sin reintento: el backend
   * devuelve el mismo 403 para un id desconocido y para el de otro dueño
   * (anti-enumeración), así que el portal no puede afirmar cuál es.
   */
  it('trata un 404 como "no existe o no es tuya" y no ofrece reintentar', async () => {
    renderDetail('00000000-0000-0000-0000-0000000000ff')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta recompensa no existe o no es de tu negocio.'
    )
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('trata un 403 igual que un 404, sin decir "no encontrada"', async () => {
    server.use(
      http.get(detailUrl(published.rewardId), () =>
        HttpResponse.json({ title: 'RewardPortal.NotBusinessOwner' }, { status: 403 })
      )
    )

    renderDetail(published.rewardId)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta recompensa no existe o no es de tu negocio.'
    )
  })

  it('ofrece reintentar en un error de servidor, que sí puede ser transitorio', async () => {
    server.use(
      http.get(detailUrl(published.rewardId), () =>
        HttpResponse.json({ title: 'InternalError' }, { status: 500 })
      )
    )

    renderDetail(published.rewardId)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('muestra un error propio si no puede resolver el negocio', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/me`, () =>
        HttpResponse.json({ title: 'InternalError' }, { status: 500 })
      )
    )

    renderDetail(published.rewardId)

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos identificar tu negocio')
  })

  it('enlaza de vuelta al listado', async () => {
    renderDetail(published.rewardId)

    expect(await screen.findByRole('link', { name: 'Volver a recompensas' })).toHaveAttribute(
      'href',
      '/recompensas'
    )
  })

  /**
   * `Reward` no tiene `CreatedAtUtc` ni `UpdatedAtUtc`, así que la pantalla no
   * puede mostrar fechas. Este test fija la ausencia para que nadie agregue un
   * "creada el…" inventado más adelante.
   */
  it('NO muestra fechas, porque el backend no las tiene', async () => {
    renderDetail(published.rewardId)

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText(/creada el/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/actualizada el/i)).not.toBeInTheDocument()
  })
})
