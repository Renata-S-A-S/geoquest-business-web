import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { PlaceForm } from './place-form'

const navigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigate }
})

function renderPlaceForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PlaceForm />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function typeIn(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function pickCategory(label: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Categoría' }))
  fireEvent.click(screen.getByRole('option', { name: label }))
}

function pickSubcategory(label: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Subcategoría' }))
  fireEvent.click(screen.getByRole('option', { name: label }))
}

/**
 * El botón dice «Guardar borrador», no «Crear lugar» (#34): el alta crea
 * SIEMPRE un borrador, y nombrarlo así evita que el negocio crea que ya
 * quedó publicado. La publicación es una acción aparte, en el detalle.
 */
function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
}

/** Llena todo el formulario con datos válidos. */
function fillValidForm() {
  typeIn('Nombre del lugar', 'Café de la 70 — Sede Estadio')
  typeIn('Descripción', 'Sede nueva sobre la 70.')
  pickCategory('Gastronomía')
  pickSubcategory('Café')
  typeIn('Latitud', '6.253')
  typeIn('Longitud', '-75.588')
}

describe('PlaceForm', () => {
  it('no expone ningún campo de puntos — ADR-041/043 pide eliminarlo, no cambiar su default', () => {
    renderPlaceForm()

    expect(screen.queryByLabelText(/XP/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/GeoPoints/i)).not.toBeInTheDocument()
  })

  it('precarga el radio de check-in en 100 metros (#33)', () => {
    renderPlaceForm()

    expect(screen.getByLabelText('Radio de check-in (metros)')).toHaveValue(100)
  })

  it('deja la subcategoría deshabilitada hasta que haya una categoría elegida', () => {
    renderPlaceForm()

    expect(screen.getByRole('combobox', { name: 'Subcategoría' })).toBeDisabled()
  })

  it('ofrece solo las subcategorías de la categoría elegida', async () => {
    renderPlaceForm()

    pickCategory('Gastronomía')
    fireEvent.click(screen.getByRole('combobox', { name: 'Subcategoría' }))

    expect(screen.getByRole('option', { name: 'Café' })).toBeInTheDocument()
    // `Hotel` pertenece a Alojamiento: ofrecerlo dejaría armar un par que el
    // backend rechaza con 400 `Place.InvalidTaxonomy`.
    expect(screen.queryByRole('option', { name: 'Hotel' })).not.toBeInTheDocument()
  })

  /**
   * El caso más importante del archivo. Sin el reset, cambiar de categoría
   * dejaría seleccionada una subcategoría de la anterior, y el submit se
   * iría con un par inválido que el servidor rechaza — un error que el
   * usuario no puede entender porque el formulario se lo mostró como válido.
   */
  it('resetea la subcategoría al cambiar de categoría', async () => {
    renderPlaceForm()

    pickCategory('Gastronomía')
    pickSubcategory('Café')

    expect(screen.getByRole('combobox', { name: 'Subcategoría' })).toHaveTextContent('Café')

    pickCategory('Alojamiento')

    expect(screen.getByRole('combobox', { name: 'Subcategoría' })).toHaveTextContent(
      'Elegí una subcategoría'
    )
  })

  it('exige la descripción, que el backend valida como obligatoria', async () => {
    renderPlaceForm()

    typeIn('Nombre del lugar', 'Sin descripción')
    submit()

    expect((await screen.findAllByText('Este campo es obligatorio')).length).toBeGreaterThan(0)
  })

  it('rechaza una latitud fuera de rango con su mensaje propio', async () => {
    renderPlaceForm()

    typeIn('Latitud', '91')
    submit()

    expect(await screen.findByText('La latitud va entre -90 y 90')).toBeInTheDocument()
  })

  it('rechaza un radio por debajo del mínimo del backend', async () => {
    renderPlaceForm()

    typeIn('Radio de check-in (metros)', '49')
    submit()

    expect(await screen.findByText('El radio va entre 50 y 1000 metros')).toBeInTheDocument()
  })

  /**
   * El par de casos que justifica `valueAsNumber` sobre `z.coerce.number()`.
   *
   * Con `coerce`, `Number('')` es `0`. Para la latitud eso es un desastre
   * silencioso porque **`0` está dentro de su rango válido**: el campo vacío
   * pasaría la validación sin un solo error y el backend recibiría una
   * coordenada en el Golfo de Guinea. Con `valueAsNumber` el vacío llega
   * como `NaN` y `z.number()` lo rechaza.
   *
   * El primer caso fija que vacío se rechaza; el segundo, que un cero
   * ESCRITO a propósito sí se acepta — porque cero es una latitud legítima y
   * confundir las dos cosas es el error opuesto.
   */
  it('rechaza una latitud vacía en vez de tomarla como cero', async () => {
    let posted = false
    server.use(
      http.post(`${API_BASE_URL}/business/places`, () => {
        posted = true
        return HttpResponse.json({ placeId: crypto.randomUUID() }, { status: 201 })
      })
    )
    renderPlaceForm()

    typeIn('Nombre del lugar', 'Sin latitud')
    typeIn('Descripción', 'Prueba.')
    pickCategory('Gastronomía')
    pickSubcategory('Café')
    typeIn('Longitud', '-75.588')
    submit()

    // La aserción fuerte es que NO se envía nada. Con `z.coerce.number()` el
    // vacío se habría vuelto 0, que es una latitud válida, y este POST
    // habría salido sin un solo error visible.
    expect(await screen.findByLabelText('Latitud')).toBeInvalid()
    expect(posted).toBe(false)
  })

  it('acepta un cero ESCRITO como latitud válida, sin confundirlo con vacío', async () => {
    let received: Record<string, unknown> | undefined
    server.use(
      http.post(`${API_BASE_URL}/business/places`, async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ placeId: crypto.randomUUID() }, { status: 201 })
      })
    )
    renderPlaceForm()

    fillValidForm()
    typeIn('Latitud', '0')
    submit()

    await waitFor(() => expect(received).toBeDefined())
    expect(received?.latitude).toBe(0)
  })

  it('trata el radio vacío como obligatorio', async () => {
    renderPlaceForm()

    typeIn('Radio de check-in (metros)', '')
    submit()

    expect((await screen.findAllByText('Este campo es obligatorio')).length).toBeGreaterThan(0)
  })

  it('envía el alta y navega al listado en éxito', async () => {
    let received: Record<string, unknown> | undefined
    server.use(
      http.post(`${API_BASE_URL}/business/places`, async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ placeId: crypto.randomUUID() }, { status: 201 })
      })
    )
    renderPlaceForm()

    fillValidForm()
    submit()

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/lugares'))
    expect(received).toMatchObject({
      name: 'Café de la 70 — Sede Estadio',
      category: 0,
      subcategory: 1,
      latitude: 6.253,
      longitude: -75.588,
      checkInRadiusMeters: 100,
    })
  })

  it('manda las coordenadas como números, no como texto', async () => {
    let received: Record<string, unknown> | undefined
    server.use(
      http.post(`${API_BASE_URL}/business/places`, async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ placeId: crypto.randomUUID() }, { status: 201 })
      })
    )
    renderPlaceForm()

    fillValidForm()
    submit()

    await waitFor(() => expect(received).toBeDefined())
    expect(typeof received?.latitude).toBe('number')
    expect(typeof received?.longitude).toBe('number')
    expect(typeof received?.category).toBe('number')
  })

  it('muestra el mensaje específico cuando el servidor rechaza la taxonomía', async () => {
    server.use(
      http.post(`${API_BASE_URL}/business/places`, () =>
        HttpResponse.json({ title: 'Place.InvalidTaxonomy' }, { status: 400 })
      )
    )
    renderPlaceForm()

    fillValidForm()
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esa subcategoría no pertenece a la categoría elegida.'
    )
  })

  it('muestra el `detail` del backend cuando lo manda, que es su mensaje para humanos', async () => {
    server.use(
      http.post(`${API_BASE_URL}/business/places`, () =>
        HttpResponse.json(
          { title: 'Validation.Failed', detail: 'Description must not be empty.' },
          { status: 400 }
        )
      )
    )
    renderPlaceForm()

    fillValidForm()
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Description must not be empty.')
  })

  it('cae al mensaje traducido cuando el cuerpo del error no es problem+json', async () => {
    server.use(
      http.post(`${API_BASE_URL}/business/places`, () => HttpResponse.text('boom', { status: 500 }))
    )
    renderPlaceForm()

    fillValidForm()
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos crear el lugar.')
  })

  it('vuelve al listado al cancelar, sin enviar nada', async () => {
    let posted = false
    server.use(
      http.post(`${API_BASE_URL}/business/places`, () => {
        posted = true
        return HttpResponse.json({ placeId: crypto.randomUUID() }, { status: 201 })
      })
    )
    renderPlaceForm()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(navigate).toHaveBeenCalledWith('/lugares')
    expect(posted).toBe(false)
  })
})
