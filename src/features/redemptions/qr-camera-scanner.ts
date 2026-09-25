/**
 * Adaptador fino sobre `qr-scanner` (nimiq, MIT, v1.4.x) — issue #44-#48,
 * cámara como alternativa al pegado manual del token.
 *
 * Es un módulo aparte y no algo inline en el hook por dos razones:
 *
 * 1. `qr-scanner` se importa acá adentro con `import()` DINÁMICO, nunca en
 *    el top-level del archivo. Es lo que lo saca del bundle principal — el
 *    modal de escaneo es la única puerta de entrada, así que el costo (con
 *    su worker) solo se paga si el staff realmente lo abre.
 * 2. Es la costura que hace testeable el resto sin hardware real: los tests
 *    de `use-qr-camera-scanner` mockean este módulo entero (`vi.mock`) en
 *    vez de intentar correr `qr-scanner` (canvas, worker, `getUserMedia`)
 *    contra jsdom, que no los tiene.
 */

export type QrCameraScannerErrorReason =
  'insecure-context' | 'no-camera' | 'permission-denied' | 'unknown'

export interface QrCameraScannerHandle {
  /** Detiene el stream de video y libera la cámara. Segura de llamar más de una vez. */
  stop: () => void
}

export interface StartQrCameraScannerOptions {
  videoElement: HTMLVideoElement
  /** Se llama por CADA frame decodificado, sin filtrar formato — eso lo hace el caller. */
  onDecode: (value: string) => void
  onError: (reason: QrCameraScannerErrorReason) => void
}

/**
 * Chequeo síncrono, sin tocar hardware ni cargar `qr-scanner`. Filtra el
 * caso más común en desarrollo — abrir el portal por la IP de la red local
 * sin HTTPS — ANTES de pedirle permiso de cámara al navegador: en ese
 * contexto `navigator.mediaDevices` ni siquiera existe, así que seguir de
 * largo terminaría en un `TypeError` en vez de un mensaje entendible.
 */
export function isCameraScanningSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext === true &&
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices !== undefined
  )
}

/**
 * Traduce el motivo real por el que `scanner.start()` falló. `getUserMedia`
 * rechaza con un `DOMException` cuyo `name` es la única señal confiable —
 * el `message` es texto libre del navegador, no un contrato.
 */
function classifyStartError(error: unknown): QrCameraScannerErrorReason {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'permission-denied'
    }
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
      return 'no-camera'
    }
  }
  return 'unknown'
}

/**
 * Arranca la cámara y el decoder. Devuelve `null` (después de avisar por
 * `onError`) cuando no se pudo arrancar por cualquier motivo — no hay nada
 * que detener en ese caso, así que no tiene sentido devolver un handle.
 *
 * `preferredCamera: 'environment'` pide la trasera primero: es la que
 * apunta al cliente parado del otro lado del mostrador, no la que se ve a
 * sí mismo el staff.
 */
export async function startQrCameraScanner({
  videoElement,
  onDecode,
  onError,
}: StartQrCameraScannerOptions): Promise<QrCameraScannerHandle | null> {
  if (!isCameraScanningSupported()) {
    onError('insecure-context')
    return null
  }

  const { default: QrScanner } = await import('qr-scanner')

  // Chequear ANTES de arrancar evita pedirle permiso de cámara al navegador
  // cuando ya se sabe que no hay ninguna — un permiso que de todos modos no
  // iba a servir para nada.
  const hasCamera = await QrScanner.hasCamera().catch(() => false)
  if (!hasCamera) {
    onError('no-camera')
    return null
  }

  const scanner = new QrScanner(videoElement, (result) => onDecode(result.data), {
    preferredCamera: 'environment',
    highlightScanRegion: false,
    highlightCodeOutline: false,
  })

  try {
    await scanner.start()
  } catch (error) {
    scanner.destroy()
    onError(classifyStartError(error))
    return null
  }

  return {
    stop: () => {
      scanner.stop()
      scanner.destroy()
    },
  }
}
