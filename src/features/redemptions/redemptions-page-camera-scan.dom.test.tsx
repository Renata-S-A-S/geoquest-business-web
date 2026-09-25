import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_PURCHASED_QR_TOKEN } from '@/shared/mocks/seed'
import { RedemptionsPage } from './redemptions-page'
import { startQrCameraScanner } from './qr-camera-scanner'

/**
 * Igual que `redemptions-page.dom.test.tsx`: se renderiza el contenedor real
 * contra MSW. Lo único mockeado acá es el adaptador de cámara
 * (`qr-camera-scanner.ts`) — nunca `qr-scanner` en sí, que no corre contra
 * jsdom (canvas, web worker, `getUserMedia` reales).
 */
vi.mock('./qr-camera-scanner', () => ({
  startQrCameraScanner: vi.fn(),
}))

const startQrCameraScannerMock = vi.mocked(startQrCameraScanner)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RedemptionsPage />
    </QueryClientProvider>
  )
}

/**
 * Solo se usa para el caso "no se llamó nunca al backend" — no importa qué
 * responda, porque si el contador queda en 0 la respuesta ni se llega a leer.
 */
function countLookupRequests(): { get: () => number } {
  let calls = 0
  server.use(
    http.post(`${API_BASE_URL}/portal/businesses/:businessId/redemptions/lookup`, () => {
      calls += 1
      return HttpResponse.json({}, { status: 404 })
    })
  )
  return { get: () => calls }
}

