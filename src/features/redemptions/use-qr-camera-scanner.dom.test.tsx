import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SEED_PURCHASED_QR_TOKEN } from '@/shared/mocks/seed'
import { useQrCameraScanner, type UseQrCameraScannerResult } from './use-qr-camera-scanner'
import { startQrCameraScanner } from './qr-camera-scanner'

/**
 * Mockea el adaptador entero (`vi.mock`) — nunca la librería real. El hook
 * es el que orquesta abrir/cerrar y filtrar decodes; `qr-camera-scanner.ts`
 * ya tiene su propio test para la única función pura que expone.
 */
vi.mock('./qr-camera-scanner', () => ({
  startQrCameraScanner: vi.fn(),
}))

const startQrCameraScannerMock = vi.mocked(startQrCameraScanner)

/**
 * Monta un `<video>` real y lo conecta al `videoRef` del hook: React adjunta
 * refs durante el commit, ANTES de correr los efectos, así que para cuando
 * el efecto de arranque del hook lee `videoRef.current` el elemento ya está
 * ahí — igual que va a pasar en `qr-scanner-modal.tsx`, donde el `<video>`
 * vive en el mismo render que el hook, no se agrega después.
 */
function renderScanner(props: { isOpen: boolean; onScanned: (token: string) => void }) {
  let latest!: UseQrCameraScannerResult

  function Harness() {
    const result = useQrCameraScanner(props)
    latest = result
    return <video ref={result.videoRef} />
  }

  const view = render(<Harness />)
  return {
    getResult: () => latest,
    rerender: (nextProps: typeof props) => {
      props = nextProps
      view.rerender(<Harness />)
    },
    unmount: view.unmount,
  }
}

