import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_PLACES } from '@/shared/mocks/seed'
import { useToastStore } from '@/shared/stores/toast-store'
import { PublishPlaceAction } from './publish-place-action'
import type { BusinessPlaceDetail } from '@/shared/schemas/business-place'

const DRAFT_WITH_PHOTO: BusinessPlaceDetail = {
  ...SEED_PLACES[1],
  status: 'Draft',
  photos: ['https://cdn.example/a.jpg'],
}
const DRAFT_NO_PHOTO: BusinessPlaceDetail = { ...SEED_PLACES[1], status: 'Draft', photos: [] }

function renderAction(place: BusinessPlaceDetail) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PublishPlaceAction place={place} />
    </QueryClientProvider>
  )
}

describe('PublishPlaceAction', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('permite publicar un borrador que ya tiene foto', () => {
    renderAction(DRAFT_WITH_PHOTO)

    expect(screen.getByRole('button', { name: 'Publicar lugar' })).toBeEnabled()
  })

  /**
   * Un `disabled` sin motivo obliga al usuario a adivinar qué le falta. El
   * backend rechazaría con 409 `Place.ActiveRequiresAtLeastOnePhoto`, así que
   * el bloqueo se explica antes de que llegue a intentarlo.
   */
  it('bloquea el botón sin fotos Y explica por qué', () => {
    renderAction(DRAFT_NO_PHOTO)

    expect(screen.getByRole('button', { name: 'Publicar lugar' })).toBeDisabled()
    expect(screen.getByText('Para publicar hace falta al menos una foto.')).toBeInTheDocument()
  })

  /**
   * ⚠️ Un lugar `Paused` SÍ se puede publicar. `Place.Activate` del backend
   * rechaza exactamente dos estados —`Deleted` y `Active`— y su propio
   * docstring dice que `BusinessReactivatedEventDispatcher` reutiliza ese
   * método precisamente sobre lugares `Paused`.
   *
   * La condición del cliente exigía `Draft`, así que deshabilitaba el botón
   * para una acción que el servidor habría aceptado: un negocio cuyo lugar
   * quedó pausado —por la cascada de RN-BIZ-04, por ejemplo— no tenía forma
   * de volver a publicarlo. Ser MÁS estricto que el servidor esconde una
   * acción legítima, que es peor que no chequear nada.
   */
  it('permite publicar un lugar Paused que tiene foto', () => {
    renderAction({ ...DRAFT_WITH_PHOTO, status: 'Paused' })

    expect(screen.getByRole('button', { name: 'Publicar lugar' })).toBeEnabled()
  })

  it('bloquea un Paused sin fotos Y explica por qué, sin dejarlo mudo', () => {
    renderAction({ ...DRAFT_NO_PHOTO, status: 'Paused' })

    expect(screen.getByRole('button', { name: 'Publicar lugar' })).toBeDisabled()
    expect(screen.getByText('Para publicar hace falta al menos una foto.')).toBeInTheDocument()
  })

  /**
   * Sobre un lugar ya activo el componente no renderiza nada: un botón
   * deshabilitado permanente es ruido, no información.
   */
  it('no se renderiza sobre un lugar ya publicado', () => {
    renderAction({ ...DRAFT_WITH_PHOTO, status: 'Active' })

    expect(screen.queryByRole('button', { name: 'Publicar lugar' })).not.toBeInTheDocument()
  })

  it('no se renderiza sobre un lugar borrado', () => {
    renderAction({ ...DRAFT_WITH_PHOTO, status: 'Deleted' })

    expect(screen.queryByRole('button', { name: 'Publicar lugar' })).not.toBeInTheDocument()
  })

  it('publica y avisa el éxito cuando el negocio está verificado', async () => {
    server.use(
      http.post(`${API_BASE_URL}/business/places/:placeId/publish`, () =>
        HttpResponse.json({ status: 'Active', visibleToExplorers: true })
      )
    )
    renderAction(DRAFT_WITH_PHOTO)

    screen.getByRole('button', { name: 'Publicar lugar' }).click()

    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
        'Lugar publicado'
      )
    )
  })

  /**
   * El caso más interesante del archivo. Un 200 con
   * `visibleToExplorers: false` es un éxito **parcial**: el lugar quedó
   * activo pero nadie lo ve, porque el negocio todavía no está verificado.
   * Avisarlo como éxito liso dejaría al negocio esperando check-ins que no
   * van a llegar, sin saber que la pelota está del lado de GeoQuest.
   */
  it('distingue el éxito parcial cuando el lugar queda activo pero invisible', async () => {
    server.use(
      http.post(`${API_BASE_URL}/business/places/:placeId/publish`, () =>
        HttpResponse.json({ status: 'Active', visibleToExplorers: false })
      )
    )
    renderAction(DRAFT_WITH_PHOTO)

    screen.getByRole('button', { name: 'Publicar lugar' }).click()

    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1))
    const [toast] = useToastStore.getState().toasts
    expect(toast.message).toMatch(/todavía no visible para los exploradores/)
    expect(toast.variant).not.toBe('success')
  })

  it('traduce el 409 de falta de foto en vez de mostrar el detail en inglés', async () => {
    server.use(
      http.post(`${API_BASE_URL}/business/places/:placeId/publish`, () =>
        HttpResponse.json(
          {
            title: 'Place.ActiveRequiresAtLeastOnePhoto',
            detail: 'An active Place requires at least one photo.',
          },
          { status: 409 }
        )
      )
    )
    renderAction(DRAFT_WITH_PHOTO)

    screen.getByRole('button', { name: 'Publicar lugar' }).click()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se puede publicar sin al menos una foto.'
    )
  })

  it('traduce el 409 de lugar ya activo', async () => {
    server.use(
      http.post(`${API_BASE_URL}/business/places/:placeId/publish`, () =>
        HttpResponse.json(
          { title: 'Place.AlreadyActive', detail: 'The Place is already active.' },
          { status: 409 }
        )
      )
    )
    renderAction(DRAFT_WITH_PHOTO)

    screen.getByRole('button', { name: 'Publicar lugar' }).click()

    expect(await screen.findByRole('alert')).toHaveTextContent('Este lugar ya estaba publicado.')
  })

  it('cae al mensaje genérico ante un error que no es de precondición', async () => {
    server.use(
      http.post(`${API_BASE_URL}/business/places/:placeId/publish`, () =>
        HttpResponse.text('boom', { status: 500 })
      )
    )
    renderAction(DRAFT_WITH_PHOTO)

    screen.getByRole('button', { name: 'Publicar lugar' }).click()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos publicar el lugar.')
  })
})
