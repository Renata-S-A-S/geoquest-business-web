import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_PLACES } from '@/shared/mocks/seed'
import { PlacesPage } from './places-page'

function renderPlacesPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PlacesPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('PlacesPage', () => {
  it('muestra el estado de carga mientras la consulta está pendiente', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/me/places`, () => new Promise<never>(() => {}))
    )

    renderPlacesPage()

    expect(await screen.findByRole('status')).toHaveTextContent('Cargando tus lugares…')
  })

  it('renderiza los lugares sembrados cuando la consulta resuelve', async () => {
    renderPlacesPage()

    expect((await screen.findAllByText(SEED_PLACES[0].name)).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(SEED_PLACES[1].name).length).toBeGreaterThanOrEqual(1)
  })

  /**
   * `DataTable` auto-renderiza la columna de `statusField` como
   * `StatusBadge` SIN pasarle `label`, o sea que mostraría el literal del
   * enum (`Draft`) tal cual viene del backend. Estos dos casos fijan que la
   * columna traiga su propio `render` para traducirlo: sin eso, el negocio
   * veía «Draft» en una interfaz en español.
   */
  it('traduce el estado del lugar en vez de mostrar el literal del enum', async () => {
    renderPlacesPage()

    expect((await screen.findAllByText('Activo')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Borrador').length).toBeGreaterThanOrEqual(1)
  })

  it('no muestra el literal crudo del enum en ninguna parte', async () => {
    renderPlacesPage()

    await screen.findAllByText('Activo')
    expect(screen.queryByText('Draft')).not.toBeInTheDocument()
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
  })

  it('muestra el estado vacío con el CTA de crear cuando el negocio no tiene lugares', async () => {
    server.use(http.get(`${API_BASE_URL}/business/me/places`, () => HttpResponse.json([])))

    renderPlacesPage()

    expect(await screen.findByText('Todavía no hay ningún lugar')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Crear lugar' }).length).toBeGreaterThanOrEqual(1)
  })

  /**
   * El CTA del encabezado NO es redundante con el del estado vacío: sin
   * él, un negocio que ya tiene un lugar no tendría por dónde crear el
   * segundo.
   */
  it('mantiene el CTA de crear visible cuando la lista YA tiene lugares', async () => {
    renderPlacesPage()

    await screen.findAllByText(SEED_PLACES[0].name)
    expect(screen.getByRole('link', { name: 'Crear lugar' })).toHaveAttribute(
      'href',
      '/lugares/nuevo'
    )
  })

  it('muestra el `detail` del backend y permite reintentar cuando falla', async () => {
    let callCount = 0
    server.use(
      http.get(`${API_BASE_URL}/business/me/places`, () => {
        callCount += 1
        return HttpResponse.json(
          { title: 'InternalError', detail: 'No pudimos consultar los lugares' },
          { status: 500 }
        )
      })
    )

    renderPlacesPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos consultar los lugares')
    expect(callCount).toBe(1)

    screen.getByRole('button', { name: 'Reintentar' }).click()

    await screen.findByRole('alert')
    expect(callCount).toBeGreaterThan(1)
  })

  /**
   * `getProblemDetailsMessage` prioriza `detail` y cae al `fallback` cuando
   * el cuerpo no es un problem+json parseable. Este caso fija que el
   * fallback de esta pantalla sea el mensaje traducido, y no algo críptico
   * salido del transporte.
   */
  it('cae al mensaje traducido cuando el cuerpo del error no es problem+json', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/me/places`, () =>
        HttpResponse.text('boom', { status: 500 })
      )
    )

    renderPlacesPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus lugares.')
  })

  it('ya no renderiza el placeholder de ruta', async () => {
    renderPlacesPage()

    await screen.findAllByText(SEED_PLACES[0].name)
    expect(screen.queryByText('lugares — pendiente')).not.toBeInTheDocument()
  })
})