describe('useQrCameraScanner', () => {
  beforeEach(() => {
    startQrCameraScannerMock.mockReset()
  })

  it('no arranca la cámara mientras el modal está cerrado', () => {
    renderScanner({ isOpen: false, onScanned: vi.fn() })

    expect(startQrCameraScannerMock).not.toHaveBeenCalled()
  })

  it('arranca la cámara con el <video> montado al abrir', async () => {
    startQrCameraScannerMock.mockResolvedValue({ stop: vi.fn() })

    renderScanner({ isOpen: true, onScanned: vi.fn() })

    await waitFor(() => expect(startQrCameraScannerMock).toHaveBeenCalledTimes(1))
    expect(startQrCameraScannerMock.mock.calls[0][0].videoElement).toBeInstanceOf(HTMLVideoElement)
  })

  /**
   * El decode NO tiene forma de token (#44): tiene que mostrar la pista y
   * seguir escaneando, sin llamar a `onScanned` — eso es lo que evita gastar
   * el balde de 30 req/min con basura decodificada.
   */
  it('muestra la pista de QR inválido y sigue escaneando ante un decode con formato incorrecto', async () => {
    let capturedOnDecode: ((value: string) => void) | undefined
    startQrCameraScannerMock.mockImplementation(async ({ onDecode }) => {
      capturedOnDecode = onDecode
      return { stop: vi.fn() }
    })
    const onScanned = vi.fn()

    const scanner = renderScanner({ isOpen: true, onScanned })
    await waitFor(() => expect(capturedOnDecode).toBeDefined())

    act(() => capturedOnDecode!('esto-no-es-un-token'))

    await waitFor(() => expect(scanner.getResult().showInvalidTokenHint).toBe(true))
    expect(onScanned).not.toHaveBeenCalled()
  })

  /**
   * El PRIMER decode válido para el scanner y dispara `onScanned` una sola
   * vez — el corazón de la protección del rate limit compartido (design D8):
   * el hook nunca debe convertirse en el origen de un segundo lookup para
   * el mismo token.
   */
  it('para el scanner y dispara onScanned una sola vez con el primer token válido', async () => {
    const stop = vi.fn()
    let capturedOnDecode: ((value: string) => void) | undefined
    startQrCameraScannerMock.mockImplementation(async ({ onDecode }) => {
      capturedOnDecode = onDecode
      return { stop }
    })
    const onScanned = vi.fn()

    renderScanner({ isOpen: true, onScanned })
    await waitFor(() => expect(capturedOnDecode).toBeDefined())

    act(() => capturedOnDecode!(SEED_PURCHASED_QR_TOKEN))

    expect(onScanned).toHaveBeenCalledTimes(1)
    expect(onScanned).toHaveBeenCalledWith(SEED_PURCHASED_QR_TOKEN)
    expect(stop).toHaveBeenCalledTimes(1)
  })

  /**
   * Un segundo decode (válido o no) después del primero exitoso se ignora
   * por completo — ni siquiera actualiza la pista de "inválido". Cubre la
   * carrera contra el propio `stop()`, que no es instantáneo.
   */
  it('ignora cualquier decode posterior al primer token válido', async () => {
    let capturedOnDecode: ((value: string) => void) | undefined
    startQrCameraScannerMock.mockImplementation(async ({ onDecode }) => {
      capturedOnDecode = onDecode
      return { stop: vi.fn() }
    })
    const onScanned = vi.fn()

    const scanner = renderScanner({ isOpen: true, onScanned })
    await waitFor(() => expect(capturedOnDecode).toBeDefined())

    act(() => capturedOnDecode!(SEED_PURCHASED_QR_TOKEN))
    act(() => capturedOnDecode!(SEED_PURCHASED_QR_TOKEN))
    act(() => capturedOnDecode!('otro-valor-cualquiera'))

    expect(onScanned).toHaveBeenCalledTimes(1)
    expect(scanner.getResult().showInvalidTokenHint).toBe(false)
  })

  it.each([
    ['permission-denied' as const],
    ['no-camera' as const],
    ['insecure-context' as const],
    ['unknown' as const],
  ])('expone el motivo de error %s que reporta el adaptador', async (reason) => {
    startQrCameraScannerMock.mockImplementation(async ({ onError }) => {
      onError(reason)
      return null
    })

    const scanner = renderScanner({ isOpen: true, onScanned: vi.fn() })

    await waitFor(() => expect(scanner.getResult().error).toBe(reason))
  })

  it('para el scanner al cerrar el modal', async () => {
    const stop = vi.fn()
    startQrCameraScannerMock.mockResolvedValue({ stop })

    const scanner = renderScanner({ isOpen: true, onScanned: vi.fn() })
    await waitFor(() => expect(startQrCameraScannerMock).toHaveBeenCalledTimes(1))

    scanner.rerender({ isOpen: false, onScanned: vi.fn() })

    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1))
  })

  it('para el scanner al desmontar', async () => {
    const stop = vi.fn()
    startQrCameraScannerMock.mockResolvedValue({ stop })

    const scanner = renderScanner({ isOpen: true, onScanned: vi.fn() })
    await waitFor(() => expect(startQrCameraScannerMock).toHaveBeenCalledTimes(1))

    scanner.unmount()

    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1))
  })

  it('limpia el error y la pista de inválido al reabrir tras cerrar', async () => {
    let capturedOnDecode: ((value: string) => void) | undefined
    startQrCameraScannerMock.mockImplementation(async ({ onDecode }) => {
      capturedOnDecode = onDecode
      return { stop: vi.fn() }
    })

    const scanner = renderScanner({ isOpen: true, onScanned: vi.fn() })
    await waitFor(() => expect(capturedOnDecode).toBeDefined())

    act(() => capturedOnDecode!('no-valido'))
    await waitFor(() => expect(scanner.getResult().showInvalidTokenHint).toBe(true))

    scanner.rerender({ isOpen: false, onScanned: vi.fn() })
    scanner.rerender({ isOpen: true, onScanned: vi.fn() })

    await waitFor(() => expect(scanner.getResult().showInvalidTokenHint).toBe(false))
  })
})
