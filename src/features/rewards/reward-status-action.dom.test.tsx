import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS, SEED_REWARDS } from '@/shared/mocks/seed'
import { useToastStore } from '@/shared/stores/toast-store'
import type { BusinessRewardSummary } from '@/shared/schemas/business-reward'
import { RewardStatusAction } from './reward-status-action'

const businessId = SEED_BUSINESS.id
const base = SEED_REWARDS[0]

function reward(overrides: Partial<BusinessRewardSummary> = {}): BusinessRewardSummary {
  return { ...base, ...overrides }
}

function actionUrl(action: 'pause' | 'republish', rewardId = base.rewardId) {
  return `${API_BASE_URL}/portal/businesses/${businessId}/rewards/${rewardId}/${action}`
}

function renderAction(value: BusinessRewardSummary) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RewardStatusAction businessId={businessId} reward={value} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function toasts() {
  return useToastStore.getState().toasts.map((toast) => toast.message)
}

/**
 * El componente recibe la recompensa por prop, pero el handler compartido lee
 * la db mock — donde la semilla sigue `Published`. Para probar la COPIA de
 * republicar hay que dejar que la transición salga bien; que el servidor la
 * rechace desde el estado equivocado ya está cubierto en
 * `api/pause-reward.test.ts`.
 */
function allowRepublish() {
  server.use(http.post(actionUrl('republish'), () => new HttpResponse(null, { status: 204 })))
}

beforeEach(() => useToastStore.setState({ toasts: [] }))

