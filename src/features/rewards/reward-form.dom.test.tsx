import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_PLACES } from '@/shared/mocks/seed'
import { RewardForm } from './reward-form'
import { SEED_BUSINESS } from '@/shared/mocks/seed'

const navigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigate }
})

function renderRewardForm(defaultPlaceId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RewardForm businessId={SEED_BUSINESS.id} defaultPlaceId={defaultPlaceId} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function typeIn(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Publicar recompensa' }))
}

function fillRequired() {
  typeIn('Título', '2x1 en café de especialidad')
  typeIn('Descripción', 'Llevá dos cafés pagando uno, de lunes a jueves.')
  typeIn('Costo en GeoPoints', '100')
  typeIn('Valor estimado (COP)', '15000')
}

/** Captura el body del POST y el id que el mock inventa, para inspeccionarlos. */
function captureCreate() {
  const captured: { body?: Record<string, unknown>; rewardId?: string } = {}
  server.use(
    http.post(
      `${API_BASE_URL}/portal/businesses/${SEED_BUSINESS.id}/rewards`,
      async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>
        captured.rewardId = crypto.randomUUID()
        return HttpResponse.json({ rewardId: captured.rewardId }, { status: 201 })
      }
    )
  )
  return captured
}

describe('RewardForm', () => {
  /**
   * El formulario declara en voz alta los campos que no puede ofrecer. Un
   * negocio que leyó la documentación del producto va a buscar el selector
   * de tipo de recompensa; no encontrarlo sin explicación se siente como un
   * error de la aplicación en vez de una función pendiente.
   */
  it('avisa que faltan campos que el backend todavía no tiene', () => {
    renderRewardForm()

    expect(screen.getByText('Campos que todavía no están disponibles')).toBeInTheDocument()
    expect(screen.getByText(/tipo de recompensa/)).toBeInTheDocument()
  })

  it('no ofrece los campos inexistentes como si funcionaran', () => {
    renderRewardForm()

    expect(screen.queryByLabelText(/Tipo de recompensa/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/General/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Vigencia/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Términos/)).not.toBeInTheDocument()
  })

  it('no ofrece un selector de ítem de menú, que apuntaría a una entidad inexistente', () => {
    renderRewardForm()

    expect(screen.queryByLabelText(/men[úu]/i)).not.toBeInTheDocument()
  })

  /**
   * Publish-on-create (real-backend-readiness #204): el backend crea la
   * recompensa directamente en `Published`, sin un paso de borrador
   * intermedio. El CTA lo dice y no queda ningún rastro de la copia de
   * borrador que citaba un flujo que el backend nunca implementó.
   */
  it('ofrece publicar directamente, sin ningún rastro de la copia de borrador', () => {
    renderRewardForm()

    expect(screen.getByRole('button', { name: 'Publicar recompensa' })).toBeInTheDocument()
    expect(screen.queryByText(/borrador/i)).not.toBeInTheDocument()
  })

  it('exige título, descripción, costo y valor', async () => {
    renderRewardForm()

    submit()

    expect((await screen.findAllByText('Este campo es obligatorio')).length).toBeGreaterThanOrEqual(
      2
    )
  })

  it('rechaza un costo en GeoPoints de cero', async () => {
    renderRewardForm()

    fillRequired()
    typeIn('Costo en GeoPoints', '0')
    submit()

    expect(await screen.findByText('El costo tiene que ser mayor a cero')).toBeInTheDocument()
  })

  it('acepta un valor estimado de cero, que es legítimo para algo gratuito', async () => {
    const captured = captureCreate()
    renderRewardForm()

    fillRequired()
    typeIn('Valor estimado (COP)', '0')
    submit()

    await waitFor(() => expect(captured.body).toBeDefined())
    expect(captured.body?.estimatedValueCop).toBe(0)
  })

  /**
   * El caso central de #41. Un stock vacío significa **ilimitado**, y el
   * backend lo representa como `null`. Un `<input type="number">` vacío
   * entrega `NaN` con `valueAsNumber`, así que sin normalizarlo el `POST`
   * saldría con `NaN` y fallaría con un error que no tendría nada que ver
   * con lo que el usuario hizo.
   */
  it('manda el stock vacío como null, no como NaN ni como cero', async () => {
    const captured = captureCreate()
    renderRewardForm()

    fillRequired()
    submit()

    await waitFor(() => expect(captured.body).toBeDefined())
    expect(captured.body?.stockTotal).toBeNull()
  })

  it('manda el stock escrito como número', async () => {
    const captured = captureCreate()
    renderRewardForm()

    fillRequired()
    typeIn('Stock (opcional)', '25')
    submit()

    await waitFor(() => expect(captured.body).toBeDefined())
    expect(captured.body?.stockTotal).toBe(25)
  })

  it('rechaza un stock de cero: sin límite se expresa dejándolo vacío', async () => {
    renderRewardForm()

    fillRequired()
    typeIn('Stock (opcional)', '0')
    submit()

    expect(
      await screen.findByText('El stock tiene que ser mayor a cero, o vacío para ilimitado')
    ).toBeInTheDocument()
  })

  /**
   * Sin lugar seleccionado la recompensa vale en todos. El backend lo
   * representa con `null`, no con cadena vacía.
   */
  it('manda placeId en null cuando no se elige ningún lugar', async () => {
    const captured = captureCreate()
    renderRewardForm()

    fillRequired()
    submit()

    await waitFor(() => expect(captured.body).toBeDefined())
    expect(captured.body?.placeId).toBeNull()
  })

  it('preselecciona el lugar cuando se entra con uno dado', async () => {
    const captured = captureCreate()
    renderRewardForm(SEED_PLACES[0].placeId)

    fillRequired()
    submit()

    await waitFor(() => expect(captured.body).toBeDefined())
    expect(captured.body?.placeId).toBe(SEED_PLACES[0].placeId)
  })

  it('ofrece los lugares del negocio como opciones', async () => {
    renderRewardForm()

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Lugar (opcional)' })).toBeEnabled()
    )
    fireEvent.click(screen.getByRole('combobox', { name: 'Lugar (opcional)' }))

    expect(screen.getByRole('option', { name: SEED_PLACES[0].name })).toBeInTheDocument()
  })

  /**
   * Publish-on-create (real-backend-readiness #204): tras publicar, el
   * dueño va directo al detalle de SU recompensa recién creada, no a la
   * lista genérica — es donde puede subirle una imagen a continuación.
   */
  it('navega al detalle de la recompensa recién publicada, marcando que acaba de publicarla', async () => {
    const captured = captureCreate()
    renderRewardForm()

    fillRequired()
    submit()

    await waitFor(() => expect(captured.rewardId).toBeDefined())
    expect(navigate).toHaveBeenCalledWith(`/recompensas/${captured.rewardId}`, {
      state: { justPublished: true },
    })
  })

  it('muestra el error del backend cuando el alta falla', async () => {
    server.use(
      http.post(`${API_BASE_URL}/portal/businesses/${SEED_BUSINESS.id}/rewards`, () =>
        HttpResponse.json(
          { title: 'Validation.Failed', detail: 'Title must not be empty.' },
          { status: 400 }
        )
      )
    )
    renderRewardForm()

    fillRequired()
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Title must not be empty.')
  })

  it('vuelve al listado al cancelar, sin enviar nada', () => {
    let posted = false
    server.use(
      http.post(`${API_BASE_URL}/portal/businesses/${SEED_BUSINESS.id}/rewards`, () => {
        posted = true
        return HttpResponse.json({ rewardId: crypto.randomUUID() }, { status: 201 })
      })
    )
    renderRewardForm()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(navigate).toHaveBeenCalledWith('/recompensas')
    expect(posted).toBe(false)
  })
})