describe('RedemptionsPage — escaneo con cámara (#44-#48)', () => {
  beforeEach(() => {
    startQrCameraScannerMock.mockReset()
  })

  it('el botón "Escanear con cámara" abre el modal', async () => {
    startQrCameraScannerMock.mockResolvedValue({ stop: vi.fn() })

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Escanear con cámara' }))

    expect(await screen.findByRole('dialog')).toHaveTextContent('Escaneá el código del cliente')
    await waitFor(() => expect(startQrCameraScannerMock).toHaveBeenCalledTimes(1))
  })

  /**
   * El caso central del pedido: un solo decode válido cierra el modal, para
   * el scanner y dispara EXACTAMENTE una request de lookup — la misma que
   * dispara el pegado manual, no una segunda vía al backend. El contador de
   * requests es lo que realmente prueba la protección del balde de 30
   * req/min compartido (design D8), no solo que la UI se vea bien.
   */
  it('un token válido decodificado cierra el modal, para la cámara y dispara un único lookup', async () => {
    const stop = vi.fn()
    let capturedOnDecode: ((value: string) => void) | undefined
    startQrCameraScannerMock.mockImplementation(async ({ onDecode }) => {
      capturedOnDecode = onDecode
      return { stop }
    })

    let lookupCalls = 0
    server.use(
      http.post(
        `${API_BASE_URL}/portal/businesses/:businessId/redemptions/lookup`,
        async ({ request }) => {
          lookupCalls += 1
          const body = (await request.json()) as { qrToken: string }
          expect(body.qrToken).toBe(SEED_PURCHASED_QR_TOKEN)
          return HttpResponse.json(
            {
              userRewardId: '00000000-0000-0000-0000-000000000010',
              rewardId: '00000000-0000-0000-0000-000000000020',
              rewardTitle: '2x1 en café de especialidad',
              rewardDescription: 'Llevá dos cafés pagando uno, de lunes a jueves.',
              status: 'Earned',
              isRedeemable: true,
              qrExpiresAtUtc: null,
              origin: 'Purchased',
              geoPointsCostSnapshot: 100,
              explorerId: '00000000-0000-0000-0000-0000000000a1',
              explorerUsername: 'ana_explorer',
            },
            { status: 200 }
          )
        }
      )
    )

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Escanear con cámara' }))
    await screen.findByRole('dialog')
    await waitFor(() => expect(capturedOnDecode).toBeDefined())

    capturedOnDecode!(SEED_PURCHASED_QR_TOKEN)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('button', { name: 'Confirmar canje' })).toBeInTheDocument()
    expect(stop).toHaveBeenCalledTimes(1)
    expect(lookupCalls).toBe(1)
  })

  /**
   * Un segundo decode del mismo (u otro) valor tras el primero exitoso no
   * puede generar una segunda request: es exactamente el escenario que
   * agotaría el balde compartido si el scanner siguiera reportando frames
   * mientras la cámara todavía no terminó de apagarse.
   */
  it('un segundo decode tras el primero válido no dispara una segunda request', async () => {
    let capturedOnDecode: ((value: string) => void) | undefined
    startQrCameraScannerMock.mockImplementation(async ({ onDecode }) => {
      capturedOnDecode = onDecode
      return { stop: vi.fn() }
    })

    let lookupCalls = 0
    server.use(
      http.post(`${API_BASE_URL}/portal/businesses/:businessId/redemptions/lookup`, () => {
        lookupCalls += 1
        return HttpResponse.json(
          {
            userRewardId: '00000000-0000-0000-0000-000000000010',
            rewardId: '00000000-0000-0000-0000-000000000020',
            rewardTitle: '2x1 en café de especialidad',
            rewardDescription: 'Llevá dos cafés pagando uno, de lunes a jueves.',
            status: 'Earned',
            isRedeemable: true,
            qrExpiresAtUtc: null,
            origin: 'Purchased',
            geoPointsCostSnapshot: 100,
            explorerId: '00000000-0000-0000-0000-0000000000a1',
            explorerUsername: 'ana_explorer',
          },
          { status: 200 }
        )
      })
    )

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Escanear con cámara' }))
    await screen.findByRole('dialog')
    await waitFor(() => expect(capturedOnDecode).toBeDefined())

    capturedOnDecode!(SEED_PURCHASED_QR_TOKEN)
    capturedOnDecode!(SEED_PURCHASED_QR_TOKEN)

    await screen.findByRole('button', { name: 'Confirmar canje' })
    expect(lookupCalls).toBe(1)
  })

  it('un valor decodificado sin formato de token muestra el aviso y no llama al backend', async () => {
    let capturedOnDecode: ((value: string) => void) | undefined
    startQrCameraScannerMock.mockImplementation(async ({ onDecode }) => {
      capturedOnDecode = onDecode
      return { stop: vi.fn() }
    })
    const { get } = countLookupRequests()

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Escanear con cámara' }))
    await screen.findByRole('dialog')
    await waitFor(() => expect(capturedOnDecode).toBeDefined())

    capturedOnDecode!('https://example.com/no-es-un-canje')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este QR no es un código de canje de GeoQuest'
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(get()).toBe(0)
  })

  it('permiso de cámara denegado muestra el mensaje correspondiente', async () => {
    startQrCameraScannerMock.mockImplementation(async ({ onError }) => {
      onError('permission-denied')
      return null
    })

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Escanear con cámara' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos acceder a la cámara')
  })

  it('sin cámara disponible muestra el mensaje correspondiente', async () => {
    startQrCameraScannerMock.mockImplementation(async ({ onError }) => {
      onError('no-camera')
      return null
    })

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Escanear con cámara' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No encontramos ninguna cámara en este dispositivo'
    )
  })

  it('contexto inseguro (sin HTTPS/localhost) muestra el mensaje correspondiente', async () => {
    startQrCameraScannerMock.mockImplementation(async ({ onError }) => {
      onError('insecure-context')
      return null
    })

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Escanear con cámara' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El escaneo con cámara solo funciona en una conexión segura'
    )
  })

  it('la entrada manual sigue disponible cuando la cámara falla', async () => {
    startQrCameraScannerMock.mockImplementation(async ({ onError }) => {
      onError('unknown')
      return null
    })

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Escanear con cámara' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(await screen.findByLabelText('Código del QR')).toBeEnabled()
  })

  it('cerrar el modal para el scanner (libera la cámara)', async () => {
    const stop = vi.fn()
    startQrCameraScannerMock.mockResolvedValue({ stop })

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Escanear con cámara' }))
    await screen.findByRole('dialog')
    await waitFor(() => expect(startQrCameraScannerMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