describe('RewardStatusAction', () => {
  // ---- Qué se ofrece, según el estado ----

  /**
   * Replica los guards del servidor EXACTO (`Reward.cs:268-300`). Los casos
   * POSITIVOS importan tanto como los negativos: ser más estricto que el
   * servidor esconde acciones válidas, que es el bug que tuvo
   * `canPublishPlace`.
   */
  it('ofrece pausar una recompensa publicada', () => {
    renderAction(reward({ status: 'Published' }))

    expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Republicar' })).not.toBeInTheDocument()
  })

  it('ofrece pausar una recompensa AGOTADA, igual que el servidor', () => {
    renderAction(reward({ status: 'Exhausted', stockRemaining: 0 }))

    expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument()
  })

  it('ofrece republicar una recompensa pausada', () => {
    renderAction(reward({ status: 'Paused' }))

    expect(screen.getByRole('button', { name: 'Republicar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pausar' })).not.toBeInTheDocument()
  })

  /**
   * «No un botón gris y mudo»: cuando ninguna transición es posible por estado,
   * no se renderiza NADA. Mismo criterio que `PublishPlaceAction`.
   */
  it.each(['Draft', 'Archived'] as const)('no renderiza nada en %s', (status) => {
    const { container } = renderAction(reward({ status }))

    expect(container).toBeEmptyDOMElement()
  })

  // ---- El caso central de #111: el éxito PARCIAL ----

  /**
   * Republicar una recompensa sin stock la deja `Exhausted`, no `Published`
   * (`Reward.cs:298`), y el 204 sin body no lo dice. Si la interfaz dijera
   * "republicada" mientras el badge muestra "Agotada", el negocio pensaría que
   * algo falló.
   */
  it('avisa ANTES que republicar sin stock la va a dejar agotada', () => {
    renderAction(reward({ status: 'Paused', stockTotal: 50, stockRemaining: 0 }))

    expect(screen.getByText(/republicarla la va a dejar AGOTADA/)).toBeInTheDocument()
  })

  it('avisa DESPUÉS que quedó agotada, en vez de decir solo "republicada"', async () => {
    allowRepublish()
    renderAction(reward({ status: 'Paused', stockTotal: 50, stockRemaining: 0 }))

    fireEvent.click(screen.getByRole('button', { name: 'Republicar' }))

    await waitFor(() => expect(toasts().length).toBeGreaterThan(0))
    expect(toasts()[0]).toContain('quedó AGOTADA')
    expect(toasts()[0]).not.toBe('Recompensa republicada: los exploradores ya pueden canjearla')
  })

  it('con stock disponible dice republicada, sin la advertencia', async () => {
    allowRepublish()
    renderAction(reward({ status: 'Paused', stockTotal: 50, stockRemaining: 42 }))

    expect(screen.queryByText(/va a dejar AGOTADA/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Republicar' }))

    await waitFor(() => expect(toasts().length).toBeGreaterThan(0))
    expect(toasts()[0]).toBe('Recompensa republicada: los exploradores ya pueden canjearla')
  })

  /**
   * Una recompensa SIN TOPE nunca cae en `Exhausted`, aunque `stockRemaining`
   * sea `null`: el guard del dominio es `StockTotal is not null && ...`. Tratar
   * `null` como cero prometería un agotamiento imposible.
   */
  it('NO avisa de agotamiento en una recompensa sin tope de stock', async () => {
    allowRepublish()
    renderAction(reward({ status: 'Paused', stockTotal: null, stockRemaining: null }))

    expect(screen.queryByText(/va a dejar AGOTADA/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Republicar' }))

    await waitFor(() => expect(toasts().length).toBeGreaterThan(0))
    expect(toasts()[0]).toBe('Recompensa republicada: los exploradores ya pueden canjearla')
  })

  // ---- Pausar ----

  it('avisa por toast al pausar', async () => {
    renderAction(reward({ status: 'Published' }))

    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))

    await waitFor(() => expect(toasts().length).toBeGreaterThan(0))
    expect(toasts()[0]).toContain('pausada')
  })

  it('explica que pausar una agotada no repone el stock', () => {
    renderAction(reward({ status: 'Exhausted', stockRemaining: 0 }))

    expect(screen.getByText(/No repone el stock/)).toBeInTheDocument()
  })

  /**
   * `SyncStockStatus()` nunca toca `Paused` (`Reward.cs:306-308`), así que
   * reponer stock mientras está pausada NO la despausa. Sin este aviso, un
   * dueño que repone stock esperaría verla publicada de nuevo.
   */
  it('avisa que reponer stock no despausa sola la recompensa', () => {
    renderAction(reward({ status: 'Paused' }))

    expect(screen.getByText(/no la despausa sola/)).toBeInTheDocument()
  })

  // ---- Los errores del servidor ----

  it('traduce el 409 AlreadyPaused y ofrece recargar en el texto', async () => {
    server.use(
      http.post(actionUrl('pause'), () =>
        HttpResponse.json(
          { title: 'Reward.AlreadyPaused', detail: 'This Reward is already Paused.', status: 409 },
          { status: 409 }
        )
      )
    )
    renderAction(reward({ status: 'Published' }))

    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ya estaba pausada')
  })

  it('NO muestra el detail en inglés del backend', async () => {
    server.use(
      http.post(actionUrl('pause'), () =>
        HttpResponse.json(
          { title: 'Reward.AlreadyPaused', detail: 'This Reward is already Paused.', status: 409 },
          { status: 409 }
        )
      )
    )
    renderAction(reward({ status: 'Published' }))

    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))

    const alert = await screen.findByRole('alert')
    expect(alert).not.toHaveTextContent('This Reward is already Paused')
  })

  it('traduce el 409 NotPaused al republicar', async () => {
    server.use(
      http.post(actionUrl('republish'), () =>
        HttpResponse.json({ title: 'Reward.NotPaused', status: 409 }, { status: 409 })
      )
    )
    renderAction(reward({ status: 'Paused' }))

    fireEvent.click(screen.getByRole('button', { name: 'Republicar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Solo se puede republicar una recompensa pausada'
    )
  })

  /**
   * El 403 del negocio tiene mensaje PROPIO: la acción no falló por la
   * recompensa sino por el estado del negocio. Confundirlos manda al dueño a
   * revisar la recompensa cuando el problema está en otra parte.
   */
  it('el 403 BusinessNotActive culpa al negocio, no a la recompensa', async () => {
    server.use(
      http.post(actionUrl('pause'), () =>
        HttpResponse.json({ title: 'RewardPortal.BusinessNotActive', status: 403 }, { status: 403 })
      )
    )
    renderAction(reward({ status: 'Published' }))

    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Tu negocio no está activo')
    expect(alert).toHaveTextContent('La recompensa está bien')
  })

  it('traduce el 409 InvalidStatusTransition', async () => {
    server.use(
      http.post(actionUrl('pause'), () =>
        HttpResponse.json({ title: 'Reward.InvalidStatusTransition', status: 409 }, { status: 409 })
      )
    )
    renderAction(reward({ status: 'Published' }))

    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('no permite esta acción')
  })

  it('no deja disparar dos veces mientras la acción está en curso', async () => {
    let calls = 0
    server.use(
      http.post(actionUrl('pause'), () => {
        calls += 1
        return new Promise<never>(() => {})
      })
    )
    renderAction(reward({ status: 'Published' }))

    const button = screen.getByRole('button', { name: 'Pausar' })
    fireEvent.click(button)

    await waitFor(() => expect(button).toBeDisabled())
    fireEvent.click(button)
    expect(calls).toBe(1)
  })
})
