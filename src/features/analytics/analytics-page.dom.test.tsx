import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS } from '@/shared/mocks/seed'
import { setMockBusiness } from '@/test/mock-business'
import {
  BackendCapabilitiesProvider,
  resolveBackendCapabilities,
  type BackendCapabilities,
} from '@/shared/lib/backend-capabilities'
import { AnalyticsPage } from './analytics-page'

const ANALYTICS_BASE = `${API_BASE_URL}/portal/businesses/${SEED_BUSINESS.id}/analytics`

function renderAnalyticsPage(capabilities?: BackendCapabilities) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <BackendCapabilitiesProvider value={capabilities}>
          <AnalyticsPage />
        </BackendCapabilitiesProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

/**
 * Real mode (`capabilities.analytics === false`, #1550): el dashboard entero
 * — cascada de negocio + resumen + serie — se reemplaza por una tarjeta
 * "Próximamente" ANTES de disparar cualquier query. `real-backend-readiness`
 * #1550 amienda el design original (que borraba analytics por completo): el
 * dashboard, su API, sus mocks y sus tests se conservan intactos para cuando
 * `Renata-S-A-S/geoquest#205` exista — solo se oculta detrás de la capacidad.
 */
describe('AnalyticsPage — modo real (capability analytics=false)', () => {
  it('muestra la tarjeta "Próximamente" con links a Lugares/Recompensas, sin pedir ninguna métrica', async () => {
    let summaryRequests = 0
    let businessRequests = 0
    server.use(
      http.get(`${ANALYTICS_BASE}/summary`, () => {
        summaryRequests += 1
        return new HttpResponse(null, { status: 500 })
      }),
      http.get(`${API_BASE_URL}/business/mine`, () => {
        businessRequests += 1
        return new HttpResponse(null, { status: 500 })
      })
    )

    renderAnalyticsPage(resolveBackendCapabilities('real'))

    expect(await screen.findByText('Muy pronto')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lugares' })).toHaveAttribute('href', '/lugares')
    expect(screen.getByRole('link', { name: 'Recompensas' })).toHaveAttribute(
      'href',
      '/recompensas'
    )
    expect(screen.queryByRole('heading', { name: 'Analytics', level: 1 })).not.toBeInTheDocument()

    // Nada de negocio ni de métricas: el gate corta ANTES del primer request.
    expect(summaryRequests).toBe(0)
    expect(businessRequests).toBe(0)
  })
})

describe('AnalyticsPage — modo mock (capability analytics=true, comportamiento sin cambios)', () => {
  it('muestra el estado de carga mientras el resumen está pendiente', async () => {
    server.use(http.get(`${ANALYTICS_BASE}/summary`, () => new Promise<never>(() => {})))

    renderAnalyticsPage(resolveBackendCapabilities('mock'))

    expect(await screen.findByRole('status')).toHaveTextContent('Cargando tus métricas…')
  })

  it('renderiza el dashboard contra los handlers MSW reales cuando todo resuelve', async () => {
    renderAnalyticsPage(resolveBackendCapabilities('mock'))

    expect(await screen.findByRole('heading', { name: 'Analytics', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Renata-S-A-S/geoquest#205')
    expect(screen.getByRole('combobox', { name: 'Período' })).toHaveTextContent('Últimos 30 días')
  })

  /**
   * La cascada es real: los endpoints propuestos llevan `{businessId}` en el
   * path y el portal lo resuelve leyendo `GET /business/mine`. Si esa lectura
   * falla, no hay métricas que pedir — y el mensaje tiene que decir ESO, porque
   * manda a revisar algo distinto que un fallo de analytics.
   */
  it('distingue el error de identificar el negocio del error de cargar las métricas', async () => {
    server.use(
      // 500 con cuerpo vacío, no 401: un 401 dispara el interceptor de
      // refresh-y-reintento de `session-interceptor.ts` y el test dejaría de
      // probar el fork de error de la pantalla para probar esa otra máquina.
      http.get(`${API_BASE_URL}/business/mine`, () => new HttpResponse(null, { status: 500 }))
    )

    renderAnalyticsPage(resolveBackendCapabilities('mock'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos identificar tu negocio, así que tampoco sus métricas.'
    )
  })

  /**
   * `useMyBusiness()` resuelve con éxito y `data === null` cuando
   * `/business/mine` devuelve `[]` (sin negocio propio,
   * real-backend-readiness PR6b) — un caso que `useBusinessMe()` no podía
   * representar. Sin la rama dedicada, `summaryQuery`/`checkInsQuery`
   * quedarían `enabled: false` para siempre y la pantalla se quedaría en
   * «Cargando…» eternamente.
   */
  it('muestra el mismo error cuando el explorador no tiene negocio propio', async () => {
    setMockBusiness('none')

    renderAnalyticsPage(resolveBackendCapabilities('mock'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos identificar tu negocio, así que tampoco sus métricas.'
    )
  })

  it('muestra el error de métricas con un botón de reintento cuando el resumen falla', async () => {
    server.use(http.get(`${ANALYTICS_BASE}/summary`, () => new HttpResponse(null, { status: 500 })))

    renderAnalyticsPage(resolveBackendCapabilities('mock'))

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus métricas.')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('un fallo solo en la serie también corta: mostrar las tarjetas con la serie vacía diría que no hubo check-ins', async () => {
    server.use(
      http.get(`${ANALYTICS_BASE}/check-ins`, () => new HttpResponse(null, { status: 500 }))
    )

    renderAnalyticsPage(resolveBackendCapabilities('mock'))

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus métricas.')
  })

  it('muestra el `detail` del problem+json del servidor en vez del mensaje genérico cuando viene', async () => {
    server.use(
      http.get(`${ANALYTICS_BASE}/summary`, () =>
        HttpResponse.json(
          {
            title: 'Analytics.InvalidRange',
            detail: 'El rango pedido excede los 90 días permitidos.',
            status: 400,
          },
          { status: 400 }
        )
      )
    )

    renderAnalyticsPage(resolveBackendCapabilities('mock'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El rango pedido excede los 90 días permitidos.'
    )
  })

  it('reintenta las métricas cuando el negocio ya está resuelto y el usuario aprieta Reintentar', async () => {
    let summaryRequests = 0
    server.use(
      http.get(`${ANALYTICS_BASE}/summary`, () => {
        summaryRequests += 1
        return new HttpResponse(null, { status: 500 })
      })
    )

    renderAnalyticsPage(resolveBackendCapabilities('mock'))
    await screen.findByRole('alert')
    expect(summaryRequests).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => expect(summaryRequests).toBe(2))
  })

  /**
   * El período es parte de la pregunta que se le hace al servidor, así que
   * cambiarlo tiene que producir un request nuevo con otro `from`. Si el rango
   * no viajara en la queryKey, este test vería un solo request y la pantalla
   * mostraría 30 días bajo el rótulo «últimos 7 días».
   */
  it('cambiar el período pide el rango nuevo al servidor', async () => {
    const requestedRanges: string[] = []
    server.use(
      http.get(`${ANALYTICS_BASE}/summary`, ({ request }) => {
        requestedRanges.push(String(new URL(request.url).searchParams.get('from')))
        return passthroughSummary()
      })
    )

    renderAnalyticsPage(resolveBackendCapabilities('mock'))
    await screen.findByRole('combobox', { name: 'Período' })
    await waitFor(() => expect(requestedRanges).toHaveLength(1))

    fireEvent.click(screen.getByRole('combobox', { name: 'Período' }))
    fireEvent.click(screen.getByRole('option', { name: 'Últimos 7 días' }))

    await waitFor(() => expect(requestedRanges).toHaveLength(2))
    // La ventana de 7 días arranca después que la de 30: mismo `to`, otro `from`.
    expect(requestedRanges[1] > requestedRanges[0]).toBe(true)
  })
})

/**
 * Reenvía al handler real del mock para no duplicar la construcción del resumen
 * en el test: lo único que este `server.use` agrega es registrar el `from`
 * pedido.
 */
function passthroughSummary() {
  return HttpResponse.json({
    from: '2026-08-26',
    to: '2026-09-24',
    current: {
      checkIns: 10,
      uniqueVisitors: 5,
      redemptions: 1,
      estimatedValueDeliveredCop: 15000,
      averageExperienceRating: 4.5,
    },
    previous: {
      checkIns: 8,
      uniqueVisitors: 4,
      redemptions: 1,
      estimatedValueDeliveredCop: 15000,
      averageExperienceRating: 4.5,
    },
    places: [],
  })
}
