import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_PLACES } from '@/shared/mocks/seed'
import { PlaceDetailPage } from './place-detail-page'

const ACTIVE = SEED_PLACES[0]
const DRAFT = SEED_PLACES[1]

function renderDetail(placeId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/lugares/${placeId}`]}>
        <Routes>
          <Route path="/lugares/:placeId" element={<PlaceDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('PlaceDetailPage', () => {
  it('muestra el estado de carga mientras la consulta está pendiente', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/places/:placeId`, () => new Promise<never>(() => {}))
    )

    renderDetail(ACTIVE.placeId)

    expect(await screen.findByRole('status')).toHaveTextContent('Cargando el lugar…')
  })

  it('muestra los campos que el listado NO trae', async () => {
    renderDetail(ACTIVE.placeId)

    // Los cinco campos exclusivos del detalle: descripción, coordenadas,
    // radio y fotos. Si el detalle resolviera del listado, como proponía la
    // issue, ninguno de estos podría mostrarse.
    expect(await screen.findByText(ACTIVE.description)).toBeInTheDocument()
    expect(screen.getByText(`${ACTIVE.latitude}, ${ACTIVE.longitude}`)).toBeInTheDocument()
    expect(screen.getByText('100 m')).toBeInTheDocument()
  })

  it('traduce la categoría y la subcategoría en vez de mostrar el entero', async () => {
    renderDetail(ACTIVE.placeId)

    expect(await screen.findByText('Gastronomía')).toBeInTheDocument()
    expect(screen.getByText('Café')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  /**
   * El criterio de aceptación de #35 es explícito: los puntos deben verse
   * **visiblemente distintos a un campo editable, no solo `disabled`**. Un
   * input deshabilitado comunica "esto se edita, pero no ahora", que es lo
   * contrario de la verdad: nunca se va a poder editar.
   */
  it('NO renderiza ningún input para las recompensas, ni deshabilitado', async () => {
    renderDetail(ACTIVE.placeId)

    await screen.findByText(ACTIVE.description)

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(document.querySelectorAll('input')).toHaveLength(0)
  })

  it('muestra los valores de recompensa y explica quién los fija', async () => {
    renderDetail(ACTIVE.placeId)

    expect(await screen.findByText('XP por check-in')).toBeInTheDocument()
    expect(screen.getByText('GeoPoints por check-in')).toBeInTheDocument()
    expect(screen.getByText(/Estos valores los fija GeoQuest, no tu negocio/)).toBeInTheDocument()
  })

  it('traduce el estado del lugar en vez de mostrar el literal del enum', async () => {
    renderDetail(DRAFT.placeId)

    expect(await screen.findByText('Borrador')).toBeInTheDocument()
    expect(screen.queryByText('Draft')).not.toBeInTheDocument()
  })

  /**
   * Un borrador sin fotos no se puede publicar: el backend responde 409
   * `Place.ActiveRequiresAtLeastOnePhoto`. Decirlo en la pantalla evita que
   * el negocio intente publicar y reciba un error que no explica qué falta.
   */
  it('avisa que falta una foto para poder publicar cuando no hay ninguna', async () => {
    renderDetail(DRAFT.placeId)

    expect(await screen.findByText('Este lugar todavía no tiene fotos.')).toBeInTheDocument()
    expect(
      screen.getByText('Hace falta al menos una foto para poder publicarlo.')
    ).toBeInTheDocument()
  })

  it('muestra las fotos cuando el lugar tiene alguna', async () => {
    renderDetail(ACTIVE.placeId)

    await screen.findByText(ACTIVE.description)
    expect(screen.getByText('1 de 5')).toBeInTheDocument()
    expect(screen.queryByText('Este lugar todavía no tiene fotos.')).not.toBeInTheDocument()
  })

  /**
   * El backend devuelve el mismo `NotFound` para un id inexistente y para
   * uno de otro negocio. Reintentar no va a cambiar nada, así que el botón
   * de reintentar no se muestra en ese caso — ofrecerlo invitaría a repetir
   * una acción que no puede funcionar.
   */
  it('muestra un mensaje propio para el 404 y NO ofrece reintentar', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/places/:placeId`, () =>
        HttpResponse.json({ title: 'GetBusinessPlaceByIdQuery.NotFound' }, { status: 404 })
      )
    )

    renderDetail('00000000-0000-0000-0000-0000000000ff')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ese lugar no existe o no es de tu negocio.'
    )
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('ofrece reintentar ante un error de servidor, que sí puede ser transitorio', async () => {
    let callCount = 0
    server.use(
      http.get(`${API_BASE_URL}/business/places/:placeId`, () => {
        callCount += 1
        return HttpResponse.json({ title: 'InternalError', detail: 'Falló' }, { status: 500 })
      })
    )

    renderDetail(ACTIVE.placeId)

    expect(await screen.findByRole('alert')).toHaveTextContent('Falló')
    screen.getByRole('button', { name: 'Reintentar' }).click()

    await screen.findByRole('alert')
    expect(callCount).toBeGreaterThan(1)
  })
})
