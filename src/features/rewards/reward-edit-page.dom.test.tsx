import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS, SEED_PLACES, SEED_REWARDS } from '@/shared/mocks/seed'
import { useToastStore } from '@/shared/stores/toast-store'
import { RewardEditPage } from './reward-edit-page'

const businessId = SEED_BUSINESS.id
const published = SEED_REWARDS[0]
const draft = SEED_REWARDS[1]

function url(rewardId: string) {
  return `${API_BASE_URL}/portal/businesses/${businessId}/rewards/${rewardId}`
}

const navigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigate }
})

function renderEdit(rewardId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/recompensas/${rewardId}/editar`]}>
        <Routes>
          <Route path="/recompensas/:rewardId/editar" element={<RewardEditPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
}

/** Captura el body del PUT para inspeccionar que viaje COMPLETO. */
function capturePut(rewardId: string) {
  const captured: { body?: Record<string, unknown> } = {}
  server.use(
    http.put(url(rewardId), async ({ request }) => {
      captured.body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ ...published, ...captured.body })
    })
  )
  return captured
}

describe('RewardEditPage', () => {
  it('precarga TODOS los campos con los valores actuales', async () => {
    renderEdit(published.rewardId)

    expect(await screen.findByLabelText('Título')).toHaveValue(published.title)
    expect(screen.getByLabelText('Descripción')).toHaveValue(published.description)
    expect(screen.getByLabelText('Costo en GeoPoints')).toHaveValue(published.geoPointsCost)
    expect(screen.getByLabelText('Valor estimado (COP)')).toHaveValue(published.estimatedValueCop)
    expect(screen.getByLabelText('Stock (opcional)')).toHaveValue(published.stockTotal)

    // El Select muestra su placeholder hasta que `usePlaces()` resuelve: la
    // etiqueta se busca DENTRO de las opciones, y con la lista vacía no hay
    // nada que mostrar. Hay que esperar a que se habilite.
    const placeSelect = screen.getByRole('combobox', { name: 'Lugar (opcional)' })
    await waitFor(() => expect(placeSelect).toBeEnabled())
    expect(placeSelect).toHaveTextContent(SEED_PLACES[0].name)
  })

  /**
   * El test que justifica todo el diseño de este formulario: el `PUT` es
   * reemplazo total, así que el body tiene que llevar los SIETE campos aunque
   * el usuario haya tocado uno solo. Un patch parcial desvincularía el lugar y
   * el ítem de menú sin avisar.
   */
  it('reenvía el body COMPLETO aunque se cambie un solo campo', async () => {
    const captured = capturePut(published.rewardId)
    renderEdit(published.rewardId)
    await screen.findByLabelText('Título')

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Solo el título' } })
    submit()

    await waitFor(() => expect(captured.body).toBeDefined())
    expect(Object.keys(captured.body ?? {}).sort()).toEqual([
      'description',
      'estimatedValueCop',
      'geoPointsCost',
      'menuItemId',
      'placeId',
      'stockTotal',
      'title',
    ])
    expect(captured.body).toMatchObject({
      title: 'Solo el título',
      placeId: published.placeId,
      description: published.description,
    })
  })

  /**
   * `menuItemId` no tiene campo en el formulario (la entidad no existe en el
   * backend) pero DEBE viajar, porque omitirlo lo borraría. Es el campo
   * invisible, y por eso el más fácil de perder.
   */
  it('reenvía menuItemId aunque no haya campo para editarlo', async () => {
    const captured = capturePut(published.rewardId)
    renderEdit(published.rewardId)
    await screen.findByLabelText('Título')

    submit()

    await waitFor(() => expect(captured.body).toBeDefined())
    expect(captured.body).toHaveProperty('menuItemId', published.menuItemId)
  })

  it('avisa que vaciar el lugar lo DESVINCULA, no lo deja como estaba', async () => {
    renderEdit(published.rewardId)

    expect(await screen.findByText(/se DESVINCULA del lugar/)).toBeInTheDocument()
  })

  it('navega al detalle y avisa por toast al guardar bien', async () => {
    useToastStore.setState({ toasts: [] })
    renderEdit(published.rewardId)
    await screen.findByLabelText('Título')

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Título nuevo' } })
    submit()

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(`/recompensas/${published.rewardId}`))
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
      'Recompensa actualizada'
    )
  })

  it('valida los numéricos con las mismas reglas que el alta', async () => {
    renderEdit(published.rewardId)
    await screen.findByLabelText('Título')

    fireEvent.change(screen.getByLabelText('Costo en GeoPoints'), { target: { value: '0' } })
    submit()

    expect(await screen.findByText('El costo tiene que ser mayor a cero')).toBeInTheDocument()
  })

  /**
   * Un campo numérico vacío llega como `NaN`, no como `0`. Para
   * `estimatedValueCop`, cuyo rango válido incluye el cero, eso es la
   * diferencia entre un error visible y un valor inventado guardado en
   * silencio.
   */
  it('rechaza un valor estimado vacío en vez de mandarlo como cero', async () => {
    const captured = capturePut(published.rewardId)
    renderEdit(published.rewardId)
    await screen.findByLabelText('Título')

    const value = screen.getByLabelText('Valor estimado (COP)')
    fireEvent.change(value, { target: { value: '' } })
    submit()

    // Lo que importa no es el texto exacto del mensaje sino que el campo quede
    // inválido y que el PUT NO salga. Si saliera, `z.coerce.number()` habría
    // convertido el vacío en `0` — un valor legítimo para este campo, y por lo
    // tanto un dato inventado guardado sin un solo error a la vista.
    await waitFor(() => expect(value).toHaveAttribute('aria-invalid', 'true'))
    expect(captured.body).toBeUndefined()
  })

  // ---- Los cuatro errores del servidor ----

  it('el 409 de stock dice CUÁNTAS unidades están comprometidas', async () => {
    renderEdit(published.rewardId)
    await screen.findByLabelText('Título')

    // La semilla tiene 50 totales y 42 restantes: 8 comprometidas.
    fireEvent.change(screen.getByLabelText('Stock (opcional)'), { target: { value: '3' } })
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No podés bajar el stock a menos de 8'
    )
  })

  /**
   * El mensaje traducido tiene que GANARLE al `detail` en inglés del backend.
   * `getProblemDetailsMessage` resuelve `detail ?? title ?? fallback`, así que
   * pasarlo por el fallback mostraría el texto en inglés.
   */
  it('NO muestra el detail en inglés del backend en el 409 de stock', async () => {
    renderEdit(published.rewardId)
    await screen.findByLabelText('Título')

    fireEvent.change(screen.getByLabelText('Stock (opcional)'), { target: { value: '3' } })
    submit()

    const alert = await screen.findByRole('alert')
    expect(alert).not.toHaveTextContent('cannot be lower than the units already committed')
  })

  it('un 409 de concurrencia ofrece RECARGAR, no reintentar a ciegas', async () => {
    server.use(
      http.put(url(published.rewardId), () =>
        HttpResponse.json(
          {
            title: 'Reward.ConcurrencyConflict',
            detail: 'This Reward was modified concurrently. Reload and try again.',
            status: 409,
          },
          { status: 409 }
        )
      )
    )
    renderEdit(published.rewardId)
    await screen.findByLabelText('Título')

    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Alguien más guardó cambios')
    expect(screen.getByRole('button', { name: 'Recargar y volver a empezar' })).toBeInTheDocument()
  })

  it('NO ofrece recargar en un error que no es de concurrencia', async () => {
    server.use(
      http.put(url(published.rewardId), () =>
        HttpResponse.json({ title: 'Reward.NotEditable', status: 409 }, { status: 409 })
      )
    )
    renderEdit(published.rewardId)
    await screen.findByLabelText('Título')

    submit()

    await screen.findByRole('alert')
    expect(
      screen.queryByRole('button', { name: 'Recargar y volver a empezar' })
    ).not.toBeInTheDocument()
  })

  it('el 403 de negocio no activo culpa al negocio, no a la recompensa', async () => {
    server.use(
      http.put(url(published.rewardId), () =>
        HttpResponse.json({ title: 'RewardPortal.BusinessNotActive', status: 403 }, { status: 403 })
      )
    )
    renderEdit(published.rewardId)
    await screen.findByLabelText('Título')

    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Tu negocio no está activo')
  })

  // ---- El gate por estado ----

  /**
   * Una recompensa en `Draft` no es editable (`Reward.cs:205`), y el alta del
   * portal las deja justamente ahí. En vez de montar un formulario que falla
   * recién al enviar, se explica el motivo — mismo criterio que
   * `PublishPlaceAction`.
   */
  it('no monta el formulario cuando el estado no permite editar, y explica por qué', async () => {
    renderEdit(draft.rewardId)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta recompensa está Borrador, y en ese estado el servidor no acepta cambios.'
    )
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al detalle' })).toBeInTheDocument()
  })

  it('SÍ permite editar una recompensa agotada, igual que el servidor', async () => {
    server.use(
      http.get(url(published.rewardId), () =>
        HttpResponse.json({ ...published, status: 'Exhausted', stockRemaining: 0 })
      )
    )

    renderEdit(published.rewardId)

    expect(await screen.findByLabelText('Título')).toBeInTheDocument()
  })

  it('SÍ permite editar una recompensa pausada, igual que el servidor', async () => {
    server.use(
      http.get(url(published.rewardId), () => HttpResponse.json({ ...published, status: 'Paused' }))
    )

    renderEdit(published.rewardId)

    expect(await screen.findByLabelText('Título')).toBeInTheDocument()
  })
})
